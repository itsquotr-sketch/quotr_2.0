/**
 * DOORS-02 — deterministic brief extraction into `doors.portions`.
 *
 * Structures explicit Door Sets. Does not invent width, quantity, or
 * hardware. Height 1980 is a disclosed application default, not an
 * extracted claim. Specialist language is never rewritten as ordinary.
 */

import type { AIExtractionOutput } from "@/lib/ai/schema";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  applyDoorsFactWrite,
  cloneDoorPortion,
  createEmptyDoorPortion,
  DOORS_HEIGHT_DISCLOSED_DEFAULT_MM,
  DOORS_HEIGHT_MM_VALUES,
  DOORS_PORTIONS_FACT_KEY,
  DOORS_WIDTH_MM_VALUES,
  normalizeExtractedDoorPortions,
  parseDoorsPortions,
  type DoorHeightMm,
  type DoorInstallationType,
  type DoorLeafConstruction,
  type DoorPortion,
  type DoorSpecialistKind,
  type DoorWidthMm,
} from "@/lib/estimate/doors-portions";

const HEIGHT_SET = new Set<number>(DOORS_HEIGHT_MM_VALUES);
const WIDTH_SET = new Set<number>(DOORS_WIDTH_MM_VALUES);

const QUANTITY_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const PREHUNG_PHRASES = [
  "prehung",
  "pre-hung",
  "complete door set",
  "door and jamb",
  "door, jamb and stops",
  "door, jamb, and stops",
  "door set with frame",
] as const;

const REPLACEMENT_PHRASES = [
  "replacement door leaf",
  "replacement leaf",
  "replace the door leaf",
  "replace the damaged leaf",
  "replace damaged leaf",
  "fit into existing frame",
  "fitted into an existing frame",
  "fitted to an existing",
  "reuse existing jamb",
  "reuse existing frame",
  "existing frame retained",
  "existing jamb retained",
  "leaf only",
] as const;

const HARDWARE_INCLUDED_PHRASES = [
  "include standard hardware",
  "including standard hardware",
  "with standard hardware",
  "standard latch",
  "standard lever",
  "include door furniture",
  "including door furniture",
  "supply and install hardware",
  "hardware included",
] as const;

const HARDWARE_EXCLUDED_PHRASES = [
  "reuse existing hardware",
  "using the existing hardware",
  "existing hardware reused",
  "hardware by others",
  "exclude hardware",
  "excluding hardware",
  "no hardware",
  "without hardware",
  "client-supplied hardware",
  "client supplied hardware",
] as const;

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  const raw = normalise(text);
  return phrases.some((phrase) => raw.includes(phrase));
}

export function canonicalDoorSpecialistKindFromText(
  text: string
): DoorSpecialistKind | null {
  const raw = normalise(text);
  if (
    includesAny(raw, ["fire-rated", "fire rated", "fire door", "fire-door"])
  ) {
    return "fire_rated";
  }
  if (includesAny(raw, ["acoustic-rated", "acoustic rated", "acoustic door"])) {
    return "acoustic";
  }
  if (includesAny(raw, ["cavity slider", "cavity sliding", "pocket door"])) {
    return "cavity_slider";
  }
  if (includesAny(raw, ["barn door"])) return "barn";
  if (includesAny(raw, ["bifold", "bi-fold", "bi fold"])) return "bifold";
  if (includesAny(raw, ["automatic door", "auto door"])) return "automatic";
  if (includesAny(raw, ["access control", "security door"])) {
    return "security_access_control";
  }
  if (
    includesAny(raw, [
      "aluminium door",
      "aluminum door",
      "aluminium entrance",
      "aluminum entrance",
    ])
  ) {
    return "aluminium";
  }
  if (
    includesAny(raw, [
      "exterior door",
      "external door",
      "entrance door",
      "exterior",
    ]) &&
    /\bdoors?\b/.test(raw)
  ) {
    return "exterior";
  }
  if (
    includesAny(raw, [
      "specialist glazed",
      "glazed door",
      "fully glazed",
    ])
  ) {
    return "glazed_specialist";
  }
  if (includesAny(raw, ["oversized", "over sized", "over-size"])) {
    return "oversized";
  }
  if (includesAny(raw, ["multi-panel", "multi panel", "multipanel"])) {
    return "other_unsupported";
  }
  if (
    includesAny(raw, [
      "heritage",
      "custom joinery",
      "specialist door",
      "non-standard door",
      "non standard door",
    ])
  ) {
    return "heritage_custom";
  }
  return null;
}

