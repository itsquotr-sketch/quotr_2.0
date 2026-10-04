/**
 * Display-only address line. Adjacent duplicates are dropped after trim
 * and a case-insensitive compare. Stored fields are not changed.
 */
export function formatOnboardingAddress(
  parts: Array<string | null | undefined>
): string {
  const visible: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim() ?? "";
    if (!trimmed) continue;
    const previous = visible[visible.length - 1];
    if (previous && previous.toLowerCase() === trimmed.toLowerCase()) continue;
    visible.push(trimmed);
  }
  return visible.join(", ");
}
