/**
 * First-run GST registered yes/no → customer Quote GST rate.
 *
 * No schema field. Authority remains organisation_settings.default_gst_rate.
 * SaaS/subscription GST is unrelated.
 */

export type GstRegisteredChoice = "yes" | "no";

export function isGstRegisteredChoice(
  value: string | null | undefined
): value is GstRegisteredChoice {
  return value === "yes" || value === "no";
}

/**
 * Map the yes/no question to the Quote GST percent.
 * Yes → country suggested rate (NZ 15). No → 0.
 */
export function gstRateFromRegisteredChoice(
  registered: GstRegisteredChoice,
  countrySuggestedPercent: number
): number {
  if (registered === "no") return 0;
  const suggested = Number(countrySuggestedPercent);
  if (!Number.isFinite(suggested) || suggested < 0) return 15;
  return suggested;
}

/**
 * Derive the yes/no UI from a stored rate.
 * 0 → not registered. Any positive rate → registered.
 * null/invalid → unknown (do not force existing orgs through the question).
 */
export function gstRegisteredFromRate(
  rate: number | null | undefined
): GstRegisteredChoice | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  return rate === 0 ? "no" : "yes";
}

/**
 * Existing configured orgs already have an intentional tax rate.
 * First-run GST question applies only while basics are still unconfirmed.
 */
export function shouldAskGstRegisteredQuestion(input: {
  onboardingStatus: string | null | undefined;
  defaultGstRate: number | null | undefined;
}): boolean {
  const status = input.onboardingStatus ?? "not_started";
  if (status === "in_progress" || status === "completed") {
    return false;
  }
  return (
    input.defaultGstRate == null || !Number.isFinite(input.defaultGstRate)
  );
}
