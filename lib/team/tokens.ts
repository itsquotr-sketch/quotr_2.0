import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export function generateInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function isWellFormedInviteToken(rawToken: string): boolean {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 128) {
    return false;
  }
  return /^[A-Za-z0-9_-]+$/.test(rawToken);
}
