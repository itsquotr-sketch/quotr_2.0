/**
 * Deterministic Internal Walls brief extraction.
 * Groups physical walls that share frame + lining into Wall Types.
 * Does not invent optional finish, openings, or doors.
 */

import type { AIExtractionOutput } from "@/lib/ai/schema";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  applyInternalWallsFactWrite,
  createWallTypeId,
  liningProductDisplay,
  parseInternalWallsLiningProduct,
  parseInternalWallsTimberSize,
  recommendedSheetLengthMmForProduct,
  type InternalWallsLiningProduct,
  type InternalWallsTimberSize,
} from "@/lib/estimate/internal-walls-wall-types";

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
  sideA: ExtractedInternalWallsFace;
  sideB: ExtractedInternalWallsFace;
};

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
  const long = text.match(/(\d+(?:\.\d+)?)\s*m(?:etre)?s?\s+(?:long|of)/);
  if (long) return Number(long[1]);
  const is = text.match(/(?:wall is|this wall is)\s+(\d+(?:\.\d+)?)\s*m/);
  if (is) return Number(is[1]);
  return null;
}

function parseHeightM(text: string): number | null {
  const match =
    text.match(/(\d+(?:\.\d+)?)\s*m\s+high/) ??
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
  return {
    wallCount: parseWallCount(text, fallbackCount),
    lengthLm,
    heightM,
    frameSystem: timber ? "timber" : null,
    frameSize,
    sameLiningBothSides: lining.sameBoth,
    sideA: lining.sideA,
    sideB: lining.sideB,
  };
}

/**
 * Split the brief into Wall Type segments. Combined length is authoritative;
 * wall_count is metadata and must not multiply length.
 */
export function extractInternalWallsTypesFromBrief(
  briefText: string
): ExtractedInternalWallsType[] {
  const brief = normalise(briefText);
  if (
    !includesAny(brief, [
      "internal wall",
      "internal partition",
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
    if (types.length >= 2) return types;
  }

  const single = parseSegment(brief, 1);
  return single ? [single] : [];
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

export function applyExtractedInternalWallsToFacts(params: {
  facts: EstimateFact[];
  workAreaId: string;
  types: readonly ExtractedInternalWallsType[];
}): EstimateFact[] {
  let facts = params.facts;
  for (const spec of params.types) {
    const wallTypeId = createWallTypeId();
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: params.workAreaId,
      key: "internal_walls.add_wall_type",
      value: wallTypeId,
    });
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
  }
  return facts;
}

export function optionalInternalWallsFactIsInvented(
  key: string,
  briefText: string
): boolean {
  const brief = normalise(briefText);
  if (key.includes("has_openings") || key.includes("opening.")) {
    return !includesAny(brief, ["opening", "doorway", "window"]);
  }
  if (key.includes("insulation")) {
    return !includesAny(brief, ["insulat"]);
  }
  if (key.includes("skirting")) {
    return !includesAny(brief, ["skirting"]);
  }
  if (key.includes("cornice")) {
    return !includesAny(brief, ["cornice"]);
  }
  if (key.includes("electrical")) {
    return !includesAny(brief, ["electrical", "power point", "switch"]);
  }
  if (key.includes("stopping") || key.includes("stopping_included")) {
    return !includesAny(brief, ["stopping", "stop the", "level 4", "level 5"]);
  }
  if (key.includes("painting") || key.includes("painting_included")) {
    return !includesAny(brief, ["paint", "repaint"]);
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
        if (!includesAny(normalise(briefText), ["opening", "doorway", "window"])) {
          next.has_openings = null;
          next.openings = [];
          next.active_opening_id = null;
        }
        if (!includesAny(normalise(briefText), ["insulat"])) {
          next.insulation_included = null;
          next.insulation_type = null;
        }
        if (!includesAny(normalise(briefText), ["skirting"])) next.skirting = null;
        if (!includesAny(normalise(briefText), ["cornice"])) next.cornice = null;
        if (!includesAny(normalise(briefText), ["electrical", "power point"])) {
          next.electrical = null;
        }
        if (!includesAny(normalise(briefText), ["stopping", "level 4", "level 5"])) {
          next.stopping_side_a = null;
          next.stopping_side_b = null;
        }
        if (!includesAny(normalise(briefText), ["paint", "repaint"])) {
          next.painting = null;
        }
        return next;
      });
      return true;
    }
    return !optionalInternalWallsFactIsInvented(fact.key, briefText);
  });
}
