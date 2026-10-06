"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { toUserError } from "@/lib/errors/user-message";
import { blankToNull, subcontractorSchema } from "@/lib/subcontractors/schema";
import type {
  GstRegistration,
  PreferredContactMethod,
  Subcontractor,
  SubcontractorActionState,
  SubcontractorContact,
  SubcontractorCountryCode,
  SubcontractorDocument,
  SubcontractorDocumentKind,
  SubcontractorPricingMethod,
} from "@/lib/subcontractors/types";
import {
  DOCUMENT_KINDS,
  GST_REGISTRATIONS,
  PREFERRED_CONTACT_METHODS,
  SUBCONTRACTOR_COUNTRY_CODES,
  SUBCONTRACTOR_PRICING_METHODS,
} from "@/lib/subcontractors/types";
import { normalizeCountryCode } from "@/lib/setup/locale-catalogue";
import { permissionDeniedError } from "@/lib/team/permission-server";

const SAVE_FAILED = "Could not save the subcontractor. Please try again.";

/**
 * Contacts writes use the role permission subcontractors.edit and the existing
 * projects.create entitlement. That is the intended Contacts gate:
 * Builder, Business, and an active trial allow it when the role can edit.
 * An expired or cancelled trial is outside full access and denies projects.create.
 * Viewer never has subcontractors.edit, on any plan.
 * Do not replace this with a looser capability.
 */
const LIST_COLUMNS = `
  id, trading_name, legal_name, website, country, country_code,
  address_line_1, address_line_2, address_city, address_region, address_postcode,
  service_regions, service_region_other_labels, work_area_types,
  specialties, internal_notes, preferred_pricing_method, currency, abn, nzbn,
  gst_registration, gst_number, minimum_charge_notes, travel_notes,
  archived_at, created_at, updated_at,
  subcontractor_contacts (
    id, name, role, email, phone, is_primary, preferred_contact, archived_at
  ),
  subcontractor_documents (
    id, document_kind, title, reference, expires_on, notes,
    original_filename, upload_status, archived_at
  )
`;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function asPricingMethod(value: unknown): SubcontractorPricingMethod | null {
  return typeof value === "string" &&
    (SUBCONTRACTOR_PRICING_METHODS as readonly string[]).includes(value)
    ? (value as SubcontractorPricingMethod)
    : null;
}

function asPreferred(value: unknown): PreferredContactMethod | null {
  return typeof value === "string" &&
    (PREFERRED_CONTACT_METHODS as readonly string[]).includes(value)
    ? (value as PreferredContactMethod)
    : null;
}

function asDocumentKind(value: unknown): SubcontractorDocumentKind | null {
  return typeof value === "string" &&
    (DOCUMENT_KINDS as readonly string[]).includes(value)
    ? (value as SubcontractorDocumentKind)
    : null;
}

function asCountry(value: unknown): SubcontractorCountryCode | null {
  return typeof value === "string" &&
    (SUBCONTRACTOR_COUNTRY_CODES as readonly string[]).includes(value)
    ? (value as SubcontractorCountryCode)
    : null;
}

function asGstRegistration(value: unknown): GstRegistration | null {
  return typeof value === "string" &&
    (GST_REGISTRATIONS as readonly string[]).includes(value)
    ? (value as GstRegistration)
    : null;
}

function asUploadStatus(value: unknown): SubcontractorDocument["upload_status"] {
  if (value === "pending" || value === "ready" || value === "failed") return value;
  return null;
}

function mapContacts(value: unknown): SubcontractorContact[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .filter((row) => row.archived_at == null)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      role: asString(row.role),
      email: asString(row.email),
      phone: asString(row.phone),
      is_primary: row.is_primary === true,
      preferred_contact: asPreferred(row.preferred_contact),
    }))
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

