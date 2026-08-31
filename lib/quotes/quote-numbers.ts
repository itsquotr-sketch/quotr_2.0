const QUOTE_NUMBER_PATTERN = /^Q-(\d+)$/i;

export function formatQuoteNumber(sequence: number): string {
  const padded = String(Math.max(1, Math.trunc(sequence))).padStart(4, "0");
  return `Q-${padded}`;
}

export function parseQuoteNumberSequence(quoteNumber: string | null): number | null {
  if (!quoteNumber) return null;
  const match = QUOTE_NUMBER_PATTERN.exec(quoteNumber.trim());
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
}

export function nextQuoteNumber(existingNumbers: Array<string | null>): string {
  let max = 0;
  for (const value of existingNumbers) {
    const sequence = parseQuoteNumberSequence(value);
    if (sequence != null && sequence > max) {
      max = sequence;
    }
  }
  return formatQuoteNumber(max + 1);
}
