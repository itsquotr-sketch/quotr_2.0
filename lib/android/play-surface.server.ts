import "server-only";

import { headers } from "next/headers";
import { isPlaySurfaceHost } from "@/lib/android/play-surface";

/**
 * True when this request arrived on a Play surface host.
 * Missing request headers mean the caller is not a Play request.
 */
export async function isPlaySurfaceRequest(): Promise<boolean> {
  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    return isPlaySurfaceHost(host);
  } catch {
    return false;
  }
}

/**
 * Purchase actions on the Play host are refused.
 * The Stripe webhook on that same host is not a purchase screen: it applies
 * a subscription that was already confirmed. Middleware sets x-pathname from
 * the request path, so the caller cannot choose this exception.
 */
export async function isPlaySurfacePurchaseRequest(): Promise<boolean> {
  if (!(await isPlaySurfaceRequest())) return false;
  try {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (pathname.startsWith("/api/webhooks/stripe")) return false;
    return true;
  } catch {
    return true;
  }
}
