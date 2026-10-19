import {
  normalizeAuthSiteOrigin,
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  resolveConfiguredSiteOrigin,
} from "@/lib/auth/site-url";

/**
 * Public host for an RFQ view-and-respond link.
 *
 * Preview uses this deployment's stable branch alias (VERCEL_BRANCH_URL).
 * Quote, variation, and invite links use the configured Preview site origin.
 * An RFQ link uses this deployment's branch alias, because /r/[token] exists
 * on the branch that sent it.
 * A missing branch alias fails the send rather than substituting another host.
 * Localhost is never written into an operational email.
 */
export function resolveRfqPublicOrigin(
  env: {
    VERCEL_ENV?: string;
    VERCEL_BRANCH_URL?: string;
    NEXT_PUBLIC_SITE_URL?: string;
  } = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  }
): string | null {
  if (env.VERCEL_ENV === "preview") {
    return branchAliasOrigin(env.VERCEL_BRANCH_URL);
  }
  if (env.VERCEL_ENV === "production") {
    const configured = resolveConfiguredSiteOrigin({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
    });
    if (!configured || isLocalHost(configured)) return null;
    return configured;
  }
  const local = normalizeAuthSiteOrigin(env.NEXT_PUBLIC_SITE_URL);
  if (!local || isLocalHost(local)) return null;
  return local;
}

function branchAliasOrigin(branchUrl: string | undefined): string | null {
  const host = branchUrl?.trim() ?? "";
  if (!host) return null;
  const origin = normalizeAuthSiteOrigin(host.includes("://") ? host : `https://${host}`);
  if (!origin || isLocalHost(origin)) return null;
  return origin;
}

function isLocalHost(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function rfqOriginIsHardeningAlias(origin: string | null): boolean {
  return origin === PREVIEW_AUTH_SITE_ORIGIN_STABLE;
}
