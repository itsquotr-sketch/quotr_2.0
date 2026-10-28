/**
 * Deterministic Internal Walls brief extraction.
 * Groups physical walls that share frame + lining into Wall Types.
 * Does not invent optional finish, openings, or doors.
 */

import type { AIExtractionOutput } from "@/lib/ai/schema";
import type { EstimateFact } from "@/lib/estimate/types";
import type { InternalWallsJobScope } from "@/lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  createWallTypeId,
  liningProductDisplay,
  parseInternalWallsLiningProduct,
  parseInternalWallsWallTypes,
  parseInternalWallsTimberSize,
  recommendedSheetLengthMmForProduct,
  resolveInternalWallsWallTypes,
  storedInternalWallsWallTypes,
  type InternalWallsLiningProduct,
  type InternalWallsTimberSize,
} from "@/lib/estimate/internal-walls-wall-types";
import {
  createOpeningId,
  INTERNAL_WALLS_ADD_OPENING_KEY,
  INTERNAL_WALLS_HAS_OPENINGS_KEY,
  INTERNAL_WALLS_OPENING_FIELD_PREFIX,
} from "@/lib/estimate/internal-walls-openings";
import {
  INTERNAL_WALLS_CORNICE_INCLUDED_KEY,
  INTERNAL_WALLS_CORNICE_PRODUCT_KEY,
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_CORNICE_TYPE_KEY,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_INSULATION_TYPE_KEY,
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
  type InternalWallsCorniceProduct,
  type InternalWallsCorniceType,
  type InternalWallsSideSelection,
} from "@/lib/estimate/internal-walls-finish";

export const COORDINATION_ORIGINAL_BRIEF =
  "I am renovating a house and removing 3 internal walls, I need to rebuild the walls completely. 2 of the walls are 45x90 framed timber with 13mm standard GIB on both sides (they total 9m long and are 2.4m high), and the other wall is 45x90 framed timber with 13mm standard GIB on one side and 13mm aqualine on the otherside (this wall is 3m long and 2.4m high)";

export type ExtractedInternalWallsFace = {
  product: InternalWallsLiningProduct | null;
  thicknessMm: number | null;
};

export type ExtractedInternalWallsType = {
  wallCount: number;
  lengthLm: number | null;
  heightM: number | null;
  frameSystem: "timber" | "steel" | "existing_frame" | null;
  frameSize: InternalWallsTimberSize | null;
  sameLiningBothSides: boolean | null;
  /** Explicit none from brief language. Null means openings were not stated. */
  hasOpenings: boolean | null;
  /** Explicit door-opening count. Null when the brief did not count them. */
  doorOpeningCount: number | null;
  insulationIncluded: boolean | null;
  insulationType: "acoustic" | "thermal" | "fire_acoustic" | "other" | null;
  skirting: InternalWallsSideSelection | null;
  painting: InternalWallsSideSelection | null;
  /** True when stopping is named and no level is named. False when excluded. */
  stoppingRequested: boolean | null;
  sideA: ExtractedInternalWallsFace;
  sideB: ExtractedInternalWallsFace;
  corniceIncluded?: boolean | null;
  corniceSides?: InternalWallsSideSelection | null;
  corniceType?: InternalWallsCorniceType | null;
  corniceProduct?: InternalWallsCorniceProduct | null;
};

export type ExtractedInternalWallsCornice = {
  included: boolean | null;
  sides: InternalWallsSideSelection | null;
  type: InternalWallsCorniceType | null;
  product: InternalWallsCorniceProduct | null;
};

const EXPLICIT_NO_OPENINGS_PHRASES = [
  "no openings",
  "no opening",
  "without openings",
  "no doors or windows",
  "no door or window openings",
] as const;

const EXPLICIT_NO_OPENINGS_QUALIFIERS = [
  "except",
  "excepting",
  "apart from",
  "other than",
  "besides",
  "excluding",
] as const;

function noOpeningsPhraseIsQualified(brief: string, index: number, phrase: string): boolean {
  const after = brief.slice(index + phrase.length, index + phrase.length + 48).trimStart();
  if (/^(?:up|-up)\b/.test(after)) return true;
  return EXPLICIT_NO_OPENINGS_QUALIFIERS.some(
    (marker) => after === marker || after.startsWith(`${marker} `)
  );
}

/**
 * Deterministic explicit-negative openings language.
 * Generic absence of opening information is not a “none” fact.
 */
export function briefStatesExplicitInternalWallsNoOpenings(
  briefText: string
): boolean {
  const brief = normalise(briefText);
  if (!brief) return false;
  let matched = false;
  for (const phrase of EXPLICIT_NO_OPENINGS_PHRASES) {
    let from = 0;
    while (from < brief.length) {
      const index = brief.indexOf(phrase, from);
      if (index === -1) break;
      if (noOpeningsPhraseIsQualified(brief, index, phrase)) {
        return false;
      }
      matched = true;
      from = index + phrase.length;
    }
  }
  return matched;
}

function normalise(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/otherside/g, "other side")
    .replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function canonicalTimberSizeFromText(
  text: string
): InternalWallsTimberSize | null {
  const matches = text.matchAll(/(\d{2})\s*[x×\/]\s*(\d{2})/gi);
  for (const match of matches) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const pair = [a, b].sort((x, y) => x - y).join("x");
    if (pair === "45x90") return "90x45";
    if (pair === "45x140") return "140x45";
  }
  return parseInternalWallsTimberSize(text);
}