function isCustomConventionalReplacement(text: string): boolean {
  const raw = normalise(text);
  if (canonicalDoorSpecialistKindFromText(raw) != null) {
    if (
      !includesAny(raw, ["heritage", "custom joinery"]) ||
      canonicalDoorSpecialistKindFromText(raw) !== "heritage_custom"
    ) {
      return false;
    }
  }
  const customLeaf =
    /\bcustom\b/.test(raw) ||
    /\bjoinery\b/.test(raw) ||
    /\bhardwood leaf\b/.test(raw) ||
    /\bsolid timber leaf\b/.test(raw) ||
    /\btimber leaf\b/.test(raw);
  if (!customLeaf) return false;
  const existingFrame =
    includesAny(raw, REPLACEMENT_PHRASES) ||
    /\bexisting frame\b/.test(raw) ||
    /\bexisting jamb\b/.test(raw);
  if (!existingFrame) return false;
  const conventional =
    /\bhinged\b/.test(raw) ||
    /\bconventional\b/.test(raw) ||
    /\bsingle\b/.test(raw) ||
    /\binternal leaf\b/.test(raw) ||
    /\binternal door leaf\b/.test(raw);
  return conventional;
}

export function installationTypeFromSnippet(
  text: string
): DoorInstallationType | null {
  const raw = normalise(text);
  const specialist = canonicalDoorSpecialistKindFromText(raw);
  if (specialist && !isCustomConventionalReplacement(raw)) {
    return "other_unsupported";
  }
  if (includesAny(raw, PREHUNG_PHRASES)) return "prehung_internal";
  if (includesAny(raw, REPLACEMENT_PHRASES)) return "replacement_leaf";
  if (
    /\b(?:door )?lea(?:f|ves)\b/.test(raw) &&
    /\bexisting (?:frame|jamb)\b/.test(raw)
  ) {
    return "replacement_leaf";
  }
  if (isCustomConventionalReplacement(raw)) return "replacement_leaf";
  return null;
}

export function leafConstructionFromSnippet(
  text: string
): DoorLeafConstruction | null {
  const raw = normalise(text);
  if (/\bhollow[-\s]?core\b/.test(raw)) return "hollow_core";
  if (/\bsolid[-\s]?core\b/.test(raw)) return "solid_core";
  if (isCustomConventionalReplacement(raw)) return "other";
  return null;
}

function hardwareFromSnippet(text: string): boolean | null {
  const raw = normalise(text);
  if (includesAny(raw, HARDWARE_EXCLUDED_PHRASES)) return false;
  if (includesAny(raw, HARDWARE_INCLUDED_PHRASES)) return true;
  return null;
}

function quantityFromSnippet(text: string): number | null {
  const raw = normalise(text);
  const word = Object.keys(QUANTITY_WORDS)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const tokenGroup = `(\\d{1,2}|${word})`;
  const patterned = raw.match(
    new RegExp(
      `\\b${tokenGroup}\\s+(?:identical\\s+)?(?:door leaves|door leaf|doors|door)\\b`
    )
  );
  const leading = raw.match(
    new RegExp(
      `^(?:(?:supply and install|fit|replace(?: the)?|install)\\s+)?${tokenGroup}\\b`
    )
  );
  const nearby = raw.match(
    new RegExp(
      `\\b${tokenGroup}\\b(?=[\\s\\S]{0,80}\\b(?:doors?|door leaves?|leaves?)\\b)`
    )
  );
  const beforeDim = raw.match(
    new RegExp(`\\b${tokenGroup}\\s+\\d{3,4}\\s*(?:mm)?\\s*[x×]`)
  );
  const token =
    patterned?.[1] ?? leading?.[1] ?? beforeDim?.[1] ?? nearby?.[1] ?? "";
  if (!token) return null;
  const fromWord = QUANTITY_WORDS[token];
  if (fromWord != null) return fromWord;
  const numeric = Number(token);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric < 100) return numeric;
  return null;
}

function locationFromSnippet(text: string): string | null {
  const bedroom = text.match(/\bbedroom doors?\b/i);
  if (bedroom) return "Bedroom doors";
  const ensuite = text.match(/\bensuite\b/i);
  if (ensuite) return "Ensuite";
  const level = text.match(/\blevel\s+(\d+)\b/i);
  if (level) return `Level ${level[1]}`;
  const units = text.match(/\bunits?\s+(\d+)\s*[–-]\s*(\d+)\b/i);
  if (units) return `Units ${units[1]}–${units[2]}`;
  return null;
}

