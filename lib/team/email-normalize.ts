/**
 * Invite email normalization. Trim + lowercase only.
 * Do not apply Gmail dot/plus folding.
 */

export function normalizeInviteEmail(value: string): string {
  return value.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUsableInviteEmail(value: string): boolean {
  const normalized = normalizeInviteEmail(value);
  if (!normalized || normalized.length > 320) return false;
  if (/[\r\n,<>]/.test(normalized)) return false;
  return EMAIL_PATTERN.test(normalized);
}