function liningFromPhrase(
  text: string
): { product: InternalWallsLiningProduct; thicknessMm: number | null } | null {
  const thickness =
    text.match(/(\d+(?:\.\d+)?)\s*mm/) ?? text.match(/(\d+(?:\.\d+)?)mm/);
  const mm = thickness ? Number(thickness[1]) : null;
  const product = parseInternalWallsLiningProduct(
    text.includes("aqualine")
      ? "aqualine"
      : text.includes("fyreline")
        ? "fyreline"
        : text.includes("braceline")
          ? "braceline"
          : text.includes("noiseline")
            ? "noiseline"
            : text.includes("weatherline")
              ? "weatherline"
              : text.includes("barrierline")
                ? "barrierline"
                : text.includes("plywood")
                  ? "plywood"
                  : text.includes("fibre cement") || text.includes("fiber cement")
                    ? "fibre_cement"
                    : text.includes("standard gib") ||
                        text.includes("gib") ||
                        text.includes("plasterboard")
                      ? "standard_gib"
                      : null
  );
  if (!product) return null;
  return {
    product,
    thicknessMm: mm != null && Number.isFinite(mm) ? mm : null,
  };
}

function parseLengthLm(text: string): number | null {
  const total = text.match(/total(?:ling)?\s+(\d+(?:\.\d+)?)\s*m/);
  if (total) return Number(total[1]);
  const linear = text.match(
    /(\d+(?:\.\d+)?)\s*(?:linear\s+)?m(?:etre)?s?\s+(?:long|of|at)\b(?!\s+skirting)/
  );
  if (linear) return Number(linear[1]);
  const partition = text.match(
    /(\d+(?:\.\d+)?)\s*m(?:etre)?s?\s+(?:internal\s+)?(?:partition|wall)\b/
  );
  if (partition) return Number(partition[1]);
  const is = text.match(/(?:wall is|this wall is)\s+(\d+(?:\.\d+)?)\s*m/);
  if (is) return Number(is[1]);
  return null;
}

const OPENING_COUNT_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function openingCountToken(token: string): number | null {
  const word = OPENING_COUNT_WORDS[token];
  if (word != null) return word;
  const numeric = Number(token);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  return null;
}

/**
 * A counted door or door opening is an explicit wall opening.
 * "Door assembly" is a door set and is not itself an opening count.
 */
export function explicitInternalWallsOpenings(text: string): {
  hasOpenings: boolean | null;
  doorOpeningCount: number | null;
} {
  const brief = normalise(text);
  if (
    briefStatesExplicitInternalWallsNoOpenings(text) ||
    /\bno doors?\b/.test(brief) ||
    /\bwithout (?:a |any )?doors?\b/.test(brief)
  ) {
    return { hasOpenings: false, doorOpeningCount: null };
  }
  const counted = brief.match(
    /\b(one|two|three|four|five|six|\d{1,2})\s+(?:door\s+)?openings?\b/
  );
  const countedDoor = brief.match(
    /\b(one|two|three|four|five|six|\d{1,2})\s+doors?\b(?!\s+(?:assembly|sets?)\b)/
  );
  const token = counted?.[1] ?? countedDoor?.[1];
  if (token) {
    return {
      hasOpenings: true,
      doorOpeningCount: openingCountToken(token),
    };
  }
  if (/\bdoor openings?\b|\bopenings?\b/.test(brief)) {
    return { hasOpenings: true, doorOpeningCount: null };
  }
  return { hasOpenings: null, doorOpeningCount: null };
}

function topicPattern(
  topic: "painting" | "skirting" | "insulation" | "stopping" | "electrical"
): RegExp {
  const token =
    topic === "painting"
      ? "paint(?:ing)?"
      : topic === "insulation"
        ? "insulat\\w*"
        : topic === "stopping"
          ? "stopping|stop the (?:plasterboard|lining|gib|walls?)"
          : topic === "electrical"
            ? "electrical"
            : "skirting";
  return new RegExp(token, "i");
}

function briefForFinishStance(briefText: string): string {
  return normalise(briefText).replace(/\bready for painting\b/g, " ");
}

export function internalWallsTopicStance(
  briefText: string,
  topic: "painting" | "skirting" | "insulation" | "stopping" | "electrical"
): "included" | "excluded" | null {
  const brief = briefForFinishStance(briefText);
  const pattern = topicPattern(topic);
  const sentences = brief.split(/(?<=[.!?])\s+/).filter(Boolean);
  let included = false;
  let excluded = false;
  for (const sentence of sentences.length > 0 ? sentences : [brief]) {
    const exclusion = sentence.match(
      /\b(excluded|excluding|exclude|without|no)\b([\s\S]*)$/i
    );
    const word = exclusion?.[1]?.toLowerCase() ?? "";
    const tail = exclusion?.[2] ?? "";
    const head = exclusion
      ? sentence.slice(0, exclusion.index ?? sentence.length)
      : sentence;
    const topicsBeforeNegation = word === "excluded";
    if (topic === "stopping") {
      const stopsLining =
        /\bstopping\b/.test(sentence) ||
        /\bstop the (?:plasterboard|lining|gib|walls?)\b/.test(sentence);
      if (!stopsLining) continue;
    } else if (!pattern.test(sentence)) {
      continue;
    }
    if (topicsBeforeNegation) {
      if (pattern.test(head)) excluded = true;
      continue;
    }
    if (tail && pattern.test(tail)) excluded = true;
    if (pattern.test(head) || (!exclusion && pattern.test(sentence))) {
      if (topic === "stopping" && !/\bstop/.test(head) && !/\bstop/.test(sentence)) {
        continue;
      }
      included = true;
    }
  }
  if (excluded && !included) return "excluded";
  if (included) return "included";
  if (excluded) return "excluded";
  return null;
}

