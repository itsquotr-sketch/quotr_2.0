import { createHash, randomBytes } from "node:crypto";

export const VARIATION_ACCESS_TOKEN_PREFIX = "vt_";
export const VARIATION_ACCESS_TOKEN_HASH_VERSION = "v1";

export function generateVariationAccessToken(): string {
  return `${VARIATION_ACCESS_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function isVariationAccessTokenFormat(value: string): boolean {
  return /^vt_[A-Za-z0-9_-]{43}$/.test(value);
}

export function hashVariationAccessToken(rawToken: string): string {
  return createHash("sha256")
    .update(`${VARIATION_ACCESS_TOKEN_HASH_VERSION}:${rawToken}`)
    .digest("hex");
}

export function variationPublicPath(rawToken: string): string {
  return `/v/${rawToken}`;
}
