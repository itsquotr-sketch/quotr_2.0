import { createHash, randomBytes } from "node:crypto";

export const QUOTE_ACCESS_TOKEN_PREFIX = "qt_";
export const QUOTE_ACCESS_TOKEN_HASH_VERSION = "v1";

export function generateQuoteAccessToken(): string {
  return `${QUOTE_ACCESS_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function isQuoteAccessTokenFormat(value: string): boolean {
  return /^qt_[A-Za-z0-9_-]{43}$/.test(value);
}

export function hashQuoteAccessToken(rawToken: string): string {
  return createHash("sha256")
    .update(`${QUOTE_ACCESS_TOKEN_HASH_VERSION}:${rawToken}`)
    .digest("hex");
}

export function quotePublicPath(rawToken: string): string {
  return `/q/${rawToken}`;
}