function parseHeightM(text: string): number | null {
  const match =
    text.match(/(\d+(?:\.\d+)?)\s*m(?:etre)?s?\s+high/) ??
    text.match(/(\d+(?:\.\d+)?)\s*high/);
  return match ? Number(match[1]) : null;
}

function parseWallCount(text: string, fallback: number): number {
  const ofThe = text.match(/(\d+)\s+of the walls/);
  if (ofThe) return Number(ofThe[1]);
  if (/\bthe other wall\b|\bthis wall\b|\bone wall\b/.test(text)) return 1;
  const walls = text.match(/(\d+)\s+walls?\b/);
  if (walls) return Number(walls[1]);
  return fallback;
}

function parseLiningSides(text: string): {
  sameBoth: boolean | null;
  sideA: ExtractedInternalWallsFace;
  sideB: ExtractedInternalWallsFace;
} {
  const empty = { product: null, thicknessMm: null };
  const mixed = text.match(
    /(.+?)\s+on one side\s+and\s+(.+?)\s+on the other/
  );
  if (mixed) {
    const sideA = liningFromPhrase(mixed[1] ?? "") ?? empty;
    const sideB = liningFromPhrase(mixed[2] ?? "") ?? empty;
    return { sameBoth: false, sideA, sideB };
  }
  if (includesAny(text, ["both sides", "either side"])) {
    const lining = liningFromPhrase(text) ?? empty;
    return { sameBoth: true, sideA: lining, sideB: lining };
  }
  const lining = liningFromPhrase(text);
  if (lining) {
    return { sameBoth: null, sideA: lining, sideB: empty };
  }
  return { sameBoth: null, sideA: empty, sideB: empty };
}

function parseSegment(text: string, fallbackCount: number): ExtractedInternalWallsType | null {
  const lining = parseLiningSides(text);
  const frameSize = canonicalTimberSizeFromText(text);
  const timber = Boolean(frameSize) || includesAny(text, ["timber", "framed timber"]);
  const lengthLm = parseLengthLm(text);
  const heightM = parseHeightM(text);
  if (!timber && !lining.sideA.product && lengthLm == null) return null;
  const openings = explicitInternalWallsOpenings(text);
  return {
    wallCount: parseWallCount(text, fallbackCount),
    lengthLm,
    heightM,
    frameSystem: timber ? "timber" : null,
    frameSize,
    sameLiningBothSides: lining.sameBoth,
    hasOpenings: openings.hasOpenings,
    doorOpeningCount: openings.doorOpeningCount,
    insulationIncluded: null,
    insulationType: null,
    skirting: null,
    painting: null,
    stoppingRequested: null,
    sideA: lining.sideA,
    sideB: lining.sideB,
  };
}

function explicitFinishBothSides(
  briefText: string,
  topic: "skirting" | "painting"
): boolean {
  const token = topic === "painting" ? "paint(?:ing)?" : "skirting";
  const pattern = new RegExp(
    `\\b${token}\\b(?:\\s+\\w+){0,3}\\s+both sides|both sides(?:\\s+\\w+){0,3}\\s+\\b${token}\\b`,
    "i"
  );
  return pattern.test(normalise(briefText));
}

function insulationTypeFromBrief(
  brief: string,
  insulation: "included" | "excluded" | null
): "acoustic" | "thermal" | "fire_acoustic" | "other" | null {
  if (insulation !== "included" || !/\bacoustic\b/.test(brief)) return null;
  const sentences = brief.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (!/\bacoustic\b/.test(sentence) || !/\binsulat/.test(sentence)) continue;
    if (/\bfire[-\s]?system\b/.test(sentence)) return "acoustic";
    if (/\bfire\b/.test(sentence)) return "fire_acoustic";
    return "acoustic";
  }
  return "acoustic";
}

function finishSideFromBrief(
  briefText: string,
  topic: "skirting" | "painting",
  stance: "included" | "excluded" | null
): "none" | "both" | null {
  if (stance === "excluded") return "none";
  if (stance === "included" && explicitFinishBothSides(briefText, topic)) {
    return "both";
  }
  return null;
}

function withBriefFinish(
  type: ExtractedInternalWallsType,
  briefText: string
): ExtractedInternalWallsType {
  const openings = explicitInternalWallsOpenings(briefText);
  const insulation = internalWallsTopicStance(briefText, "insulation");
  const painting = internalWallsTopicStance(briefText, "painting");
  const skirting = internalWallsTopicStance(briefText, "skirting");
  const stopping = internalWallsTopicStance(briefText, "stopping");
  const brief = normalise(briefText);
  return {
    ...type,
    hasOpenings: type.hasOpenings ?? openings.hasOpenings,
    doorOpeningCount: type.doorOpeningCount ?? openings.doorOpeningCount,
    insulationIncluded:
      insulation === "included" ? true : insulation === "excluded" ? false : null,
    insulationType: insulationTypeFromBrief(brief, insulation),
    skirting: finishSideFromBrief(briefText, "skirting", skirting),
    painting: finishSideFromBrief(briefText, "painting", painting),
    stoppingRequested:
      stopping === "included" ? true : stopping === "excluded" ? false : null,
  };
}