function asHeight(value: number): DoorHeightMm | null {
  return HEIGHT_SET.has(value) ? (value as DoorHeightMm) : null;
}

function asWidth(value: number): DoorWidthMm | null {
  return WIDTH_SET.has(value) ? (value as DoorWidthMm) : null;
}

function parseLabelledDimensions(text: string): {
  height: DoorHeightMm | null;
  width: DoorWidthMm | null;
  unsupported: number[];
} {
  const unsupported: number[] = [];
  let height: DoorHeightMm | null = null;
  let width: DoorWidthMm | null = null;

  const highByWide = text.match(
    /(\d{3,4})\s*(?:mm)?\s*high(?:ht)?(?:\s+by\s+|\s*[x×]\s*)(\d{3,4})\s*(?:mm)?\s*wide/i
  );
  const wideByHigh = text.match(
    /(\d{3,4})\s*(?:mm)?\s*wide(?:\s+by\s+|\s*[x×]\s*)(\d{3,4})\s*(?:mm)?\s*high/i
  );
  const labelledHigh = text.match(/(\d{3,4})\s*(?:mm)?\s*(?:high|height)\b/i);
  const labelledWide = text.match(/(\d{3,4})\s*(?:mm)?\s*(?:wide|width)\b/i);
  const reverseHigh = text.match(
    /\b(?:high|height)\s*(?:of\s+)?(\d{3,4})\s*(?:mm)?/i
  );
  const reverseWide = text.match(
    /\b(?:wide|width)\s*(?:of\s+)?(\d{3,4})\s*(?:mm)?/i
  );

  if (highByWide) {
    const h = Number(highByWide[1]);
    const w = Number(highByWide[2]);
    height = asHeight(h);
    width = asWidth(w);
    if (height == null) unsupported.push(h);
    if (width == null) unsupported.push(w);
    return { height, width, unsupported };
  }
  if (wideByHigh) {
    const w = Number(wideByHigh[1]);
    const h = Number(wideByHigh[2]);
    height = asHeight(h);
    width = asWidth(w);
    if (height == null) unsupported.push(h);
    if (width == null) unsupported.push(w);
    return { height, width, unsupported };
  }

  const highN = labelledHigh
    ? Number(labelledHigh[1])
    : reverseHigh
      ? Number(reverseHigh[1])
      : null;
  const wideN = labelledWide
    ? Number(labelledWide[1])
    : reverseWide
      ? Number(reverseWide[1])
      : null;
  if (highN != null) {
    height = asHeight(highN);
    if (height == null) unsupported.push(highN);
  }
  if (wideN != null) {
    width = asWidth(wideN);
    if (width == null) unsupported.push(wideN);
  }
  return { height, width, unsupported };
}

function parseUnlabelledPair(text: string): {
  height: DoorHeightMm | null;
  width: DoorWidthMm | null;
  unsupported: number[];
} | null {
  const match = text.match(
    /(\d{3,4})\s*(?:mm)?\s*[x×]\s*(\d{3,4})\s*(?:mm)?(?:\s*door)?/i
  );
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  const aH = asHeight(a);
  const aW = asWidth(a);
  const bH = asHeight(b);
  const bW = asWidth(b);
  const unsupported: number[] = [];

  if (aH && bW && !aW && !bH) {
    return { height: aH, width: bW, unsupported };
  }
  if (aW && bH && !aH && !bW) {
    return { height: bH, width: aW, unsupported };
  }
  if (aH && bW) {
    return { height: aH, width: bW, unsupported };
  }
  if (aW && bH) {
    return { height: bH, width: aW, unsupported };
  }
  if (!HEIGHT_SET.has(a) && !WIDTH_SET.has(a)) unsupported.push(a);
  if (!HEIGHT_SET.has(b) && !WIDTH_SET.has(b)) unsupported.push(b);
  if (aH && !bW && !bH) {
    if (!WIDTH_SET.has(b) && !HEIGHT_SET.has(b)) unsupported.push(b);
    return { height: aH, width: null, unsupported };
  }
  if (bH && !aW && !aH) {
    if (!WIDTH_SET.has(a) && !HEIGHT_SET.has(a)) unsupported.push(a);
    return { height: bH, width: null, unsupported };
  }
  if (aW && !bH && !bW) {
    if (!HEIGHT_SET.has(b) && !WIDTH_SET.has(b)) unsupported.push(b);
    return { height: null, width: aW, unsupported };
  }
  if (bW && !aH && !aW) {
    if (!HEIGHT_SET.has(a) && !WIDTH_SET.has(a)) unsupported.push(a);
    return { height: null, width: bW, unsupported };
  }
  return { height: null, width: null, unsupported };
}

