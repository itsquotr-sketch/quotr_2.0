"use server";

import { revalidatePath } from "next/cache";
import { USER_ERRORS, toUserError } from "@/lib/errors/user-message";
import {
  getAuthOrgContext,
  type AuthOrgContext,
} from "@/lib/security/auth-org-context";
import { permissionDeniedError } from "@/lib/team/permission-server";
import {
  getCompanySettings,
  updateCompanySettings,
} from "@/lib/settings/company-actions";
import {
  COMPANY_LOGO_MAX_BYTES,
  ORGANISATION_BRANDING_BUCKET,
  createCompanyLogoUploadPath,
  detectCompanyLogoMimeFromBytes,
  validateCompanyLogoFileMeta,
} from "@/lib/settings/logo";
import type { CompanySettings } from "@/lib/settings/types";

const COMPANY_SETTINGS_PATH = "/app/settings/company";

export type CompanyLogoActionResult = {
  error?: string;
  settings?: CompanySettings;
};

type SupabaseClient = AuthOrgContext["supabase"];

async function listOrgBrandingPaths(
  supabase: SupabaseClient,
  orgId: string
): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(ORGANISATION_BRANDING_BUCKET)
    .list(`${orgId}/branding`, { limit: 20 });

  if (error || !data) return [];

  return data
    .filter(
      (item: { name: string }) => Boolean(item.name) && !item.name.endsWith("/")
    )
    .map((item: { name: string }) => `${orgId}/branding/${item.name}`);
}

async function removeStoragePaths(
  supabase: SupabaseClient,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(ORGANISATION_BRANDING_BUCKET).remove(paths);
}

/**
 * Failure-safe replace order:
 * 1) list existing objects
 * 2) upload NEW object to a unique path
 * 3) persist public URL to organisation_settings.logo_url
 * 4) only then delete obsolete objects
 *
 * If upload fails → old logo untouched.
 * If persist fails → delete orphan upload; old logo_url remains authoritative.
 */
export async function uploadCompanyLogo(
  formData: FormData
): Promise<CompanyLogoActionResult> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: USER_ERRORS.session };
  }
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.edit",
  });
  if (denied) return denied;

  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return { error: "Choose a logo image to upload." };
  }

  const declared = validateCompanyLogoFileMeta({
    size: file.size,
    mime: file.type || null,
  });
  if (!declared.ok) {
    return { error: declared.error };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.byteLength > COMPANY_LOGO_MAX_BYTES) {
    return { error: "Logo must be 2 MB or smaller." };
  }

  const detected = detectCompanyLogoMimeFromBytes(buffer);
  if (!detected) {
    return { error: "Use a PNG, JPG, or WebP image." };
  }

  const mimeCheck = validateCompanyLogoFileMeta({
    size: buffer.byteLength,
    mime: detected,
  });
  if (!mimeCheck.ok) {
    return { error: mimeCheck.error };
  }

  const previousPaths = await listOrgBrandingPaths(
    context.supabase,
    context.orgId
  );
  const objectPath = createCompanyLogoUploadPath(context.orgId, detected);

  try {
    const { error: uploadError } = await context.supabase.storage
      .from(ORGANISATION_BRANDING_BUCKET)
      .upload(objectPath, buffer, {
        contentType: detected,
        upsert: false,
        cacheControl: "3600",
      });

    if (uploadError) {
      return {
        error: toUserError(
          uploadError,
          "uploadCompanyLogo",
          "Could not upload logo. Please try again."
        ),
      };
    }

    const { data: publicData } = context.supabase.storage
      .from(ORGANISATION_BRANDING_BUCKET)
      .getPublicUrl(objectPath);

    if (!publicData?.publicUrl) {
      await removeStoragePaths(context.supabase, [objectPath]);
      return { error: "Could not prepare logo link. Please try again." };
    }

    const publicUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    const saved = await updateCompanySettings({ logoUrl: publicUrl });
    if (saved.error || saved.fieldErrors) {
      // Persist failed — keep old logo_url; remove orphan upload only.
      await removeStoragePaths(context.supabase, [objectPath]);
      return {
        error:
          saved.error ??
          saved.fieldErrors?.logoUrl?.[0] ??
          "Could not save logo. Please try again.",
      };
    }

    // Persist succeeded — remove obsolete branding objects (not the new one).
    const obsolete = previousPaths.filter((path) => path !== objectPath);
    await removeStoragePaths(context.supabase, obsolete);

    revalidatePath(COMPANY_SETTINGS_PATH);
    revalidatePath("/app", "layout");

    return {
      settings: saved.settings ?? (await getCompanySettings()) ?? undefined,
    };
  } catch (error) {
    // Best-effort orphan cleanup if upload may have landed before throw.
    await removeStoragePaths(context.supabase, [objectPath]);
    return {
      error: toUserError(
        error,
        "uploadCompanyLogo",
        "Could not upload logo. Please try again."
      ),
    };
  }
}

export async function removeCompanyLogo(): Promise<CompanyLogoActionResult> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: USER_ERRORS.session };
  }
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.edit",
  });
  if (denied) return denied;

  try {
    // Clear authoritative settings first so quotes never point at a deleted asset.
    const { error: clearError } = await context.supabase
      .from("organisation_settings")
      .update({ logo_url: null })
      .eq("org_id", context.orgId);

    if (clearError) {
      return {
        error: toUserError(
          clearError,
          "removeCompanyLogo",
          "Could not remove logo. Please try again."
        ),
      };
    }

    const paths = await listOrgBrandingPaths(context.supabase, context.orgId);
    await removeStoragePaths(context.supabase, paths);

    revalidatePath(COMPANY_SETTINGS_PATH);
    revalidatePath("/app", "layout");

    const settings = await getCompanySettings();
    return settings ? { settings } : {};
  } catch (error) {
    return {
      error: toUserError(
        error,
        "removeCompanyLogo",
        "Could not remove logo. Please try again."
      ),
    };
  }
}
