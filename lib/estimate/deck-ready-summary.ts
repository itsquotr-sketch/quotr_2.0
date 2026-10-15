/**
 * Short ready summary for a Deck. Confirmed job facts, then the assumptions
 * that still affect the estimate. Not a repeat of the Details form.
 */

import { getFact, getNumberFact, getStringFact, getBooleanFact } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

function confirmed(source: string | null | undefined): boolean {
  return source === "user" || source === "ai_extracted";
}

function metres(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function compactDeckReadySummary(input: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
}): string | null {
  const facts = input.facts;
  const id = input.workAreaId;
  const length = getNumberFact([...facts], id, "deck.length_m");
  const width = getNumberFact([...facts], id, "deck.width_m");
  const height = getNumberFact([...facts], id, "deck.height_m");
  const material = getStringFact([...facts], id, "deck.board_material");
  const board = getNumberFact([...facts], id, "deck.board_width_mm");
  if (length == null || width == null) return null;

  const identity = [
    `${metres(length)} × ${metres(width)} m${material ? ` ${material}` : ""} deck`,
    height != null ? `${metres(height)} m high` : null,
    board != null ? `${Math.round(board)} mm boards` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const extras: string[] = [];
  const fascia = getBooleanFact([...facts], id, "deck.vertical_face_boards_required");
  const fasciaLength = getNumberFact(
    [...facts],
    id,
    "deck.vertical_face_board_length_lm"
  );
  if (fascia === true) {
    extras.push(
      fasciaLength != null ? `fascia along ${metres(fasciaLength)} m` : "fascia included"
    );
  }
  const stepWidth = getNumberFact([...facts], id, "deck.step_width_m");
  const stepSource = getFact([...facts], id, "deck.step_width_m")?.source;
  if (stepWidth != null && confirmed(stepSource)) {
    extras.push(`steps ${metres(stepWidth)} m wide`);
  }
  const posts = getNumberFact([...facts], id, "deck.pile_or_post_count");
  const concrete = getBooleanFact([...facts], id, "deck.concrete_to_supports");
  if (posts != null && concrete === true) {
    extras.push(`${Math.round(posts)} posts, concrete included`);
  } else if (posts != null) {
    extras.push(`${Math.round(posts)} posts`);
  } else if (concrete === true) {
    extras.push("concrete included");
  }

  const assumptions: string[] = [];
  const stepsIncluded = getBooleanFact([...facts], id, "deck.steps_included");
  const going = getFact([...facts], id, "deck.step_going_m");
  if (stepsIncluded === true && (!going || !confirmed(going.source))) {
    assumptions.push("tread depth");
  }
  const diameter = getFact([...facts], id, "deck.hole_diameter_mm");
  const depth = getFact([...facts], id, "deck.hole_depth_mm");
  if (
    (diameter == null || !confirmed(diameter.source)) &&
    (depth == null || !confirmed(depth.source)) &&
    posts != null
  ) {
    assumptions.push("ordinary post-hole size");
  }
  const assumptionSentence =
    assumptions.length === 0
      ? null
      : assumptions.length === 1
        ? `${assumptions[0]} uses a Quotr assumption until you change it.`
        : `${assumptions.join(" and ")} use Quotr assumptions until you change them.`;
  const lead = assumptionSentence
    ? assumptionSentence.charAt(0).toUpperCase() + assumptionSentence.slice(1)
    : null;

  const job = [identity, extras.length > 0 ? extras.join(". ") : null]
    .filter(Boolean)
    .join(". ");
  return [job.endsWith(".") ? job : `${job}.`, lead].filter(Boolean).join(" ");
}