export function dimensionsFromSnippet(text: string): {
  height: DoorHeightMm | null;
  width: DoorWidthMm | null;
  unsupportedNote: string | null;
} {
  const labelled = parseLabelledDimensions(text);
  if (labelled.height != null || labelled.width != null) {
    return {
      height: labelled.height,
      width: labelled.width,
      unsupportedNote:
        labelled.unsupported.length > 0
          ? `${labelled.unsupported.join(" × ")} mm`
          : null,
    };
  }
  const hasHigh = /\b(?:high|height)\b/i.test(text);
  const hasWide = /\b(?:wide|width)\b/i.test(text);
  if (hasHigh || hasWide) {
    return {
      height: labelled.height,
      width: labelled.width,
      unsupportedNote:
        labelled.unsupported.length > 0
          ? `${labelled.unsupported.join(" × ")} mm`
          : null,
    };
  }
  const pair = parseUnlabelledPair(text);
  if (!pair) {
    return { height: null, width: null, unsupportedNote: null };
  }
  return {
    height: pair.height,
    width: pair.width,
    unsupportedNote:
      pair.unsupported.length > 0 ? `${pair.unsupported.join(" × ")} mm` : null,
  };
}

function snippetHasDoorSignal(text: string): boolean {
  const raw = normalise(text);
  return (
    /\bdoors?\b/.test(raw) ||
    /\bleaf\b|\bleaves\b/.test(raw) ||
    /\bprehung\b|\bpre-hung\b/.test(raw) ||
    canonicalDoorSpecialistKindFromText(raw) != null ||
    dimensionsFromSnippet(text).height != null ||
    dimensionsFromSnippet(text).width != null
  );
}

function splitDoorSetSnippets(briefText: string): string[] {
  const trimmed = briefText.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(
      /\s*(?:\bplus\b|\band also\b|\band then\b|;|\band\s+(?=(?:one|two|three|\d{1,2})\s+))\s*/i
    )
    .map((row) => row.trim())
    .filter(Boolean);
  const withSignal = parts.filter(snippetHasDoorSignal);
  if (withSignal.length >= 2) return withSignal;
  return [trimmed];
}

function conciseDescription(snippet: string): string {
  const collapsed = snippet.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 160) return collapsed;
  return `${collapsed.slice(0, 157).trim()}…`;
}

function applySnippetToPortion(portion: DoorPortion, snippet: string): void {
  const specialist = canonicalDoorSpecialistKindFromText(snippet);
  const customReplacement = isCustomConventionalReplacement(snippet);
  const dims = dimensionsFromSnippet(snippet);
  const quantity = quantityFromSnippet(snippet);
  const hardware = hardwareFromSnippet(snippet);
  const label = locationFromSnippet(snippet);
  const leaf = leafConstructionFromSnippet(snippet);
  const installation = installationTypeFromSnippet(snippet);

  if (specialist && !customReplacement) {
    portion.installation_type = "other_unsupported";
    portion.installation_authority = "extracted";
    portion.specialist_kind = specialist;
    portion.height_mm = dims.height;
    portion.height_authority = dims.height != null ? "extracted" : undefined;
    if (dims.height == null) {
      portion.height_mm = null;
      portion.height_authority = undefined;
    }
    portion.width_mm = dims.width;
    if (dims.width != null) portion.width_authority = "extracted";
    portion.quantity = quantity;
    if (quantity != null) portion.quantity_authority = "extracted";
    portion.other_description = conciseDescription(snippet);
    portion.other_description_authority = "extracted";
    if (label) {
      portion.label = label;
      portion.label_authority = "extracted";
    }
    return;
  }

  if (installation) {
    portion.installation_type = installation;
    portion.installation_authority = "extracted";
  }
  if (leaf) {
    portion.leaf_construction = leaf;
    portion.leaf_authority = "extracted";
  }
  if (dims.height != null) {
    portion.height_mm = dims.height;
    portion.height_authority = "extracted";
  } else if (dims.unsupportedNote) {
    portion.height_mm = null;
    portion.height_authority = undefined;
  }
  if (dims.width != null) {
    portion.width_mm = dims.width;
    portion.width_authority = "extracted";
  }
  if (quantity != null) {
    portion.quantity = quantity;
    portion.quantity_authority = "extracted";
  }
  if (hardware != null) {
    portion.hardware_included = hardware;
    portion.hardware_authority = "extracted";
  }
  if (label) {
    portion.label = label;
    portion.label_authority = "extracted";
  }
  if (leaf === "other" || dims.unsupportedNote) {
    const note = [
      leaf === "other" ? conciseDescription(snippet) : null,
      dims.unsupportedNote,
    ]
      .filter(Boolean)
      .join(" · ");
    if (note) {
      portion.other_description = note;
      portion.other_description_authority = "extracted";
    }
  }
}

