import { isPlaySurfaceHost } from "@/lib/android/play-surface";

/** Isolated preview branch. Checkout on this branch must not return to the shared hardening host. */
export const FREE_SIGNUP_PREVIEW_BRANCH = "preview/android-free-signup";

/**
 * Vercel deployment hostname for this project, for example
 * quotr-2-0-hq1p0pvyx-quotr1.vercel.app. The git branch alias contains extra
 * hyphens and does not match, so the Android host cannot become the return URL.
 */
const PREVIEW_DEPLOYMENT_HOST = /^quotr-2-0-[a-z0-9]+-quotr1\.vercel\.app$/;

/**
 * Website origin for Checkout success and cancellation on the free-signup
 * preview branch. The host comes from Vercel's deployment URL, not from the
 * request. Production, other preview branches, Play hosts, and any other
 * origin are refused.
 */
export function freeSignupPreviewWebsiteOrigin(
  env: Readonly<Record<string, string | undefined>>
): string | null {
  if (env.VERCEL_ENV !== "preview") return null;
  if ((env.VERCEL_GIT_COMMIT_REF ?? "").trim() !== FREE_SIGNUP_PREVIEW_BRANCH) {
    return null;
  }
  const host = (env.VERCEL_URL ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!PREVIEW_DEPLOYMENT_HOST.test(host)) return null;
  if (isPlaySurfaceHost(host)) return null;
  return `https://${host}`;
}
