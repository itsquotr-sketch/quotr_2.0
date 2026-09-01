/**
 * Deployment label for operator confusion-reduction only.
 * Never shown on public Quote pages or in Quote emails.
 *
 * Authority:
 * - Vercel sets VERCEL_ENV = production | preview | development
 * - Local next dev has no VERCEL_ENV → local
 */

export type QuotrDeployment = "local" | "preview" | "production";

export const PRODUCTION_SUPABASE_PROJECT_REF = "lxvnylhsbvudzzupxeqr";
export const PRODUCTION_SUPABASE_PROJECT_NAME = "quotr_2.0";
export const PREVIEW_SUPABASE_PROJECT_REF = "shhpjsoldmqtkdbgrbtm";
export const PREVIEW_SUPABASE_PROJECT_NAME = "quotr_preview";

export function resolveQuotrDeployment(
  env: Readonly<Record<string, string | undefined>> = process.env
): QuotrDeployment {
  if (env.VERCEL_ENV === "production") {
    return "production";
  }
  if (env.VERCEL_ENV === "preview") {
    return "preview";
  }
  return "local";
}

/** Internal chrome only. Null on Production so client Quotes stay clean. */
export function internalDeploymentLabel(
  deployment: QuotrDeployment = resolveQuotrDeployment()
): "Local" | "Preview" | null {
  if (deployment === "production") {
    return null;
  }
  if (deployment === "preview") {
    return "Preview";
  }
  return "Local";
}

export function supabaseHostnameFromUrl(
  url: string | null | undefined
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const hostname = new URL(trimmed).hostname;
    return hostname || null;
  } catch {
    return null;
  }
}

export function supabaseProjectRefFromUrl(
  url: string | null | undefined
): string | null {
  const hostname = supabaseHostnameFromUrl(url);
  if (!hostname || !hostname.endsWith(".supabase.co")) {
    return null;
  }
  const ref = hostname.replace(/\.supabase\.co$/i, "");
  return ref || null;
}
