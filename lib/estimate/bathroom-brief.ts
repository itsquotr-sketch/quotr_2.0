/**
 * Deterministic bathroom brief → existing fact keys and one coverage note.
 *
 * The note uses the shared coverage-note contract (`*.coverage_note`).
 * It is not a new scope store. Unsupported tasks stay unpriced.
 * Partial wall lining is not a full reline. Fixture supply is not
 * installation, and excluded trades are not Quotr charges.
 */

import { briefHasIndependentBathroom } from "@/lib/work-areas/ownership";

export const BATHROOM_PARTIAL_LINING_VALUE =
  "Partial repair, extent unknown" as const;

export const BATHROOM_COVERAGE_PARTIAL_LINING =
  "Partial wall lining, extent unknown. Full-wall relining is not assumed. Coverage is unresolved." as const;

export const BATHROOM_COVERAGE_STAIR_PROTECTION =
  "Stair protection is requested. Coverage is unresolved. No supported recipe applies." as const;

export const BATHROOM_COVERAGE_DAILY_CLEANING =
  "Daily cleaning is requested. Coverage is unresolved. No supported recipe applies." as const;

export const BATHROOM_COVERAGE_ANCILLARY =
  "Contractor-supplied ancillary materials are requested. Coverage is unresolved. No supported recipe applies." as const;

const COVERAGE_SENTENCES = [
  BATHROOM_COVERAGE_PARTIAL_LINING,
  BATHROOM_COVERAGE_STAIR_PROTECTION,
  BATHROOM_COVERAGE_DAILY_CLEANING,
  BATHROOM_COVERAGE_ANCILLARY,
] as const;

export type BathroomBriefFact = {
  key: string;
  label: string;
  value: string | number | boolean | string[];
  unit?: string;
};

export type BathroomBriefApplication = {
  facts: BathroomBriefFact[];
  dropKeys: string[];
  coverageNote: string;
};