export function extractDoorPortionsFromBrief(briefText: string): DoorPortion[] {
  const snippets = splitDoorSetSnippets(briefText);
  const portions: DoorPortion[] = [];
  for (const snippet of snippets) {
    if (!snippetHasDoorSignal(snippet) && snippets.length > 1) continue;
    const portion = createEmptyDoorPortion({
      label: locationFromSnippet(snippet),
    });
    applySnippetToPortion(portion, snippet);
    portions.push(portion);
  }
  if (portions.length === 0 && briefText.trim()) {
    const fallback = createEmptyDoorPortion();
    applySnippetToPortion(fallback, briefText);
    if (
      fallback.installation_type != null ||
      fallback.leaf_construction != null ||
      fallback.width_mm != null ||
      fallback.quantity != null ||
      fallback.hardware_included != null ||
      fallback.specialist_kind != null
    ) {
      portions.push(fallback);
    }
  }
  return portions;
}

function firstPresent<T>(explicit: T, fallback: T): T {
  if (explicit == null || explicit === "") return fallback;
  return explicit;
}

function fillMissingDoorPortion(
  primary: DoorPortion,
  secondary: DoorPortion
): DoorPortion {
  const out = cloneDoorPortion(primary);
  out.label = firstPresent(out.label, secondary.label);
  out.installation_type = firstPresent(
    out.installation_type,
    secondary.installation_type
  );
  out.leaf_construction = firstPresent(
    out.leaf_construction,
    secondary.leaf_construction
  );
  out.height_mm = firstPresent(out.height_mm, secondary.height_mm);
  out.width_mm = firstPresent(out.width_mm, secondary.width_mm);
  out.quantity = firstPresent(out.quantity, secondary.quantity);
  out.hardware_included = firstPresent(
    out.hardware_included,
    secondary.hardware_included
  );
  out.other_description = firstPresent(
    out.other_description,
    secondary.other_description
  );
  out.specialist_kind = firstPresent(
    out.specialist_kind,
    secondary.specialist_kind
  );
  out.installation_authority =
    out.installation_authority ?? secondary.installation_authority;
  out.leaf_authority = out.leaf_authority ?? secondary.leaf_authority;
  out.height_authority = out.height_authority ?? secondary.height_authority;
  out.width_authority = out.width_authority ?? secondary.width_authority;
  out.quantity_authority =
    out.quantity_authority ?? secondary.quantity_authority;
  out.hardware_authority =
    out.hardware_authority ?? secondary.hardware_authority;
  out.label_authority = out.label_authority ?? secondary.label_authority;
  out.other_description_authority =
    out.other_description_authority ?? secondary.other_description_authority;
  if (
    out.installation_type === "other_unsupported" ||
    secondary.installation_type === "other_unsupported"
  ) {
    out.installation_type = "other_unsupported";
    out.specialist_kind = out.specialist_kind ?? secondary.specialist_kind;
    if (out.height_mm === DOORS_HEIGHT_DISCLOSED_DEFAULT_MM &&
      out.height_authority === "assumed_disclosed" &&
      secondary.height_mm == null
    ) {
      out.height_mm = null;
      out.height_authority = undefined;
    }
  }
  return out;
}

function matchAiPortion(
  parsed: DoorPortion,
  aiPortions: readonly DoorPortion[],
  index: number,
  used: Set<number>
): DoorPortion | null {
  const label = parsed.label?.trim().toLowerCase();
  if (label) {
    const byLabel = aiPortions.findIndex(
      (row, i) => !used.has(i) && row.label?.trim().toLowerCase() === label
    );
    if (byLabel >= 0) {
      used.add(byLabel);
      return aiPortions[byLabel] ?? null;
    }
  }
  if (!used.has(index) && aiPortions[index]) {
    used.add(index);
    return aiPortions[index] ?? null;
  }
  return null;
}

