/**
 * Copy for the Post holes result card.
 * Quantities come from the existing hole and concrete planners.
 */
import type { DeckHoleGeometry } from "@/lib/estimate/deck-hole-excavation";
import {
  DECK_CONCRETE_ROUNDING_RULE,
  type DeckConcreteAuthority,
  type DeckPostConcretePlan,
} from "@/lib/estimate/deck-post-concrete";

export const DECK_POST_HOLE_FINISH = {
  dimensions: "Confirm hole dimensions",
  ground: "Choose ground",
  method: "Choose excavation method",
  spoil: "Choose spoil destination",
  fill: "Confirm concrete fill",
  post: "Select post size",
  embedment: "Enter embedded depth",
} as const;

export type DeckPostHoleFinishId = keyof typeof DECK_POST_HOLE_FINISH;

export const DECK_COMPANY_BAG_WARNING =
  "Company bags per hole replace the geometric bag quantity. Excavation bank volume is unchanged.";

const STANDARD_YIELD = "0.01";

export function deckConcreteResultLabel(
  authority: DeckConcreteAuthority,
  bags: number
): string | null {
  if (authority === "none") return null;
  const status =
    authority === "measured"
      ? "Confirmed"
      : authority === "company"
        ? "Company quantity"
        : "Provisional";
  return `Concrete: ${bags} bags · ${status}`;
}

export function deckExcavationResultLabel(bankVolumeM3: number | null): string {
  if (bankVolumeM3 == null) return "Excavation: add the hole count and size to see the bank volume.";
  return `Excavation: ${bankVolumeM3.toFixed(3)} m³ bank volume.`;
}

export function deckConcreteYieldCard(yieldM3: number | null, companyYield: boolean): string {
  if (companyYield && yieldM3 != null) {
    return `Yield: ${yieldM3} m³ per 20 kg bag on this job. Standard is ${STANDARD_YIELD}.`;
  }
  return `Yield: ${STANDARD_YIELD} m³ per 20 kg bag`;
}

export function deckPostSizeStatus(section: string): { confirmed: boolean; text: string } {
  const trimmed = section.trim();
  if (!trimmed) {
    return {
      confirmed: false,
      text: "Estimating default: 125 × 125 mm. Choosing a size confirms it.",
    };
  }
  const pretty = trimmed.replace(/\s*[x×]\s*/i, " × ");
  return { confirmed: true, text: `Confirmed ${pretty} mm.` };
}

export function deckPostHoleFinishItems(input: {
  sizeConfirmed: boolean;
  ground: string;
  method: string;
  spoil: string;
  concreteOn: boolean;
  fill: string;
  fillDepthMm: number | null;
  postSection: string;
  embedmentMm: number | null;
}): DeckPostHoleFinishId[] {
  const items: DeckPostHoleFinishId[] = [];
  if (!input.sizeConfirmed) items.push("dimensions");
  if (!input.ground) items.push("ground");
  if (!input.method) items.push("method");
  if (input.spoil !== "on_site" && input.spoil !== "off_site") items.push("spoil");
  if (!input.concreteOn) return items;
  const fillReady =
    input.fill === "full" ||
    (input.fill === "partial" && input.fillDepthMm != null && input.fillDepthMm > 0);
  if (!fillReady) items.push("fill");
  if (!input.postSection.trim()) items.push("post");
  if (input.embedmentMm == null || input.embedmentMm <= 0) items.push("embedment");
  return items;
}

export function deckConcreteCalculationLines(input: {
  holeCount: number;
  geometry: DeckHoleGeometry;
  concrete: DeckPostConcretePlan;
}): string[] {
  const { holeCount, geometry, concrete } = input;
  const shape =
    geometry.shape === "rectangular"
      ? `${holeCount} rectangular holes, ${geometry.lengthMm ?? "—"} × ${geometry.widthMm ?? "—"} × ${geometry.depthMm ?? "—"} mm.`
      : `${holeCount} circular holes, ${geometry.diameterMm ?? "—"} mm × ${geometry.depthMm ?? "—"} mm.`;
  const lines = [shape, geometry.formula];
  if (concrete.authority === "company") {
    lines.push(concrete.formula);
  } else if (
    concrete.authority === "measured" &&
    concrete.fillVolumeM3 != null &&
    concrete.netM3 != null
  ) {
    lines.push(
      `Post displacement ${(concrete.displacementM3 ?? 0).toFixed(3)} m³. Net fill ${concrete.netM3.toFixed(3)} m³.`
    );
    if (concrete.remainingFill) lines.push(concrete.remainingFill);
  } else if (concrete.remainingFill) {
    lines.push(concrete.remainingFill);
  }
  if (concrete.yieldSource) lines.push(concrete.yieldSource);
  lines.push(DECK_CONCRETE_ROUNDING_RULE);
  return lines;
}
