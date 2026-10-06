import { createHash, randomBytes } from "node:crypto";

export const RFQ_ACCESS_TOKEN_PREFIX = "rfq_";
export const RFQ_ACCESS_TOKEN_HASH_VERSION = "v1";

export function generateRfqAccessToken(): string {
  return `${RFQ_ACCESS_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function isRfqAccessTokenFormat(value: string): boolean {
  return /^rfq_[A-Za-z0-9_-]{43}$/.test(value);
}

export function hashRfqAccessToken(rawToken: string): string {
  return createHash("sha256")
    .update(`${RFQ_ACCESS_TOKEN_HASH_VERSION}:${rawToken}`)
    .digest("hex");
}

export function rfqPublicPath(rawToken: string): string {
  return `/r/${rawToken}`;
}
