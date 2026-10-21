import { resolveLabourRate } from "@/lib/estimate/rates";

/**
 * Dollar amount comes from the labour resolver with no company rate.
 * The person-hour unit is the benchmark's cost unit. Do not keep a
 * separate dollar constant here.
 */
export function quotrLabourBenchmarkLabel(
  trade: "carpenter" | "labourer"
): string {
  const resolved = resolveLabourRate({
    rates: [],
    organisationSettings: null,
    trade: trade === "labourer" ? "labourer" : undefined,
  });
  const amount = Number.isInteger(resolved.costRate)
    ? `$${resolved.costRate}`
    : `$${resolved.costRate.toFixed(2)}`;
  return `${amount} per person-hour`;
}