/**
 * Split the brief into Wall Type segments. Combined length is authoritative;
 * wall_count is metadata and must not multiply length.
 */
const CORNICE_SPECIALIST_TERMS = [
  "ornate",
  "decorative",
  "curved",
  "heritage",
  "custom profile",
  "fibrous plaster",
  "specialist",
] as const;

export function briefHasSpecialistCorniceLanguage(briefText: string): boolean {
  const brief = normalise(briefText);
  return CORNICE_SPECIALIST_TERMS.some((term) => brief.includes(term));
}

export function briefHasGibCoveClassicLanguage(briefText: string): boolean {
  const brief = normalise(briefText)
    .replace(/®/g, "")
    .replace(/×/g, "x")
    .replace(/-/g, " ");
  return (
    (brief.includes("gib cove classic") && brief.includes("55")) ||
    (brief.includes("55mm gib cove") && !brief.includes("ornate")) ||
    (brief.includes("55 mm gib cove") && brief.includes("cove")) ||
    /55\s*mm\s+gib\s+cove/.test(brief) ||
    /gib\s+cove\s+classic\s+55/.test(brief)
  );
}

export function extractInternalWallsCorniceFromBrief(
  briefText: string
): ExtractedInternalWallsCornice {
  const empty: ExtractedInternalWallsCornice = {
    included: null,
    sides: null,
    type: null,
    product: null,
  };
  const brief = normalise(briefText);
  const mentions =
    includesAny(brief, ["cornice", "cove", "scotia"]) ||
    briefHasGibCoveClassicLanguage(briefText);
  if (!mentions) return empty;

  const sides: InternalWallsSideSelection | null = includesAny(brief, [
    "both sides",
    "either side",
    "each side",
  ])
    ? "both"
    : includesAny(brief, ["side a", "one side only"])
      ? "side_a"
      : includesAny(brief, ["side b"])
        ? "side_b"
        : null;

  if (briefHasSpecialistCorniceLanguage(briefText)) {
    return {
      included: true,
      sides,
      type: "other_custom",
      product: null,
    };
  }

  if (briefHasGibCoveClassicLanguage(briefText)) {
    return {
      included: true,
      sides,
      type: "plaster_cornice",
      product: "gib_cove_classic_55mm_3600",
    };
  }

  if (includesAny(brief, ["mdf scotia"])) {
    return {
      included: true,
      sides,
      type: "timber_mdf_scotia",
      product: "mdf_scotia",
    };
  }
  if (includesAny(brief, ["pine scotia", "pine timber scotia"])) {
    return {
      included: true,
      sides,
      type: "timber_mdf_scotia",
      product: "pine_timber_scotia",
    };
  }
  if (includesAny(brief, ["timber scotia"])) {
    return {
      included: true,
      sides,
      type: "timber_mdf_scotia",
      product: "other_timber_scotia",
    };
  }

  if (includesAny(brief, ["plaster cornice", "cove"])) {
    return {
      included: true,
      sides,
      type: "plaster_cornice",
      product: null,
    };
  }

  return {
    included: true,
    sides,
    type: null,
    product: null,
  };
}

function withExtractedCornice(
  type: ExtractedInternalWallsType,
  cornice: ExtractedInternalWallsCornice
): ExtractedInternalWallsType {
  return {
    ...type,
    corniceIncluded: cornice.included,
    corniceSides: cornice.sides,
    corniceType: cornice.type,
    corniceProduct: cornice.product,
  };
}

/**
 * Sentences that state the wall itself. A mixed brief must not let door
 * millimetres or cladding products become Internal Walls lining.
 */
