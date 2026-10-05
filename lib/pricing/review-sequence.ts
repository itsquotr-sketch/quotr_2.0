/**
 * Order for marking Pricing reviewed.
 * Calls the existing save and review actions. Does not calculate money.
 */
export async function saveDocumentThenReview(input: {
  dirty: boolean;
  save: () => Promise<{ error?: string }>;
  review: () => Promise<{ error?: string }>;
}): Promise<
  | { ok: true }
  | { ok: false; stage: "save" | "review"; error: string }
> {
  if (input.dirty) {
    const saved = await input.save();
    if (saved.error) {
      return { ok: false, stage: "save", error: saved.error };
    }
  }

  const reviewed = await input.review();
  if (reviewed.error) {
    return { ok: false, stage: "review", error: reviewed.error };
  }

  return { ok: true };
}
