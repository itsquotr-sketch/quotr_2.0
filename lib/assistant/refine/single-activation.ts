/**
 * EF02-IW-ID-A — one user activation → one nested create.
 * Presentation/action lock only. Does not change CAS or UUID factories.
 */

export function tryBeginSingleActivation(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function releaseSingleActivation(lock: { current: boolean }): void {
  lock.current = false;
}
