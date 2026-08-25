/**
 * RETAINING-WALL-MATURITY-1F / 1F-R1 — spoil removal intent.
 * MVP: measured / in-situ excavation m³ × all-in removal $/m³.
 * All-in includes normal cartage + normal tip. No bulking factor.
 * Tip-only leftover retaining_wall.spoil.disposal.m3 must not resolve all-in.
 * Future (not built): in-situ vs loose spoil vs truck/load vs tip vs haulage.
 * Separate from excavation labour/plant. Not backfill m³. Not material carry.
 */
import { getBooleanFact, getNumberFact, getStringFact, round2 } from "@/lib/estimate/facts";
import {
  RW_SPOIL_REMOVAL_PORTION_KEY,
  RW_SPOIL_REMOVAL_VOLUME_KEY,
} from "@/lib/estimate/retaining-wall-identities";
import type { EstimateFact } from "@/lib/estimate/types";

export const RW_SPOIL_REMOVAL_QUESTION =
  "Will excavated spoil need to be removed from site?";

export const RW_SPOIL_REMOVAL_OPTIONS = [
  "No — spoil will remain or be reused on site",
  "Yes — some or all will be removed",
  "Not sure",
] as const;

export const RW_SPOIL_REMOVAL_QUANTITY_QUESTION =
  "How much of the excavated material needs to leave site?";

export const RW_SPOIL_REMOVAL_ESTIMATED_VOLUME_QUESTION =
  "Estimated spoil removal volume (m³)?";

export const RW_SPOIL_REMOVAL_RATE_HELPER =
  "All-in cartage and disposal cost per measured excavation m³.";

export const RW_SPOIL_REMOVAL_EXCEEDS_MEASURED =
  "Removal quantity exceeds measured excavation volume.";

export const RW_SPOIL_REMOVAL_MISSING_RATE =
  "Spoil removal rate";

export const RW_SPOIL_REMOVAL_MISSING_QUANTITY =
  "Spoil removal quantity required";

export const RW_SPOIL_REMOVAL_PRICING_HELPER =
  "Add a hardfill removal rate in Rates.";

export type SpoilRemovalPortion = "all" | "some" | "none";

export type SpoilRemovalResolution = {
  readonly questionApplies: boolean;
  readonly removalRequired: boolean | null;
  readonly portion: SpoilRemovalPortion | null;
  readonly excavationVolumeM3: number | null;
  readonly removalVolumeM3: number | null;
  readonly quantityKnown: boolean;
  readonly exceedsMeasured: boolean;
  readonly assumptions: readonly string[];
  readonly missingInfo: readonly string[];
};

export function parseSpoilRemovalPortion(
  value: unknown
): SpoilRemovalPortion | null {
  if (value == null || value === "") return null;
  const text = String(value).trim().toLowerCase();
  if (!text || text === "not sure") return null;
  if (text === "all" || text.startsWith("all")) return "all";
  if (text === "some" || text.startsWith("some")) return "some";
  if (text === "none" || text.startsWith("none")) return "none";
  return null;
}

export function spoilRemovalPortionOptions(excavationVolumeM3: number | null): string[] {
  if (excavationVolumeM3 != null && excavationVolumeM3 >= 0) {
    return [
      `All — ${round2(excavationVolumeM3)}m³`,
      "Some — enter quantity",
      "None",
    ];
  }
  return ["All", "Some", "None"];
}

export function resolveSpoilRemoval(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  excavationVolumeM3: number | null;
}): SpoilRemovalResolution {
  const facts = [...params.facts];
  const excavationRequired =
    getBooleanFact(facts, params.workAreaId, "retaining_wall.excavation_required") ===
    true;
  const measured =
    params.excavationVolumeM3 != null &&
    Number.isFinite(params.excavationVolumeM3) &&
    params.excavationVolumeM3 > 0
      ? params.excavationVolumeM3
      : getNumberFact(facts, params.workAreaId, "retaining_wall.excavation_volume_m3");
  const excavationVolumeM3 =
    measured != null && Number.isFinite(measured) && measured > 0 ? measured : null;

  if (!excavationRequired) {
    return {
      questionApplies: false,
      removalRequired: false,
      portion: null,
      excavationVolumeM3,
      removalVolumeM3: null,
      quantityKnown: false,
      exceedsMeasured: false,
      assumptions: [],
      missingInfo: [],
    };
  }

  const removalRequired = getBooleanFact(
    facts,
    params.workAreaId,
    "retaining_wall.disposal_included"
  );
  const assumptions: string[] = [];
  const missingInfo: string[] = [];

  if (removalRequired !== true) {
    if (removalRequired === null) {
      assumptions.push(
        "Spoil removal from site is not confirmed. Excavation labour and plant still apply if spoil stays on site."
      );
    }
    return {
      questionApplies: true,
      removalRequired,
      portion: removalRequired === false ? "none" : null,
      excavationVolumeM3,
      removalVolumeM3: null,
      quantityKnown: false,
      exceedsMeasured: false,
      assumptions,
      missingInfo,
    };
  }

  const portion =
    parseSpoilRemovalPortion(
      getStringFact(facts, params.workAreaId, RW_SPOIL_REMOVAL_PORTION_KEY)
    ) ?? (excavationVolumeM3 != null ? "all" : null);

  if (portion === "none") {
    return {
      questionApplies: true,
      removalRequired: false,
      portion: "none",
      excavationVolumeM3,
      removalVolumeM3: null,
      quantityKnown: false,
      exceedsMeasured: false,
      assumptions,
      missingInfo,
    };
  }

  const entered = getNumberFact(
    facts,
    params.workAreaId,
    RW_SPOIL_REMOVAL_VOLUME_KEY
  );

  if (entered != null && entered < 0) {
    missingInfo.push("Spoil removal volume must be 0 m³ or more.");
    return {
      questionApplies: true,
      removalRequired: true,
      portion,
      excavationVolumeM3,
      removalVolumeM3: null,
      quantityKnown: false,
      exceedsMeasured: false,
      assumptions,
      missingInfo,
    };
  }

  let removalVolumeM3: number | null = null;
  if (portion === "some") {
    removalVolumeM3 = entered;
  } else if (portion === "all" && excavationVolumeM3 != null) {
    removalVolumeM3 = excavationVolumeM3;
  } else if (entered != null) {
    removalVolumeM3 = entered;
  }

  const exceedsMeasured =
    removalVolumeM3 != null &&
    excavationVolumeM3 != null &&
    removalVolumeM3 > excavationVolumeM3 + 1e-9;
  if (exceedsMeasured) {
    assumptions.push(RW_SPOIL_REMOVAL_EXCEEDS_MEASURED);
  }

  if (removalVolumeM3 == null) {
    missingInfo.push(RW_SPOIL_REMOVAL_MISSING_QUANTITY);
  }

  return {
    questionApplies: true,
    removalRequired: true,
    portion,
    excavationVolumeM3,
    removalVolumeM3,
    quantityKnown: removalVolumeM3 != null && removalVolumeM3 >= 0,
    exceedsMeasured,
    assumptions,
    missingInfo,
  };
}
