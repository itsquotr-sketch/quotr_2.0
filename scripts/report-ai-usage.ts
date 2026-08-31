/**
 * Token usage reporter — NO model calls.
 *
 *   npx tsx scripts/report-ai-usage.ts --provider anthropic --model claude-sonnet-4-6 --input-tokens 1200 --output-tokens 400
 *
 * Optional caller-owned USD rates (not defaulted from vendor sheets):
 *   --input-usd-per-mtok 3 --output-usd-per-mtok 15
 */
import { reportTokenUsage } from "../lib/ai/usage-estimate";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function numArg(name: string): number | undefined {
  const raw = arg(name);
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

const report = reportTokenUsage({
  provider: arg("provider") ?? "anthropic",
  model: arg("model") ?? "claude-sonnet-4-6",
  inputTokens: numArg("input-tokens") ?? 0,
  outputTokens: numArg("output-tokens") ?? 0,
  cacheCreationTokens: numArg("cache-creation-tokens"),
  cacheReadTokens: numArg("cache-read-tokens"),
  inputUsdPerMtok: numArg("input-usd-per-mtok"),
  outputUsdPerMtok: numArg("output-usd-per-mtok"),
  cacheCreationUsdPerMtok: numArg("cache-creation-usd-per-mtok"),
  cacheReadUsdPerMtok: numArg("cache-read-usd-per-mtok"),
});

console.log("AI usage report (no model call)");
console.log(`  provider: ${report.provider}`);
console.log(`  model: ${report.model}`);
console.log(`  input_tokens: ${report.inputTokens}`);
console.log(`  output_tokens: ${report.outputTokens}`);
console.log(`  cache_creation_tokens: ${report.cacheCreationTokens}`);
console.log(`  cache_read_tokens: ${report.cacheReadTokens}`);
console.log(`  total_tokens: ${report.totalTokens}`);
if (report.estimatedUsd == null) {
  console.log(`  estimated_usd: (not computed)`);
} else {
  console.log(`  estimated_usd: ${report.estimatedUsd.toFixed(6)}`);
}
console.log(`  note: ${report.usdNote}`);
