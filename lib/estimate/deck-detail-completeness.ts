/**
 * Deck details that must be answered before "Details captured" or a first estimate.
 * The Post holes editor and this list are the same decisions.
 */
import { getBooleanFact, getNumberFact, getStringFact } from "@/lib/estimate/facts";
import { planDeckHoleExcavation } from "@/lib/estimate/deck-hole-excavation";
import {
  DECK_POST_HOLE_FINISH,
  deckPostHoleFinishItems,
} from "@/lib/estimate/deck-post-hole-result";
import { newSubstructureIncluded } from "@/lib/estimate/deck-scope-2c";
import type { EstimateFact } from "@/lib/estimate/types";

export type DeckDetailGap = {
  readonly id: string;
  readonly label: string;
};

export function deckPostsInScope(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return newSubstructureIncluded([...facts], workAreaId);
}

function postCount(facts: readonly EstimateFact[], workAreaId: string): number | null {
  const rows = getNumberFact([...facts], workAreaId, "deck.bearer_row_count");
  const per = getNumberFact([...facts], workAreaId, "deck.supports_per_bearer");
  if (rows != null && per != null) return Math.round(rows * per);
  const stated = getNumberFact([...facts], workAreaId, "deck.pile_or_post_count");
  return stated != null ? Math.round(stated) : null;
}

/** Spoil "Not sure" is a real answer. Generic fact reads treat that phrase as empty. */
export function deckSpoilDestination(
  facts: readonly EstimateFact[],
  workAreaId: string
): string {
  const row = facts.find(
    (fact) => fact.key === "deck.spoil_destination" && fact.work_area_id === workAreaId
  );
  if (typeof row?.value !== "string") return "";
  const text = row.value.trim();
  if (text === "on_site" || text === "off_site" || text === "not_sure") return text;
  return "";
}

function spoilChargeAnswered(choice: string, cost: number | null): boolean {
  return choice === "allowance" || choice === "rfq" || (choice === "job" && cost != null && cost > 0);
}

function spoilChoice(facts: readonly EstimateFact[], workAreaId: string): string {
  const destination = deckSpoilDestination(facts, workAreaId);
  if (destination) return destination;
  const legacy = facts.find(
    (fact) => fact.key === "deck.spoil_leaves_site" && fact.work_area_id === workAreaId
  );
  if (legacy?.value === true) return "off_site";
  if (legacy?.value === false) return "on_site";
  return "";
}

export function deckDetailGaps(
  facts: readonly EstimateFact[],
  workAreaId: string
): DeckDetailGap[] {
  const rows = [...facts];
  const postsInScope = deckPostsInScope(rows, workAreaId);
  const concrete = getBooleanFact(rows, workAreaId, "deck.concrete_to_supports");
  if (!postsInScope && concrete !== true) return [];

  const gaps: DeckDetailGap[] = [];
  const posts = postCount(rows, workAreaId);
  if (posts == null) {
    gaps.push({ id: "posts", label: "Enter the number of posts" });
  }
  const holeCount = getNumberFact(rows, workAreaId, "deck.hole_count");
  const reason = getStringFact(rows, workAreaId, "deck.hole_count_reason") ?? "";
  if (
    posts != null &&
    holeCount != null &&
    Math.round(holeCount) !== posts &&
    !reason.trim()
  ) {
    gaps.push({ id: "hole_reason", label: "Add a reason for a different hole count" });
  }

  const plan = planDeckHoleExcavation({
    facts: rows,
    workAreaId,
    holeCount: posts ?? holeCount ?? 1,
  });
  const ground = getStringFact(rows, workAreaId, "deck.hole_ground") ?? "";
  const method = getStringFact(rows, workAreaId, "deck.hole_method") ?? "";
  const spoil = spoilChoice(rows, workAreaId);
  const finish = deckPostHoleFinishItems({
    sizeConfirmed: plan.draftStamp?.sizeConfirmed ?? false,
    ground,
    method,
    spoil,
    concreteOn: concrete === true,
    fill: getStringFact(rows, workAreaId, "deck.concrete_fill") ?? "",
    fillDepthMm: getNumberFact(rows, workAreaId, "deck.concrete_fill_depth_mm"),
    postSection: getStringFact(rows, workAreaId, "deck.support_section") ?? "",
    embedmentMm: getNumberFact(rows, workAreaId, "deck.post_embedment_mm"),
  });
  for (const id of finish) {
    gaps.push({ id, label: DECK_POST_HOLE_FINISH[id] });
  }
  const outsideOrdinary =
    ground === "rock" ||
    ground === "groundwater" ||
    ground === "other" ||
    ground === "not_sure" ||
    method === "machine" ||
    method === "other" ||
    method === "not_sure" ||
    getStringFact(rows, workAreaId, "deck.hole_shape") === "rectangular";
  const jobHours = getNumberFact(rows, workAreaId, "deck.hole_job_hours_per_hole");
  const hoursStatus = getStringFact(rows, workAreaId, "deck.hole_hours_status") ?? "";
  if (
    ground &&
    method &&
    outsideOrdinary &&
    jobHours == null &&
    hoursStatus !== "unknown"
  ) {
    gaps.push({
      id: "excavate",
      label: "Enter excavation hours for this ground",
    });
  }
  if (spoil === "off_site") {
    const haulage = getStringFact(rows, workAreaId, "deck.spoil_haulage_choice") ?? "";
    const tip = getStringFact(rows, workAreaId, "deck.spoil_tip_choice") ?? "";
    const haulageCost = getNumberFact(rows, workAreaId, "deck.spoil_haulage_job_cost");
    const tipCost = getNumberFact(rows, workAreaId, "deck.spoil_tip_job_cost");
    if (!spoilChargeAnswered(haulage, haulageCost)) {
      gaps.push({ id: "haulage", label: "Choose spoil loading and haulage" });
    }
    if (!spoilChargeAnswered(tip, tipCost)) {
      gaps.push({ id: "tip", label: "Choose the spoil tip fee" });
    }
  }
  return gaps;
}

