/**
 * Company logo contract (BRANDING-P0).
 * Canonical: uploaded object in organisation-branding bucket.
 * Legacy: external https image URL retained in organisation_settings.logo_url.
 */

export const ORGANISATION_BRANDING_BUCKET = "organisation-branding";
export const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const COMPANY_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type CompanyLogoMimeType = (typeof COMPANY_LOGO_MIME_TYPES)[number];

const MIME_TO_EXT: Record<CompanyLogoMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MAGIC: { mime: CompanyLogoMimeType; bytes: number[] }[] = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF….WEBP checked separately
];

export function companyLogoObjectPath(
  orgId: string,
  mime: CompanyLogoMimeType,
  fileStem = "logo"
): string {
  const ext = MIME_TO_EXT[mime];
  return `${orgId}/branding/${fileStem}.${ext}`;
}

/** Unique object path so replacements never overwrite the live logo before persist. */
export function createCompanyLogoUploadPath(
  orgId: string,
  mime: CompanyLogoMimeType
): string {
  const stem = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return companyLogoObjectPath(orgId, mime, stem);
}

export function companyLogoFolderPrefix(orgId: string): string {
  return `${orgId}/branding`;
}

export function isAllowedCompanyLogoMime(
  value: string | null | undefined
): value is CompanyLogoMimeType {
  return (
    typeof value === "string" &&
    (COMPANY_LOGO_MIME_TYPES as readonly string[]).includes(value)
  );
}

export function detectCompanyLogoMimeFromBytes(
  bytes: Uint8Array
): CompanyLogoMimeType | null {
  for (const candidate of MAGIC) {
    if (candidate.bytes.every((b, i) => bytes[i] === b)) {
      if (candidate.mime === "image/webp") {
        // RIFF....WEBP
        if (
          bytes.length >= 12 &&
          bytes[8] === 0x57 &&
          bytes[9] === 0x45 &&
          bytes[10] === 0x42 &&
          bytes[11] === 0x50
        ) {
          return "image/webp";
        }
        continue;
      }
      return candidate.mime;
    }
  }
  return null;
}

export function validateCompanyLogoFileMeta(input: {
  size: number;
  mime: string | null | undefined;
}): { ok: true; mime: CompanyLogoMimeType } | { ok: false; error: string } {
  if (input.size <= 0) {
    return { ok: false, error: "Choose a logo image to upload." };
  }
  if (input.size > COMPANY_LOGO_MAX_BYTES) {
    return {
      ok: false,
      error: "Logo must be 2 MB or smaller.",
    };
  }
  if (!isAllowedCompanyLogoMime(input.mime)) {
    return {
      ok: false,
      error: "Use a PNG, JPG, or WebP image.",
    };
  }
  return { ok: true, mime: input.mime };
}

/**
 * Legacy external URL safety — reject non-http(s) and obvious non-image page URLs.
 * Does not prove the URL returns an image; quote render still has onError fallback.
 */
export function validateLegacyLogoUrl(
  value: string | null | undefined
): { ok: true; url: string | null } | { ok: false; error: string } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return { ok: true, url: null };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Enter a valid https image link." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Logo link must start with https://" };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // Common gallery/page URLs that are not direct images (Owner Imgur finding).
  if (
    host.includes("imgur.com") &&
    !host.startsWith("i.") &&
    !/\.(png|jpe?g|webp|gif)$/i.test(path)
  ) {
    return {
      ok: false,
      error:
        "That link looks like a webpage, not an image file. Upload a logo instead.",
    };
  }

  return { ok: true, url: trimmed };
}

export function isOrganisationBrandingPublicUrl(
  url: string,
  supabaseUrl: string | null | undefined
): boolean {
  if (!supabaseUrl || !url.trim()) return false;
  try {
    const base = new URL(supabaseUrl);
    const candidate = new URL(url);
    return (
      candidate.origin === base.origin &&
      candidate.pathname.includes(
        `/storage/v1/object/public/${ORGANISATION_BRANDING_BUCKET}/`
      )
    );
  } catch {
    return false;
  }
}

/** Prefer showing an image when logoUrl is non-empty; renderers must still onError-fallback. */
export function resolveCompanyLogoSrc(
  logoUrl: string | null | undefined
): string | null {
  const trimmed = logoUrl?.trim();
  return trimmed ? trimmed : null;
}