/**
 * Deterministic parser is authoritative over unsafe AI ordinary
 * classification. AI may fill genuinely missing safe fields only.
 */
export function mergeDoorPortionsPreferringDeterministic(
  aiPortions: readonly DoorPortion[],
  parsedPortions: readonly DoorPortion[]
): DoorPortion[] {
  const parsed = parsedPortions.map(cloneDoorPortion);
  const ai = normalizeExtractedDoorPortions(aiPortions);
  if (parsed.length > 0) {
    const used = new Set<number>();
    return parsed.map((portion, index) => {
      const match = matchAiPortion(portion, ai, index, used);
      if (!match) return portion;
      if (
        portion.installation_type === "other_unsupported" &&
        match.installation_type !== "other_unsupported"
      ) {
        return portion;
      }
      if (
        match.installation_type === "other_unsupported" &&
        portion.installation_type !== "other_unsupported"
      ) {
        return fillMissingDoorPortion(match, portion);
      }
      return fillMissingDoorPortion(portion, match);
    });
  }
  return ai.map(cloneDoorPortion);
}

function doorsPortionsFactNameMatches(
  factName: string | null | undefined,
  wanted?: string | null
): boolean {
  const name = factName ?? "";
  if (wanted != null && wanted !== "") {
    return name === wanted || name === "";
  }
  return true;
}

export function readAiDoorPortionsFromExtraction(
  extraction: AIExtractionOutput,
  workAreaName?: string
): DoorPortion[] {
  const facts = extraction.facts.filter(
    (fact) =>
      fact.key === DOORS_PORTIONS_FACT_KEY &&
      fact.work_area_type === "doors" &&
      doorsPortionsFactNameMatches(fact.work_area_name, workAreaName)
  );
  const out: DoorPortion[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    for (const portion of normalizeExtractedDoorPortions(fact.value)) {
      if (seen.has(portion.id)) continue;
      seen.add(portion.id);
      out.push(portion);
    }
  }
  return out;
}

export function applyExtractedDoorsToFacts(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly portions: readonly DoorPortion[];
}): EstimateFact[] {
  return applyDoorsFactWrite({
    facts: params.facts,
    workAreaId: params.workAreaId,
    key: DOORS_PORTIONS_FACT_KEY,
    value: [...params.portions],
    factSource: "ai_extracted",
  });
}

export function seedExtractedDoorsFact(
  extraction: AIExtractionOutput,
  params: {
    readonly portions: readonly DoorPortion[];
    readonly workAreaName?: string;
  }
): void {
  const seeded = applyExtractedDoorsToFacts({
    facts: [],
    workAreaId: "extract",
    portions: params.portions,
  });
  const portions = seeded.find((row) => row.key === DOORS_PORTIONS_FACT_KEY)
    ?.value;
  if (!Array.isArray(portions) && !(portions && typeof portions === "object")) {
    return;
  }
  const parsed = parseDoorsPortions(portions);
  if (parsed.length === 0) return;
  extraction.facts = extraction.facts.filter(
    (fact) =>
      !(
        fact.key === DOORS_PORTIONS_FACT_KEY &&
        fact.work_area_type === "doors" &&
        doorsPortionsFactNameMatches(fact.work_area_name, params.workAreaName)
      )
  );
  extraction.facts.push({
    work_area_type: "doors",
    work_area_name: params.workAreaName,
    key: DOORS_PORTIONS_FACT_KEY,
    label: "Door sets",
    value: parsed as unknown as Record<string, unknown>[],
    confidence: 0.9,
  });
}

const LEGACY_DOOR_FACT_KEYS = new Set([
  "doors.count",
  "doors.door_type",
  "doors.supply_scope",
  "doors.prehung",
  "doors.frames_included",
  "doors.hardware_install_included",
  "doors.hardware_client_supplied",
  "doors.client_supplied",
  "doors.architraves_included",
  "doors.painting_included",
  "doors.existing_removal",
]);

export function stripLegacyDoorFactsFromExtraction(
  extraction: AIExtractionOutput
): void {
  extraction.facts = extraction.facts.filter(
    (fact) => !LEGACY_DOOR_FACT_KEYS.has(fact.key)
  );
}
