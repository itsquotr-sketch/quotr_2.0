/**
 * Play-distributed presentation.
 *
 * The request host is the boundary. The Production website hosts are refused
 * even if QUOTR_PLAY_SURFACE_HOSTS lists them, so Checkout, upgrades, the
 * billing portal, and seat purchase stay on the website.
 *
 * A matching host only changes what that host shows and which purchase
 * actions it will start. It does not grant or remove an entitlement.
 *
 * play.get-quotr.com is the stable Android host. The preview alias remains
 * until the Android launch URL is changed. Neither host is the website.
 */

export const PLAY_SURFACE_HOST = "play.get-quotr.com";

export const PLAY_SURFACE_PREVIEW_HOST =
  "quotr-2-0-git-android-play-twa-quotr1.vercel.app";

/** Customer and application links stay on the website, not the Android host. */
export const WEBSITE_APP_ORIGIN = "https://app.get-quotr.com";

export const PLAY_SURFACE_BILLING_NOTE =
  "This app does not sell plans or seats. An existing Quotr subscription is managed on the Quotr website.";

const WEBSITE_HOSTS = new Set([
  "app.get-quotr.com",
  "get-quotr.com",
  "www.get-quotr.com",
]);

export function isPlaySurfaceHost(hostHeader: string | null | undefined): boolean {
  const hostname = hostnameFromHeader(hostHeader);
  if (!hostname) return false;
  return playSurfaceHosts().has(hostname);
}

export function playSurfaceHosts(): Set<string> {
  const hosts = new Set<string>([PLAY_SURFACE_HOST, PLAY_SURFACE_PREVIEW_HOST]);
  const extra = process.env.QUOTR_PLAY_SURFACE_HOSTS ?? "";
  for (const part of extra.split(",")) {
    const hostname = hostnameFromHeader(part);
    if (hostname) hosts.add(hostname);
  }
  return hosts;
}

function hostnameFromHeader(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first || first.includes("/") || first.includes("@") || first.includes(" ")) {
    return null;
  }
  const hostname = first.replace(/:\d+$/, "");
  if (!hostname || WEBSITE_HOSTS.has(hostname)) return null;
  return hostname;
}
