import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import type {
  ComposeReadinessInput,
  EstimateReadinessView,
} from "@/lib/assistant/readiness/types";
import { RETAINING_WALL_UNSUPPORTED_MATERIAL_MESSAGE } from "@/lib/estimate/calculators/retaining-wall";
import { looksLikeInternalFactKey } from "@/lib/assistant/presentation/fact-key-labels";

const KNOWN_LIMIT = 5;
const ASSUMPTION_LIMIT = 4;

function qualityKnown(qualityLevel: string | null): string | null {
  if (!qualityLevel || qualityLevel === "unknown") return null;
  if (qualityLevel === "standard") return "Standard finish";
  if (qualityLevel === "budget") return "Budget finish";
  if (qualityLevel === "premium") return "Premium finish";
  return null;
}

function constraintKnown(
  constraints: ComposeReadinessInput["constraints"],
  key: string,
  label: string
): string | null {
  const row = constraints.find((c) => c.key === key);
  if (row == null || row.value == null || row.value === "") return null;
  const value = String(row.value).trim();
  if (!value || value.toLowerCase() === "not sure") return null;
  return `${label}: ${value}`;
}

function knownFromJobPlan(plan: ComposeReadinessInput["jobPlan"]): string[] {
  const out: string[] = [];
  for (const card of plan.cards) {
    const knownChips = card.specChips.filter((chip) => !chip.assumed);
    if (knownChips.length > 0) {
      out.push(knownChips.map((chip) => chip.value).join(" · "));
    } else if (card.summary) {
      out.push(card.summary);
    }
  }
  return out;
}

export function hardMinimumBlockerCopy(
  candidates: readonly ClarifyCandidate[]
): string | null {
  const hard = candidates.filter((c) => c.blocksEstimate || c.askClass === "HARD_MINIMUM");
  if (hard.length === 0) return null;
  const deckGeometry = hard.some(
    (c) =>
      c.factKey === "deck.length_m" ||
      c.factKey === "deck.width_m" ||
      c.factKey === "deck.area_m2"
  );
  if (deckGeometry) {
    return "I need the deck dimensions or area before I can estimate this.";
  }
  const retainingWallUnsupported = hard.some(
    (c) =>
      c.factKey === "retaining_wall.material" &&
      c.rankReason.includes("unsupported")
  );
  if (retainingWallUnsupported) {
    return RETAINING_WALL_UNSUPPORTED_MATERIAL_MESSAGE;
  }
  const retainingWallCore = hard.filter((c) =>
    c.factKey === "retaining_wall.length_m" ||
    c.factKey === "retaining_wall.height_m" ||
    c.factKey === "retaining_wall.material"
  );
  if (retainingWallCore.length > 0) {
    const labels = retainingWallCore.map((c) => {
      if (c.factKey === "retaining_wall.length_m") return "length";
      if (c.factKey === "retaining_wall.height_m") return "height";
      return "material";
    });
    if (labels.length === 3) {
      return "I need the retaining wall length, height, and material before I can estimate this.";
    }
    return `I need the retaining wall ${labels.join(" and ")} before I can estimate this.`;
  }
  const first = hard[0];
  if (first?.question) return first.question;
  return "I need a few required measurements before I can estimate this.";
}

export function composeEstimateReadiness(
  input: ComposeReadinessInput
): EstimateReadinessView {
  const { clarify } = input;
  const known = [
    ...knownFromJobPlan(input.jobPlan),
    qualityKnown(input.qualityLevel),
    constraintKnown(input.constraints, "site_access", "Access"),
  ]
    .filter((row): row is string => Boolean(row))
    .filter((row) => !looksLikeInternalFactKey(row))
    .slice(0, KNOWN_LIMIT);

  const seen = new Set<string>();
  const assumptions = clarify.estimateNowAssumptions.filter((row) => {
    if (seen.has(row.statement)) return false;
    seen.add(row.statement);
    return true;
  }).slice(0, ASSUMPTION_LIMIT);

  const checks = clarify.candidates
    .filter((c) => c.blocksEstimate)
    .map((c) => c.label);

  const blockerCopy = hardMinimumBlockerCopy(clarify.candidates);
  const enough = clarify.enoughToEstimate && !clarify.blocksEstimate;

  return {
    heading: enough
      ? "That's enough to build your estimate."
      : blockerCopy
        ? "Need a bit more"
        : "That's enough to build your estimate.",
    explanation: enough
      ? "All required details resolved. You can still change the job afterward."
      : blockerCopy ?? "Answer the remaining required estimating questions.",
    known,
    assumptions,
    checks,
    confidenceLabel: clarify.blocksEstimate
      ? null
      : assumptions.length > 0
        ? "Initial estimate — some assumptions"
        : "Good enough for an initial estimate",
    canEstimateNow: clarify.canEstimateNow,
    blocksEstimate: clarify.blocksEstimate,
    blockerCopy,
    enoughToEstimate: enough,
  };
}