export function internalWallsScopeText(briefText: string): string {
  const sentences = briefText
    .split(/(?<=[.!?])\s+/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return briefText;
  const relevant = sentences.filter((sentence) => {
    const brief = normalise(sentence);
    return includesAny(brief, [
      "internal wall",
      "internal partition",
      "timber partition",
      "partition wall",
      "framed timber",
      "timber framed",
      "rebuild the walls",
      "rebuild walls",
      "new partition",
      "plasterboard",
      "skirting",
      "painting",
      "electrical",
      "insulat",
      "90x45",
      "90×45",
      "45x90",
      "45×90",
      "140x45",
      "140×45",
      "both sides",
      "no openings",
    ]);
  });
  return relevant.length > 0 ? relevant.join(" ") : briefText;
}

export function extractInternalWallsTypesFromBrief(
  briefText: string
): ExtractedInternalWallsType[] {
  const scoped = internalWallsScopeText(briefText);
  const brief = normalise(scoped);
  if (
    !includesAny(brief, [
      "internal wall",
      "internal partition",
      "timber partition",
      "partition wall",
      "framed timber",
      "timber framed",
      "rebuild the walls",
      "new partition",
    ])
  ) {
    return [];
  }

  const split = brief.split(
    /(?:,\s*and the other wall|,?\s+and the other wall|the other wall is)/
  );
  const segments = split.map((part) => part.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const types = segments
      .map((part, index) => parseSegment(part, index === 0 ? 2 : 1))
      .filter((row): row is ExtractedInternalWallsType => row != null);
    if (types.length >= 2) {
      const cornice = extractInternalWallsCorniceFromBrief(scoped);
      return types.map((row) =>
        withBriefFinish(withExtractedCornice(row, cornice), briefText)
      );
    }
  }

  const single = parseSegment(brief, 1);
  if (!single) return [];
  return [
    withBriefFinish(
      withExtractedCornice(single, extractInternalWallsCorniceFromBrief(scoped)),
      briefText
    ),
  ];
}

export function briefRequestsInternalWallsRebuild(briefText: string): boolean {
  const brief = normalise(briefText);
  return includesAny(brief, [
    "rebuild the walls",
    "rebuild walls",
    "rebuild completely",
    "new partition",
    "new internal wall",
    "build a partition",
    "build a new internal",
    "build a wall",
  ]);
}

export function briefRemovesExistingInternalWalls(briefText: string): boolean {
  const scoped = internalWallsScopeText(briefText);
  return scoped
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => {
      const text = normalise(sentence);
      const mentionsWall = /\b(walls?|partitions?)\b/.test(text);
      const mentionsRemoval =
        /\b(remov(?:e|ing|al)|demolish(?:ing)?|taking down|take down|strip(?:ping)? out)\b/.test(
          text
        ) || includesAny(text, ["remove existing", "remove the walls"]);
      if (!mentionsWall || !mentionsRemoval) return false;
      if (/\b(no|not|without|don't|do not)\b/.test(text)) return false;
      return true;
    });
}

function briefRebuildsOrReplacesInternalWalls(briefText: string): boolean {
  const brief = normalise(internalWallsScopeText(briefText));
  return (
    briefRequestsInternalWallsRebuild(brief) ||
    includesAny(brief, [
      "rebuild",
      "replace the walls",
      "replace the wall",
      "replace them",
      "replace with",
      "construct",
    ])
  );
}

/**
 * Existing job_scope enum: NEW / REMOVE / MIXED.
 * Remove-then-rebuild is mixed — never silently new_partition.
 */
export function classifyInternalWallsJobScopeFromBrief(
  briefText: string
): InternalWallsJobScope | null {
  const removes = briefRemovesExistingInternalWalls(briefText);
  const rebuilds = briefRebuildsOrReplacesInternalWalls(briefText);
  if (removes && rebuilds) return "mixed";
  if (removes) return "remove_partition";
  if (rebuilds) return "new_partition";
  return null;
}

function extractedWallTypeSpecIsAssigned(
  type: ExtractedInternalWallsType
): boolean {
  if (type.lengthLm == null) return false;
  if (!type.sideA.product) return false;
  if (type.sameLiningBothSides === true) return true;
  if (type.sameLiningBothSides === false) return Boolean(type.sideB.product);
  return false;
}

function extractedWallTypeSignature(type: ExtractedInternalWallsType): string {
  return [
    type.lengthLm ?? "",
    type.heightM ?? "",
    type.frameSize ?? type.frameSystem ?? "",
    type.sideA.product ?? "",
    type.sideB.product ?? "",
    type.sameLiningBothSides === true
      ? "same"
      : type.sameLiningBothSides === false
        ? "mixed"
        : "",
  ].join("|");
}

/**
 * 2+ extracted groups with incomplete or overlapping spec assignment.
 * Unambiguous distinct types (the coordination fixture) must not confirm.
 */
export function internalWallsWallTypeGroupingIsAmbiguous(
  types: readonly ExtractedInternalWallsType[]
): boolean {
  if (types.length < 2) return false;
  const complete = types.every(extractedWallTypeSpecIsAssigned);
  const signatures = types.map(extractedWallTypeSignature);
  const distinct = new Set(signatures).size === types.length;
  return !(complete && distinct);
}

function liningSelectValue(product: InternalWallsLiningProduct | null): string | null {
  return liningProductDisplay(product);
}

function applyFaceWrites(params: {
  facts: EstimateFact[];
  workAreaId: string;
  wallTypeId: string;
  heightM: number | null;
  prefix: "side_a" | "side_b";
  face: ExtractedInternalWallsFace;
}): EstimateFact[] {
  let facts = params.facts;
  const productLabel = liningSelectValue(params.face.product);
  if (!productLabel) return facts;
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: params.workAreaId,
    wallTypeId: params.wallTypeId,
    key: `internal_walls.wall_type.${params.prefix}_product`,
    value: productLabel,
  });
  if (params.face.thicknessMm != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: params.workAreaId,
      wallTypeId: params.wallTypeId,
      key: `internal_walls.wall_type.${params.prefix}_thickness_mm`,
      value: `${params.face.thicknessMm} mm`,
    });
  }
  const sheet = recommendedSheetLengthMmForProduct(
    params.face.product,
    params.heightM
  );
  if (sheet != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: params.workAreaId,
      wallTypeId: params.wallTypeId,
      key: `internal_walls.wall_type.${params.prefix}_sheet_length_mm`,
      value: `${sheet} mm`,
    });
  }
  return facts;
}

