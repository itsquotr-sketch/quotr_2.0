import { sumByCategoryWithSplits } from "@/lib/estimate/category-breakdown";
import { calculateEstimate } from "@/lib/estimate/calculate-estimate";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import type { EstimateContext } from "@/lib/estimate/types";
import type {
  CalibrationAnswers,
  CalibrationComparison,
  CalibrationScenario,
} from "@/lib/calibration/types";
import type { OrganisationRate } from "@/components/setup/types";

function pctDelta(yours: number, quotr: number): number | null {
  if (!Number.isFinite(yours) || !Number.isFinite(quotr) || quotr === 0) {
    return null;
  }
  return ((yours - quotr) / quotr) * 100;
}

function sumDefined(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(
    (value): value is number => value != null && Number.isFinite(value)
  );
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0);
}

export function resolveYourExpectedCost(
  answers: CalibrationAnswers
): number | null {
  if (
    answers.expected_total_cost != null &&
    Number.isFinite(answers.expected_total_cost)
  ) {
    return answers.expected_total_cost;
  }
  return sumDefined([
    answers.labour_cost,
    answers.materials_cost,
    answers.subcontractors_cost,
    answers.other_cost,
  ]);
}

/**
 * Build a synthetic estimate context for a calibration scenario.
 * Uses org rates when provided; otherwise benchmarks (observational compare).
 */
export function buildCalibrationEstimateContext(input: {
  scenario: CalibrationScenario;
  rates?: OrganisationRate[];
  defaultMarginPercent?: number;
}): EstimateContext {
  const workAreaId = `cal-${input.scenario.workAreaType}`;
  const margin =
    input.defaultMarginPercent != null &&
    Number.isFinite(input.defaultMarginPercent)
      ? input.defaultMarginPercent
      : DEFAULT_MARGIN_PERCENT;

  return {
    project: {
      id: `calibration:${input.scenario.id}`,
      qualityLevel: "standard",
    },
    confirmedWorkAreas: [
      {
        id: workAreaId,
        type: input.scenario.workAreaType,
        name: input.scenario.title,
        summary: input.scenario.summary,
        sort_order: 1,
      },
    ],
    facts: input.scenario.facts.map((fact) => ({
      key: fact.key,
      work_area_id: workAreaId,
      value: fact.value,
      source: "calibration_scenario",
    })),
    constraints: input.scenario.constraints.map((constraint) => ({
      key: constraint.key,
      label: constraint.label,
      value: constraint.value,
    })),
    organisationSettings: {
      id: "calibration-settings",
      org_id: "calibration",
      currency: "NZD",
      country: "NZ",
      region: null,
      default_gst_rate: 15,
      default_margin_percent: margin,
      default_contingency_percent: 10,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
      prefer_user_rates: true,
      allow_benchmark_rates: true,
      show_profit_in_estimates: true,
      onboarding_status: "in_progress",
      onboarding_step: "rates",
      onboarding_completed_at: null,
    },
    materialWastageSettings: null,
    rates: input.rates ?? [],
  };
}

function labourHoursFromResult(
  result: ReturnType<typeof calculateEstimate>
): number | null {
  let hours = 0;
  let found = false;
  for (const item of result.lineItems) {
    if (item.labourHours != null && Number.isFinite(item.labourHours)) {
      hours += item.labourHours;
      found = true;
    }
  }
  return found ? hours : null;
}

export function compareCalibrationAnswers(input: {
  scenario: CalibrationScenario;
  answers: CalibrationAnswers;
  rates?: OrganisationRate[];
  defaultMarginPercent?: number;
}): CalibrationComparison {
  const context = buildCalibrationEstimateContext({
    scenario: input.scenario,
    rates: input.rates,
    defaultMarginPercent: input.defaultMarginPercent,
  });
  const result = calculateEstimate(context);
  const byCategory = sumByCategoryWithSplits(result.lineItems);

  const yourExpectedCost = resolveYourExpectedCost(input.answers);
  const yourExpectedSell =
    input.answers.expected_sell != null &&
    Number.isFinite(input.answers.expected_sell)
      ? input.answers.expected_sell
      : null;

  const quotrCost = result.recommendedCost;
  const quotrSell = result.recommendedSell;
  const costDeltaPercent = yourExpectedCost
    ? pctDelta(yourExpectedCost, quotrCost)
    : null;
  const sellDeltaPercent = yourExpectedSell
    ? pctDelta(yourExpectedSell, quotrSell)
    : null;

  const categories: CalibrationComparison["categories"] = [
    {
      category: "labour",
      label: "Labour",
      yourCost:
        input.answers.labour_cost != null &&
        Number.isFinite(input.answers.labour_cost)
          ? input.answers.labour_cost
          : null,
      quotrCost: byCategory.labour?.cost ?? 0,
      // Monetary labour compare only when the user supplied labour $.
      // Hours-only is shown separately — do not invent labour dollars.
      comparable:
        input.answers.labour_cost != null &&
        Number.isFinite(input.answers.labour_cost),
    },
    {
      category: "materials",
      label: "Materials",
      yourCost:
        input.answers.materials_cost != null &&
        Number.isFinite(input.answers.materials_cost)
          ? input.answers.materials_cost
          : null,
      quotrCost: byCategory.materials?.cost ?? 0,
      comparable: input.answers.materials_cost != null,
    },
    {
      category: "subcontractor",
      label: "Subcontractors",
      yourCost:
        input.answers.subcontractors_cost != null &&
        Number.isFinite(input.answers.subcontractors_cost)
          ? input.answers.subcontractors_cost
          : null,
      quotrCost: byCategory.subcontractor?.cost ?? 0,
      comparable: input.answers.subcontractors_cost != null,
    },
  ];

  let narrative =
    "Quotr will use saved calibration as evidence about how your business prices work. It does not automatically alter this estimate or your saved rates.";
  if (costDeltaPercent != null) {
    const abs = Math.abs(costDeltaPercent).toFixed(0);
    if (Math.abs(costDeltaPercent) < 5) {
      narrative = `Your expected business cost is close to Quotr’s current calculation for this example (±${abs}%). ${narrative}`;
    } else if (costDeltaPercent > 0) {
      narrative = `Your expected business cost is about ${abs}% above Quotr’s current calculation for this example. ${narrative}`;
    } else {
      narrative = `Your expected business cost is about ${abs}% below Quotr’s current calculation for this example. ${narrative}`;
    }
  }

  return {
    scenarioId: input.scenario.id,
    scenarioVersion: input.scenario.version,
    workAreaType: input.scenario.workAreaType,
    yourExpectedCost,
    quotrRecommendedCost: quotrCost,
    costDeltaPercent,
    yourExpectedSell,
    quotrRecommendedSell: quotrSell,
    sellDeltaPercent,
    categories,
    narrative,
    quotrLabourHours: labourHoursFromResult(result),
  };
}