function mapDocuments(value: unknown): SubcontractorDocument[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .filter((row) => row.archived_at == null)
    .flatMap((row) => {
      const kind = asDocumentKind(row.document_kind);
      if (!kind) return [];
      return [{
        id: String(row.id),
        document_kind: kind,
        title: String(row.title ?? ""),
        reference: asString(row.reference),
        expires_on: asString(row.expires_on),
        notes: asString(row.notes),
        original_filename: asString(row.original_filename),
        upload_status: asUploadStatus(row.upload_status),
      }];
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

function mapSubcontractor(row: Record<string, unknown>): Subcontractor {
  return {
    id: String(row.id),
    trading_name: String(row.trading_name ?? ""),
    legal_name: asString(row.legal_name),
    website: asString(row.website),
    country: asString(row.country),
    country_code: asCountry(row.country_code),
    address_line_1: asString(row.address_line_1),
    address_line_2: asString(row.address_line_2),
    address_city: asString(row.address_city),
    address_region: asString(row.address_region),
    address_postcode: asString(row.address_postcode),
    service_regions: asStringList(row.service_regions),
    service_region_other_labels: asStringList(row.service_region_other_labels),
    work_area_types: asStringList(row.work_area_types),
    specialties: asString(row.specialties),
    internal_notes: asString(row.internal_notes),
    preferred_pricing_method: asPricingMethod(row.preferred_pricing_method),
    currency: asString(row.currency),
    abn: asString(row.abn),
    nzbn: asString(row.nzbn),
    gst_registration: asGstRegistration(row.gst_registration),
    gst_number: asString(row.gst_number),
    minimum_charge_notes: asString(row.minimum_charge_notes),
    travel_notes: asString(row.travel_notes),
    archived_at: asString(row.archived_at),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    contacts: mapContacts(row.subcontractor_contacts),
    documents: mapDocuments(row.subcontractor_documents),
  };
}

function revalidateSubcontractors(id?: string) {
  revalidatePath("/app/contacts");
  revalidatePath("/app/contacts/subcontractors");
  if (id) revalidatePath(`/app/contacts/subcontractors/${id}`);
}

async function requireSubcontractorContext() {
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      ok: false as const,
      error: "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "subcontractors.edit",
    entitlement: "projects.create",
  });
  if (denied) return { ok: false as const, error: denied.error };
  return { ok: true as const, context };
}

function fieldErrorsFromZod(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

export async function getContactsOrganisationCountry(): Promise<SubcontractorCountryCode | null> {
  const context = await getAuthOrgContext();
  if (!context) return null;
  const { data } = await context.supabase
    .from("organisation_settings")
    .select("country")
    .eq("org_id", context.orgId)
    .maybeSingle();
  const code = normalizeCountryCode(
    typeof data?.country === "string" ? data.country : null
  );
  return code === "NZ" || code === "AU" ? code : null;
}

export async function listSubcontractors(options?: {
  archived?: boolean;
}): Promise<Subcontractor[]> {
  const context = await getAuthOrgContext();
  if (!context) return [];

  let query = context.supabase
    .from("subcontractors")
    .select(LIST_COLUMNS)
    .eq("org_id", context.orgId)
    .order("trading_name", { ascending: true });

  query = options?.archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  const { data, error } = await query.limit(500);
  if (error) {
    console.error("[listSubcontractors] query failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => mapSubcontractor(row as Record<string, unknown>));
}

export async function getSubcontractor(id: string): Promise<Subcontractor | null> {
  const context = await getAuthOrgContext();
  if (!context) return null;
  const { data, error } = await context.supabase
    .from("subcontractors")
    .select(LIST_COLUMNS)
    .eq("id", id)
    .eq("org_id", context.orgId)
    .maybeSingle();
  if (error || !data) return null;
  return mapSubcontractor(data as Record<string, unknown>);
}

export async function saveSubcontractor(
  input: unknown
): Promise<SubcontractorActionState> {
  const parsed = subcontractorSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const loaded = await requireSubcontractorContext();
  if (!loaded.ok) return { error: loaded.error };
  const { context } = loaded;
  const value = parsed.data;

  const { data, error } = await context.supabase.rpc("save_subcontractor_v1", {
    p_payload: {
      id: value.id ?? null,
      trading_name: value.trading_name,
      legal_name: blankToNull(value.legal_name),
      website: blankToNull(value.website),
      country_code: value.country_code ?? null,
      address_line_1: blankToNull(value.address_line_1),
      address_line_2: blankToNull(value.address_line_2),
      address_city: blankToNull(value.address_city),
      address_region: blankToNull(value.address_region),
      address_postcode: blankToNull(value.address_postcode),
      service_regions: value.service_regions,
      service_region_other_labels: value.service_region_other_labels,
      work_area_types: value.work_area_types,
      specialties: blankToNull(value.specialties),
      internal_notes: blankToNull(value.internal_notes),
      preferred_pricing_method: value.preferred_pricing_method ?? null,
      currency: blankToNull(value.currency)?.toUpperCase() ?? null,
      abn: blankToNull(value.abn),
      nzbn: blankToNull(value.nzbn),
      gst_registration: value.gst_registration ?? null,
      gst_number: blankToNull(value.gst_number),
      minimum_charge_notes: blankToNull(value.minimum_charge_notes),
      travel_notes: blankToNull(value.travel_notes),
      contacts: value.contacts.map((contact) => ({
        id: contact.id ?? null,
        name: contact.name,
        role: blankToNull(contact.role),
        email: blankToNull(contact.email),
        phone: blankToNull(contact.phone),
        is_primary: contact.is_primary,
        preferred_contact: contact.preferred_contact ?? null,
      })),
    },
  });

  if (error) {
    return { error: toUserError(error, "saveSubcontractor", SAVE_FAILED) };
  }
  const id = typeof data === "string" ? data : null;
  if (!id) return { error: SAVE_FAILED };
  revalidateSubcontractors(id);
  return { success: true, id };
}

export async function archiveSubcontractor(
  subcontractorId: string
): Promise<SubcontractorActionState> {
  const loaded = await requireSubcontractorContext();
  if (!loaded.ok) return { error: loaded.error };
  const { context } = loaded;
  const { error } = await context.supabase
    .from("subcontractors")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", subcontractorId)
    .eq("org_id", context.orgId)
    .is("archived_at", null);

  if (error) {
    return { error: toUserError(error, "archiveSubcontractor", SAVE_FAILED) };
  }
  revalidateSubcontractors(subcontractorId);
  return { success: true };
}

export async function restoreSubcontractor(
  subcontractorId: string
): Promise<SubcontractorActionState> {
  const loaded = await requireSubcontractorContext();
  if (!loaded.ok) return { error: loaded.error };
  const { context } = loaded;
  const { error } = await context.supabase
    .from("subcontractors")
    .update({ archived_at: null })
    .eq("id", subcontractorId)
    .eq("org_id", context.orgId)
    .not("archived_at", "is", null);

  if (error) {
    return { error: toUserError(error, "restoreSubcontractor", SAVE_FAILED) };
  }
  revalidateSubcontractors(subcontractorId);
  return { success: true };
}
