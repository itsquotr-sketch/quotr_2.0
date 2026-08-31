/**
 * Pure token accounting. Does not call a model and does not own vendor USD rates.
 *
 * Optional USD flags may be supplied by the caller; they are never defaulted
 * from Anthropic/OpenAI public price sheets.
 */

export type TokenUsageInput = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  inputUsdPerMtok?: number;
  outputUsdPerMtok?: number;
  cacheCreationUsdPerMtok?: number;
  cacheReadUsdPerMtok?: number;
};

export type TokenUsageReport = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  estimatedUsd: number | null;
  usdNote: string;
};

function nonNeg(n: number | undefined): number {
  if (n == null || !Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function reportTokenUsage(input: TokenUsageInput): TokenUsageReport {
  const inputTokens = nonNeg(input.inputTokens);
  const outputTokens = nonNeg(input.outputTokens);
  const cacheCreationTokens = nonNeg(input.cacheCreationTokens);
  const cacheReadTokens = nonNeg(input.cacheReadTokens);
  const totalTokens =
    inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;

  const hasUsd =
    input.inputUsdPerMtok != null ||
    input.outputUsdPerMtok != null ||
    input.cacheCreationUsdPerMtok != null ||
    input.cacheReadUsdPerMtok != null;

  let estimatedUsd: number | null = null;
  if (hasUsd) {
    const mtok = 1_000_000;
    estimatedUsd =
      (inputTokens / mtok) * nonNeg(input.inputUsdPerMtok) +
      (outputTokens / mtok) * nonNeg(input.outputUsdPerMtok) +
      (cacheCreationTokens / mtok) * nonNeg(input.cacheCreationUsdPerMtok) +
      (cacheReadTokens / mtok) * nonNeg(input.cacheReadUsdPerMtok);
  }

  return {
    provider: input.provider,
    model: input.model,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens,
    estimatedUsd,
    usdNote: hasUsd
      ? "USD uses caller-supplied per-million-token rates. Quotr does not own vendor list prices."
      : "USD not computed. Pass per-million-token rates if you want a caller-owned estimate.",
  };
}
