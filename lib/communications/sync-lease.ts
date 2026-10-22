/**
 * One worker sends a consent revision. The claim and release are supplied
 * by the caller so tests can simulate overlap without a database.
 * A failed claim does not run the provider call.
 */

export async function withConsentLease<T>(input: {
  claim: () => Promise<boolean>;
  release: () => Promise<void>;
  run: () => Promise<T>;
}): Promise<{ claimed: true; result: T } | { claimed: false }> {
  let claimed = false;
  try {
    claimed = await input.claim();
  } catch {
    return { claimed: false };
  }
  if (!claimed) return { claimed: false };
  try {
    return { claimed: true, result: await input.run() };
  } finally {
    try {
      await input.release();
    } catch {
      // The database lease expires. Pending stays set when this attempt did not clear it.
    }
  }
}