function wallTypeMatchesSpec(
  row: {
    length_lm: number | null;
    height_m: number | null;
    frame_system: string | null;
  },
  spec: {
    lengthLm: number | null;
    heightM: number | null;
    frameSystem: string | null;
  }
): boolean {
  if (spec.lengthLm != null && row.length_lm != null && row.length_lm !== spec.lengthLm) {
    return false;
  }
  if (spec.heightM != null && row.height_m != null && row.height_m !== spec.heightM) {
    return false;
  }
  if (
    spec.frameSystem &&
    row.frame_system &&
    row.frame_system !== spec.frameSystem
  ) {
    return false;
  }
  return true;
}

function takeExistingWallType(
  existing: ReturnType<typeof storedInternalWallsWallTypes>,
  spec: ExtractedInternalWallsType,
  used: Set<number>,
  extractedCount: number
) {
  const compatible = existing
    .map((row, index) => ({ row, index }))
    .filter((item) => !used.has(item.index) && wallTypeMatchesSpec(item.row, spec));
  if (compatible.length === 1) {
    used.add(compatible[0]!.index);
    return compatible[0]!.row;
  }
  if (
    compatible.length !== 1 &&
    existing.length === 1 &&
    extractedCount === 1 &&
    !used.has(0)
  ) {
    used.add(0);
    return existing[0];
  }
  return undefined;
}

export function applyExtractedInternalWallsToFacts(params: {
  facts: EstimateFact[];
  workAreaId: string;
  types: readonly ExtractedInternalWallsType[];
}): EstimateFact[] {
  const existing = storedInternalWallsWallTypes(params.facts, params.workAreaId);
  let facts = params.facts;
  const usedExisting = new Set<number>();
  for (let index = 0; index < params.types.length; index += 1) {
    const spec = params.types[index]!;
    const matched = takeExistingWallType(existing, spec, usedExisting, params.types.length);
    const wallTypeId = matched?.id ?? createWallTypeId();
    if (!matched) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        key: "internal_walls.add_wall_type",
        value: wallTypeId,
      });
    }
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: params.workAreaId,
      wallTypeId,
      key: "internal_walls.wall_type.wall_count",
      value: spec.wallCount,
    });
    if (spec.frameSystem === "timber") {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: "internal_walls.wall_type.frame_system",
        value: "Timber framing",
      });
      if (spec.frameSize === "140x45") {
        facts = applyInternalWallsFactWrite({
          facts,
          workAreaId: params.workAreaId,
          wallTypeId,
          key: "internal_walls.wall_type.frame_size",
          value: "140 mm timber framing — 140×45",
        });
      } else if (spec.frameSize === "90x45") {
        facts = applyInternalWallsFactWrite({
          facts,
          workAreaId: params.workAreaId,
          wallTypeId,
          key: "internal_walls.wall_type.frame_size",
          value: "90 mm timber framing — 90×45",
        });
      }
    }
    if (spec.lengthLm != null) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: "internal_walls.wall_type.length_lm",
        value: spec.lengthLm,
      });
    }
    if (spec.heightM != null) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: "internal_walls.wall_type.height_m",
        value: spec.heightM,
      });
    }
    facts = applyFaceWrites({
      facts,
      workAreaId: params.workAreaId,
      wallTypeId,
      heightM: spec.heightM,
      prefix: "side_a",
      face: spec.sideA,
    });
    if (spec.sameLiningBothSides === true) {
      if (!spec.sideA.product) {
        facts = applyInternalWallsFactWrite({
          facts,
          workAreaId: params.workAreaId,
          wallTypeId,
          key: "internal_walls.wall_type.side_a_lined",
          value: "Lined",
        });
      }
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: "internal_walls.wall_type.same_lining_both_sides",
        value: true,
      });
    } else if (spec.sameLiningBothSides === false) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: "internal_walls.wall_type.same_lining_both_sides",
        value: false,
      });
      facts = applyFaceWrites({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        heightM: spec.heightM,
        prefix: "side_b",
        face: spec.sideB,
      });
    }
    const existingType = matched;
    const userOwnsOpenings =
      existingType != null &&
      (existingType.has_openings === true || existingType.openings.length > 0);
    if (spec.hasOpenings === false && !userOwnsOpenings) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
        value: "No",
      });
    }
    const statedDoorOpenings = spec.doorOpeningCount ?? 0;
    if (
      spec.hasOpenings === true &&
      !userOwnsOpenings &&
      statedDoorOpenings === 0
    ) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
        value: "Yes",
      });
    }
    const savedDoorOpenings =
      existingType?.openings.filter((row) => row.type === "door" || row.type == null)
        .length ?? 0;
    if (statedDoorOpenings > 0 && savedDoorOpenings === 0) {
      const openingId = createOpeningId();
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        openingId,
        key: INTERNAL_WALLS_ADD_OPENING_KEY,
        value: openingId,
      });
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        openingId,
        key: `${INTERNAL_WALLS_OPENING_FIELD_PREFIX}type`,
        value: "Door opening",
      });
    }
    if (spec.insulationIncluded === true && existingType?.insulation_included == null) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
        value: "Yes",
      });
    }
    if (spec.insulationIncluded === false && existingType?.insulation_included == null) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
        value: "No",
      });
    }
    if (spec.insulationType && existingType?.insulation_type == null) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_INSULATION_TYPE_KEY,
        value:
          spec.insulationType === "acoustic"
            ? "Acoustic"
            : spec.insulationType === "fire_acoustic"
              ? "Fire / acoustic"
              : spec.insulationType === "thermal"
                ? "Thermal"
                : "Other",
      });
    }
    if (spec.skirting && existingType?.skirting == null) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_SKIRTING_SIDES_KEY,
        value: spec.skirting === "both" ? "Both sides" : "No",
      });
    }
    if (spec.painting && existingType?.painting == null) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_PAINTING_SIDES_KEY,
        value: spec.painting === "both" ? "Both sides" : "No",
      });
    }
    if (spec.stoppingRequested === false && existingType?.stopping_side_a == null) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
        value: "No",
      });
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
        value: "No",
      });
    }
    const userOwnsCorniceType = existingType?.cornice_type != null;
    const userOwnsCorniceProduct = existingType?.cornice_product != null;
    const userOwnsCorniceSides =
      existingType != null &&
      (existingType.cornice_included != null ||
        existingType.cornice != null);
    if (
      spec.corniceIncluded === true &&
      !userOwnsCorniceSides &&
      existingType?.cornice_included == null
    ) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_CORNICE_INCLUDED_KEY,
        value: "Yes",
      });
    }
    if (spec.corniceSides && spec.corniceSides !== "none" && !userOwnsCorniceSides) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_CORNICE_SIDES_KEY,
        value:
          spec.corniceSides === "both"
            ? "Both sides"
            : spec.corniceSides === "side_a"
              ? "Side A"
              : "Side B",
      });
    }
    if (spec.corniceType && !userOwnsCorniceType) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_CORNICE_TYPE_KEY,
        value:
          spec.corniceType === "plaster_cornice"
            ? "Plaster cornice/cove"
            : spec.corniceType === "timber_mdf_scotia"
              ? "Timber or MDF scotia"
              : spec.corniceType === "other_custom"
                ? "Other/custom"
                : "Not sure",
      });
    }
    if (
      spec.corniceProduct &&
      !userOwnsCorniceProduct &&
      (!userOwnsCorniceType || existingType?.cornice_type === spec.corniceType)
    ) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId,
        key: INTERNAL_WALLS_CORNICE_PRODUCT_KEY,
        value:
          spec.corniceProduct === "gib_cove_classic_55mm_3600"
            ? "GIB-Cove® Classic 55mm × 3.6m"
            : spec.corniceProduct === "mdf_scotia"
              ? "MDF scotia"
              : spec.corniceProduct === "pine_timber_scotia"
                ? "Pine timber scotia"
                : spec.corniceProduct === "other_timber_scotia"
                  ? "Other timber scotia"
                  : spec.corniceProduct === "other_plaster_cornice"
                    ? "Other plaster cornice"
                    : "Not sure",
      });
    }
  }
  return facts;
}