type SupplyItem = "vanity" | "toilet" | "shower" | "tiles";

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function sentences(brief: string): string[] {
  return brief
    .split(/(?<=[.!?])\s+/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function mentions(brief: string, pattern: RegExp): boolean {
  return pattern.test(brief);
}

function negatedBefore(brief: string, topic: RegExp): boolean {
  return new RegExp(
    `\\b(?:no|without|don't|do not)\\b[^.]*${topic.source}`,
    "i"
  ).test(brief);
}

function planMetres(brief: string): { length: number; width: number } | null {
  const re = /(\d+(?:\.\d+)?)\s*(m)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(m)?/gi;
  for (const match of brief.matchAll(re)) {
    const length = Number(match[1]);
    const width = Number(match[3]);
    const hasUnit = Boolean(match[2] || match[4]);
    if (!Number.isFinite(length) || !Number.isFinite(width)) continue;
    if (length <= 0 || width <= 0) continue;
    if (!hasUnit && (length > 20 || width > 20)) continue;
    if (length > 30 || width > 30) continue;
    return { length, width };
  }
  return null;
}

function wallHeight(brief: string): number | null {
  const match = brief.match(
    /\b(?:wall\s+)?height\s*(\d+(?:\.\d+)?)\b|\b(\d+(?:\.\d+)?)\s*m?\s*high\b/i
  );
  const raw = match?.[1] ?? match?.[2];
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= 6 ? value : null;
}

function namedSupplyItems(sentence: string): SupplyItem[] {
  const items: SupplyItem[] = [];
  if (/\bvanit(?:y|ies)\b/.test(sentence)) items.push("vanity");
  if (/\btoilets?\b|\bwcs?\b/.test(sentence)) items.push("toilet");
  if (/\bshowers?\b/.test(sentence)) items.push("shower");
  if (/\btiles?\b/.test(sentence)) items.push("tiles");
  return items;
}

function supplySide(sentence: string): "customer" | "contractor" | null {
  if (
    /\b(?:customer|client)\b/.test(sentence) &&
    /\b(?:buy(?:ing)?|suppl(?:y|ies|ied)|provid(?:e|es|ed))\b/.test(sentence)
  ) {
    return "customer";
  }
  if (
    /\b(?:we|contractor)\b/.test(sentence) &&
    /\bsuppl(?:y|ies|ied)\b/.test(sentence)
  ) {
    return "contractor";
  }
  return null;
}

function sameLocation(brief: string, item: string): boolean {
  const pattern = new RegExp(
    `${item}[^.]*same (?:spot|place|location)|same (?:spot|place|location)[^.]*${item}`,
    "i"
  );
  return pattern.test(brief);
}

/**
 * Recognises the mixed bathroom package this slice preserves.
 * A full reline or a full-renovation sentence is left to the existing path.
 */
export function interpretBathroomBrief(
  briefText: string
): BathroomBriefApplication | null {
  const brief = normalise(briefText);
  if (!briefHasIndependentBathroom(brief)) return null;
  if (/\b(?:full bathroom|full renovation|strip-out and rebuild)\b/.test(brief)) {
    return null;
  }
  if (
    /\brelin(?:e|ing)\b/.test(brief) &&
    !/\b(?:where damaged|damaged only|only where damaged)\b/.test(brief)
  ) {
    return null;
  }

  const removesNamed =
    /\b(?:rip out|remove|strip out|strip-out)\b/.test(brief) &&
    /\b(?:vanity|shower|toilet|vinyl)\b/.test(brief);
  const replacesNamed =
    /\b(?:new|replace|fit)\b/.test(brief) &&
    /\b(?:vanity|shower|toilet)\b/.test(brief);
  const tilesFloor =
    !negatedBefore(brief, /til(?:e|ing)/) &&
    /\b(?:tile|tiling)\s+(?:the\s+)?floors?\b|\bfloor\s+til(?:e|ing)\b|\btil(?:e|ing)\s+(?:the\s+)?floors?\b/.test(
      brief
    );
  const paints =
    !negatedBefore(brief, /paint(?:ing)?/) &&
    /\bpaint(?:ing)?\b/.test(brief) &&
    /\b(?:walls?|ceilings?)\b/.test(brief);
  const partialLining =
    /\b(?:gib|lining|plasterboard)\b/.test(brief) &&
    /\b(?:where damaged|damaged only|only where damaged|extent unknown|dunno how much|how much yet|amount unknown)\b/.test(
      brief
    );
  const customerSentence = sentences(brief).some(
    (sentence) => supplySide(sentence) === "customer" && namedSupplyItems(sentence).length > 0
  );

  if (!(removesNamed || replacesNamed) || !(tilesFloor || paints || partialLining || customerSentence)) {
    return null;
  }

  const customer = new Set<SupplyItem>();
  const contractor = new Set<SupplyItem>();
  let ancillary = false;
  for (const sentence of sentences(brief)) {
    const side = supplySide(sentence);
    if (side == null) continue;
    const items = namedSupplyItems(sentence);
    if (side === "contractor" && /\bother materials\b/.test(sentence)) {
      ancillary = true;
    }
    for (const item of items) {
      if (side === "customer") customer.add(item);
      else contractor.add(item);
    }
  }

  const facts: BathroomBriefFact[] = [];
  const push = (fact: BathroomBriefFact) => {
    facts.push(fact);
  };

  push({
    key: "bathroom.job_scope",
    label: "Bathroom work",
    value: "custom",
  });

  const plan = planMetres(brief);
  if (plan) {
    push({
      key: "bathroom.length_m",
      label: "Bathroom length",
      value: plan.length,
      unit: "m",
    });
    push({
      key: "bathroom.width_m",
      label: "Bathroom width",
      value: plan.width,
      unit: "m",
    });
  }
  const height = wallHeight(brief);
  if (height != null) {
    push({
      key: "bathroom.wall_height_m",
      label: "Wall height",
      value: height,
      unit: "m",
    });
  }

  const removalText = sentences(brief)
    .filter((sentence) => /\b(?:rip out|remove|strip)\b/.test(sentence))
    .join(" ");
  const components: string[] = [];
  if (/\bvanit/.test(removalText)) components.push("vanity");
  if (/\bshower/.test(removalText)) components.push("shower");
  if (/\btoilet/.test(removalText)) components.push("toilet");
  if (/\bvinyl\b/.test(removalText)) components.push("floor_finish");
  if (components.length > 0) {
    push({
      key: "bathroom.demolition_required",
      label: "Demolition required",
      value: true,
    });
    push({
      key: "bathroom.demolition.components",
      label: "Demolition components",
      value: components,
    });
  }

  const fixtures: string[] = [];
  if (/\bvanit/.test(brief) && /\b(?:new|replace|fit|\d+\s*mm)\b/.test(brief)) {
    fixtures.push("Vanity");
  }
  if (/\bshower/.test(brief) && /\b(?:new|replace|same)\b/.test(brief)) {
    fixtures.push("Shower");
  }
  if (/\btoilet/.test(brief) && /\b(?:new|replace|same)\b/.test(brief)) {
    fixtures.push("Toilet");
  }
  if (fixtures.length > 0) {
    push({
      key: "bathroom.fixtures_included",
      label: "Fixtures included",
      value: fixtures,
    });
  }

  const ownershipFor = (item: SupplyItem, key: string, label: string) => {
    if (customer.has(item)) {
      push({ key, label, value: "Install only" });
    } else if (contractor.has(item)) {
      push({ key, label, value: "Supply and install" });
    }
  };
  ownershipFor("vanity", "bathroom.fixture.vanity.ownership", "Vanity supply / install");
  ownershipFor("toilet", "bathroom.fixture.toilet.ownership", "Toilet supply / install");
  ownershipFor("shower", "bathroom.fixture.shower.ownership", "Shower supply / install");

  const fixtureIds = ["vanity", "toilet", "shower"] as const;
  const requestedFixtureIds = fixtureIds.filter((id) =>
    fixtures.some((name) => name.toLowerCase().includes(id))
  );
  if (
    requestedFixtureIds.length > 0 &&
    requestedFixtureIds.every((id) => customer.has(id))
  ) {
    push({
      key: "bathroom.fixtures_client_supplied",
      label: "Fixtures client supplied",
      value: true,
    });
  }

  if (tilesFloor) {
    push({
      key: "bathroom.tiling_included",
      label: "Tiling included",
      value: true,
    });
    push({
      key: "bathroom.floor_finish_system",
      label: "Floor finish",
      value: "tile",
    });
    if (!/\b(?:wall tiles|tile the walls|tiled walls|wall tiling)\b/.test(brief)) {
      push({
        key: "bathroom.tile_extent",
        label: "Wall tile extent",
        value: "none",
      });
    }
  }

  if (paints) {
    push({
      key: "bathroom.painting_included",
      label: "Painting included",
      value: true,
    });
    if (!/\b(?:reline|relining|replace the ceiling|new ceiling)\b/.test(brief)) {
      push({
        key: "bathroom.ceiling_lining_included",
        label: "Ceiling lining",
        value: false,
      });
    }
  }

  const dropKeys: string[] = [];
  if (partialLining) {
    push({
      key: "bathroom.wall_lining_included",
      label: "Wall lining",
      value: BATHROOM_PARTIAL_LINING_VALUE,
    });
    dropKeys.push("bathroom.wall_lining_system");
  }

  const tradesExcluded =
    /\b(?:plumber|plumbing|sparky|electrician|electrical)\b/.test(brief) &&
    /\b(?:separate|don't include|do not include|excluded|by others|their charges)\b/.test(
      brief
    );
  if (tradesExcluded) {
    push({
      key: "bathroom.plumbing.level",
      label: "Plumbing level",
      value: "none",
    });
    push({
      key: "bathroom.electrical.level",
      label: "Electrical level",
      value: "none",
    });
    push({
      key: "bathroom.plumbing_changes",
      label: "Plumbing changes",
      value: "None",
    });
    push({
      key: "bathroom.electrical_changes",
      label: "Electrical changes",
      value: "None",
    });
  }

  if (!mentions(brief, /\bwaterproof/)) {
    dropKeys.push(
      "bathroom.waterproofing_included",
      "bathroom.waterproofing_required",
      "bathroom.waterproofing_extent"
    );
  }

  const vanityMm = brief.match(
    /\b(?:vanity\s*(?:of\s*)?(\d{3,4})|(\d{3,4})\s*mm\s*vanity|(\d{3,4})\s*vanity)\b/
  );
  const vanityWidth = Number(vanityMm?.[1] ?? vanityMm?.[2] ?? vanityMm?.[3]);

  const noteParts: string[] = [];
  if (Number.isFinite(vanityWidth) && vanityWidth > 0) {
    noteParts.push(`Vanity specification: ${vanityWidth} mm.`);
  }
  if (sameLocation(brief, "shower")) {
    noteParts.push("Shower replacement stays in the existing location.");
  }
  if (sameLocation(brief, "toilet")) {
    noteParts.push("Toilet replacement stays in the existing location.");
  }
  if (customer.size > 0) {
    noteParts.push(`Customer-supplied: ${[...customer].join(", ")}.`);
  }
  if (ancillary) noteParts.push(BATHROOM_COVERAGE_ANCILLARY);
  if (partialLining) noteParts.push(BATHROOM_COVERAGE_PARTIAL_LINING);
  if (/\boccupied house\b|\boccupied upstairs\b|\bupstairs occupied\b/.test(brief)) {
    noteParts.push("Upstairs occupied house.");
  }
  if (tradesExcluded) {
    noteParts.push("Excluded trades: plumbing, electrical.");
  }

  const coverageNote = noteParts.join(" ");
  if (coverageNote) {
    push({
      key: "bathroom.coverage_note",
      label: "Coverage note",
      value: coverageNote,
    });
  }

  return { facts, dropKeys, coverageNote };
}

export function bathroomPreservationSentences(note: string | null | undefined): string[] {
  if (!note) return [];
  return COVERAGE_SENTENCES.filter((sentence) => note.includes(sentence));
}

export function bathroomCustomerSuppliesTiles(note: string | null | undefined): boolean {
  const match = note?.match(/Customer-supplied:\s*([^.]+)/i);
  if (!match?.[1]) return false;
  return match[1]
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .includes("tiles");
}

export function bathroomVanitySpecificationMm(
  note: string | null | undefined
): number | null {
  const match = note?.match(/Vanity specification:\s*(\d+)\s*mm/i);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export type BathroomPlanRow = {
  id: string;
  label: string;
  presentation: "INCLUDED" | "NOT_INCLUDED" | "NOT_CONFIRMED";
  factKey: string;
};

export function bathroomPreservationRows(params: {
  facts: readonly { key: string; work_area_id?: string | null; value: unknown }[];
  workAreaId: string;
}): BathroomPlanRow[] {
  const valueOf = (key: string) =>
    params.facts.find(
      (fact) => fact.key === key && (fact.work_area_id ?? "") === params.workAreaId
    )?.value;
  const note = typeof valueOf("bathroom.coverage_note") === "string"
    ? (valueOf("bathroom.coverage_note") as string)
    : "";
  const rows: BathroomPlanRow[] = [];
  const add = (
    id: string,
    label: string,
    presentation: BathroomPlanRow["presentation"],
    factKey: string
  ) => {
    rows.push({ id, label, presentation, factKey });
  };

  const components = valueOf("bathroom.demolition.components");
  const componentList = Array.isArray(components) ? components.map((row) => String(row)) : [];
  if (componentList.includes("vanity")) {
    add("remove-vanity", "Remove existing vanity", "INCLUDED", "bathroom.demolition.components");
  }
  if (componentList.includes("shower")) {
    add("remove-shower", "Remove existing shower", "INCLUDED", "bathroom.demolition.components");
  }
  if (componentList.includes("toilet")) {
    add("remove-toilet", "Remove existing toilet", "INCLUDED", "bathroom.demolition.components");
  }
  if (componentList.includes("floor_finish")) {
    add("remove-vinyl", "Remove existing vinyl", "INCLUDED", "bathroom.demolition.components");
  }

  const vanityMm = bathroomVanitySpecificationMm(note);
  if (vanityMm != null) {
    add("vanity-spec", `${vanityMm} mm vanity`, "INCLUDED", "bathroom.coverage_note");
  }
  if (note.includes("Shower replacement stays in the existing location.")) {
    add("shower-location", "New shower in the existing location", "INCLUDED", "bathroom.coverage_note");
  }
  if (note.includes("Toilet replacement stays in the existing location.")) {
    add("toilet-location", "New toilet in the existing location", "INCLUDED", "bathroom.coverage_note");
  }
  if (valueOf("bathroom.floor_finish_system") === "tile") {
    add("floor-tile", "Floor tiling", "INCLUDED", "bathroom.floor_finish_system");
  }
  if (valueOf("bathroom.painting_included") === true) {
    add("paint", "Paint walls and ceiling", "INCLUDED", "bathroom.painting_included");
  }

  const customer = note.match(/Customer-supplied:\s*([^.]+)/i)?.[1] ?? "";
  for (const item of customer.split(",").map((part) => part.trim()).filter(Boolean)) {
    add(
      `customer-${item}`,
      `Customer-supplied ${item}`,
      "INCLUDED",
      "bathroom.coverage_note"
    );
  }
  if (note.includes(BATHROOM_COVERAGE_ANCILLARY)) {
    add("ancillary", BATHROOM_COVERAGE_ANCILLARY, "NOT_CONFIRMED", "bathroom.coverage_note");
  }
  if (note.includes(BATHROOM_COVERAGE_PARTIAL_LINING)) {
    add("partial-lining", BATHROOM_COVERAGE_PARTIAL_LINING, "NOT_CONFIRMED", "bathroom.coverage_note");
  }
  if (note.includes("Upstairs occupied house.")) {
    add("occupied", "Upstairs occupied house", "INCLUDED", "bathroom.coverage_note");
  }
  const levelNone = (key: string) =>
    typeof valueOf(key) === "string" &&
    String(valueOf(key)).trim().toLowerCase() === "none";
  const tradesExcluded = note.includes("Excluded trades: plumbing, electrical.");
  if (levelNone("bathroom.plumbing.level") || tradesExcluded) {
    add("plumbing-excluded", "Plumbing charges excluded", "NOT_INCLUDED", "bathroom.plumbing.level");
  }
  if (levelNone("bathroom.electrical.level") || tradesExcluded) {
    add("electrical-excluded", "Electrical charges excluded", "NOT_INCLUDED", "bathroom.electrical.level");
  }
  return rows;
}

/** This package leaves waterproofing unanswered. Do not treat that as a price assumption. */
export function bathroomWaterproofingStaysOpen(
  note: string | null | undefined
): boolean {
  return Boolean(note?.includes("Excluded trades: plumbing, electrical."));
}