export function deckDetailGapsForAreas(
  facts: readonly EstimateFact[],
  workAreas: readonly { id: string; type: string }[]
): DeckDetailGap[] {
  return workAreas
    .filter((area) => area.type === "deck")
    .flatMap((area) => deckDetailGaps(facts, area.id));
}

export function firstDeckDetailTarget(
  facts: readonly EstimateFact[],
  workAreas: readonly { id: string; type: string }[]
): { readonly workAreaId: string; readonly gapId: string } | null {
  for (const area of workAreas) {
    if (area.type !== "deck") continue;
    const gap = deckDetailGaps(facts, area.id)[0];
    if (gap) return { workAreaId: area.id, gapId: gap.id };
  }
  return null;
}

/** DOM id of the control that answers one post-hole gap. */
export function deckPostHoleControlId(workAreaId: string, gapId: string): string {
  switch (gapId) {
    case "posts":
      return `deck-hole-count-${workAreaId}`;
    case "hole_reason":
      return `deck-hole-reason-${workAreaId}`;
    case "concrete":
      return `deck-concrete-included-${workAreaId}`;
    case "dimensions":
      return `deck-hole-confirm-${workAreaId}`;
    case "ground":
      return `deck-hole-ground-${workAreaId}`;
    case "method":
      return `deck-hole-method-${workAreaId}`;
    case "spoil":
      return `deck-spoil-${workAreaId}`;
    case "fill":
      return `deck-concrete-fill-${workAreaId}`;
    case "post":
      return `deck-concrete-post-${workAreaId}`;
    case "embedment":
      return `deck-post-embedment-${workAreaId}`;
    case "excavate":
      return `deck-hole-hours-${workAreaId}`;
    case "haulage":
      return `deck-spoil-haulage-${workAreaId}`;
    case "tip":
      return `deck-spoil-tip-${workAreaId}`;
    default:
      return `deck-hole-count-${workAreaId}`;
  }
}

export function deckDetailGapCopy(gaps: readonly DeckDetailGap[]): string {
  const labels = gaps.map((gap) => gap.label);
  if (labels.length === 0) return "Complete the Deck details.";
  return `Complete Deck details: ${labels.join(", ")}.`;
}

/**
 * Post-hole answers belong to Details after Work confirmation has settled.
 * A Work save still in flight is not a Details gap.
 */
export function settledPostHoleAnswerCount(input: {
  readonly workConfirmed: boolean;
  readonly workSavePending: boolean;
  readonly gaps: readonly DeckDetailGap[];
}): number {
  if (!input.workConfirmed || input.workSavePending) return 0;
  return input.gaps.length;
}

/** Right-hand Estimate panel. The Post holes card already lists each answer. */
export function deckDetailPanelPrompt(count: number): string {
  if (count === 1) return "Finish 1 Post holes answer";
  return `Finish ${count} Post holes answers`;
}

/** Stage cards use only this. The longer explanation stays in the workspace. */
export function quantityConflictStageStatus(
  detail: string | null | undefined
): "Needs details" | "Needs updating" | "Review productivity" | null {
  const text = detail?.trim() ?? "";
  if (!text) return null;
  if (/stored deck productivity/i.test(text)) return "Review productivity";
  if (
    /provisional|before using the estimate|Confirm the concrete|Confirm or change/i.test(
      text
    )
  ) {
    return "Needs details";
  }
  return "Needs updating";
}