/** Explicit builder "No" answers for accessory applicability. Not a silent default. */
export function applyInternalWallsNoAccessoryScope(params: {
  facts: EstimateFact[];
  workAreaId: string;
}): EstimateFact[] {
  const resolved = resolveInternalWallsWallTypes({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  let facts = params.facts;
  const writes: Array<{ key: string; value: string }> = [
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
    { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
    { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
    { key: INTERNAL_WALLS_CORNICE_INCLUDED_KEY, value: "No" },
    { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
    { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "No" },
    { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "No" },
    { key: INTERNAL_WALLS_PAINTING_SIDES_KEY, value: "No" },
  ];
  for (const type of resolved.types) {
    for (const row of writes) {
      facts = applyInternalWallsFactWrite({
        facts,
        workAreaId: params.workAreaId,
        wallTypeId: type.id,
        key: row.key,
        value: row.value,
      });
    }
  }
  return facts;
}

export function optionalInternalWallsFactIsInvented(
  key: string,
  briefText: string
): boolean {
  const brief = normalise(briefText);
  if (key.includes("has_openings") || key.includes("opening.")) {
    if (briefStatesExplicitInternalWallsNoOpenings(briefText)) {
      return key.includes("opening.");
    }
    return explicitInternalWallsOpenings(briefText).hasOpenings == null;
  }
  if (key.includes("insulation")) {
    return internalWallsTopicStance(briefText, "insulation") == null;
  }
  if (key.includes("skirting")) {
    return internalWallsTopicStance(briefText, "skirting") == null;
  }
  if (key.includes("cornice") || key.includes("scotia") || key.includes("cove")) {
    if (key.includes("cornice_product") || key.includes("gib_cove")) {
      return !briefHasGibCoveClassicLanguage(briefText);
    }
    return !includesAny(brief, ["cornice", "cove", "scotia"]);
  }
  if (key.includes("electrical")) {
    return !includesAny(brief, ["electrical", "power point", "switch"]);
  }
  if (key.includes("stopping") || key.includes("stopping_included")) {
    return internalWallsTopicStance(briefText, "stopping") == null;
  }
  if (key.includes("painting") || key.includes("painting_included")) {
    return internalWallsTopicStance(briefText, "painting") == null;
  }
  return false;
}

export function stripInventedInternalWallsFacts(
  extraction: AIExtractionOutput,
  briefText: string
): void {
  extraction.facts = extraction.facts.filter((fact) => {
    if (!fact.key.startsWith("internal_walls.")) return true;
    if (fact.key === "internal_walls.wall_types") {
      if (!Array.isArray(fact.value)) return true;
      fact.value = (fact.value as Record<string, unknown>[]).map((row) => {
        const next = { ...row };
        if (briefStatesExplicitInternalWallsNoOpenings(briefText)) {
          next.has_openings = false;
          next.openings = [];
          next.active_opening_id = null;
        } else if (explicitInternalWallsOpenings(briefText).hasOpenings == null) {
          next.has_openings = null;
          next.openings = [];
          next.active_opening_id = null;
        }
        const insulationStance = internalWallsTopicStance(briefText, "insulation");
        if (insulationStance == null) {
          next.insulation_included = null;
          next.insulation_type = null;
        } else if (insulationStance === "excluded") {
          next.insulation_included = false;
          next.insulation_type = null;
        } else if (!normalise(briefText).includes("acoustic") && !normalise(briefText).includes("thermal")) {
          next.insulation_type = null;
        }
        const skirtingStance = internalWallsTopicStance(briefText, "skirting");
        if (skirtingStance === "excluded") next.skirting = "none";
        else if (skirtingStance == null) next.skirting = null;
        else if (
          next.skirting === "both" &&
          !explicitFinishBothSides(briefText, "skirting")
        ) {
          next.skirting = null;
        }
        if (!includesAny(normalise(briefText), ["cornice", "cove", "scotia"])) {
          next.cornice_included = null;
          next.cornice = null;
          next.cornice_type = null;
          next.cornice_product = null;
          next.cornice_note = null;
        } else if (briefHasSpecialistCorniceLanguage(briefText)) {
          next.cornice_type = "other_custom";
          if (next.cornice_product === "gib_cove_classic_55mm_3600") {
            next.cornice_product = null;
          }
        } else if (
          !briefHasGibCoveClassicLanguage(briefText) &&
          next.cornice_product === "gib_cove_classic_55mm_3600"
        ) {
          next.cornice_product = null;
        }
        if (internalWallsTopicStance(briefText, "electrical") === "excluded") {
          next.electrical = "none";
        } else if (!includesAny(normalise(briefText), ["electrical", "power point"])) {
          next.electrical = null;
        }
        const stoppingStance = internalWallsTopicStance(briefText, "stopping");
        if (stoppingStance === "excluded") {
          next.stopping_side_a = "none";
          next.stopping_side_b = "none";
        } else if (
          stoppingStance == null ||
          !includesAny(normalise(briefText), ["level 4", "level 5"])
        ) {
          next.stopping_side_a = null;
          next.stopping_side_b = null;
        }
        const paintingStance = internalWallsTopicStance(briefText, "painting");
        if (paintingStance === "excluded") next.painting = "none";
        else if (paintingStance == null) next.painting = null;
        else if (
          next.painting === "both" &&
          !explicitFinishBothSides(briefText, "painting")
        ) {
          next.painting = null;
        }
        return next;
      });
      return true;
    }
    if (fact.key === "internal_walls.skirtings_included") {
      const stance = internalWallsTopicStance(briefText, "skirting");
      if (stance === "excluded") fact.value = false;
      if (stance == null) return false;
    }
    if (fact.key === "internal_walls.painting_included") {
      const stance = internalWallsTopicStance(briefText, "painting");
      if (stance === "excluded") fact.value = false;
      if (stance == null) return false;
    }
    return !optionalInternalWallsFactIsInvented(fact.key, briefText);
  });
}

/**
 * Reanalysis keeps a wall type id when the geometry does not conflict.
 * One door opening keeps its saved id and dimensions. Positional indexes
 * are not an identity. Ambiguous pairs are left as extracted rows.
 */
export function mergePersistedInternalWallTypesOnReanalyse(params: {
  readonly extracted: unknown;
  readonly persisted: unknown;
}) {
  const extracted = parseInternalWallsWallTypes(params.extracted);
  const persisted = parseInternalWallsWallTypes(params.persisted);
  if (persisted.length === 0) return extracted;
  if (extracted.length === 0) return persisted;
  const used = new Set<number>();
  return extracted.map((row) => {
    const compatible = persisted
      .map((item, index) => ({ item, index }))
      .filter(
        (entry) =>
          !used.has(entry.index) &&
          wallTypeMatchesSpec(entry.item, {
            lengthLm: row.length_lm,
            heightM: row.height_m,
            frameSystem: row.frame_system,
          })
      );
    const unique = compatible.length === 1 ? compatible[0] : undefined;
    const sole =
      unique ??
      (persisted.length === 1 && extracted.length === 1 && !used.has(0)
        ? { item: persisted[0]!, index: 0 }
        : undefined);
    if (!sole) return row;
    used.add(sole.index);
    const next = { ...row, id: sole.item.id };
    const savedDoor = sole.item.openings.find((opening) => opening.type === "door");
    const extractedDoors = row.openings.filter((opening) => opening.type === "door");
    if (savedDoor && extractedDoors.length === 1) {
      next.openings = row.openings.map((opening) =>
        opening.type === "door" ? { ...savedDoor } : opening
      );
      next.active_opening_id = savedDoor.id;
    }
    return next;
  });
}
