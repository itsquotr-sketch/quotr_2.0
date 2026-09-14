/**
 * CEILINGS WA-03B — deterministic brief extraction / synonym normalisation.
 *
 * Structures extracted facts into Ceiling Portions. Does not invent
 * dimensions, drop height, sheet type, fire systems, or bulkhead sizes.
 */

import type { AIExtractionOutput } from "@/lib/ai/schema";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  applyCeilingsFactWrite,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  createEmptyCeilingBulkhead,
  normalizeExtractedCeilingPortions,
  parseCeilingPortion,
  type CeilingJobScope,
  type CeilingLiningFamily,
  type CeilingPlasterboardProduct,
  type CeilingPortion,
  type CeilingStructureFamily,
} from "@/lib/estimate/ceilings-portions";
import { canonicalCeilingSpecialistKindFromText } from "@/lib/estimate/ceilings-specialist";

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function canonicalCeilingStructureFamilyFromText(
  text: string
): CeilingStructureFamily | null {
  const raw = normalise(text);
  if (
    includesAny(raw, [
      "tile and grid",
      "tile & grid",
      "t-bar",
      "t bar",
      "tbar",
      "ceiling tile",
      "ceiling tiles",
      "grid ceiling",
      "suspended grid",
    ])
  ) {
    return "tile_and_grid";
  }
  if (
    includesAny(raw, [
      "drop ceiling",
      "dropped ceiling",
      "suspended ceiling",
      "suspended steel",
      "hung ceiling",
      "dropper",
    ])
  ) {
    return "suspended_steel";
  }
  if (
    includesAny(raw, [
      "steel direct-fix",
      "steel direct fix",
      "direct fix steel",
      "direct-fix steel",
      "steel battens",
      "steel batten",
      "rondo",
      "steel furring",
      "furring channel",
    ])
  ) {
    return "steel_direct_fix";
  }
  if (
    includesAny(raw, [
      "timber direct-fix",
      "timber direct fix",
      "new timber framing",
      "timber framing",
      "timber battens",
      "timber batten",
      "timber joists",
    ])
  ) {
    return "timber_direct_fix";
  }
  if (
    includesAny(raw, [
      "existing framing",
      "existing structure",
      "existing joists",
      "existing joist",
      "existing ceiling framing",
      "existing ceiling",
      "existing ceilings",
      "reline existing",
    ])
  ) {
    return "existing_framing";
  }
  return null;
}

export function canonicalCeilingLiningFamilyFromText(
  text: string
): CeilingLiningFamily | null {
  const raw = normalise(text);
  if (
    includesAny(raw, [
      "tile and grid",
      "tile & grid",
      "t-bar",
      "t bar",
      "tbar",
      "ceiling tile",
      "ceiling tiles",
    ])
  ) {
    return "tile_and_grid";
  }
  if (
    includesAny(raw, ["timber lined", "timber lining", "timber board ceiling"])
  ) {
    return "timber_lined";
  }
  if (includesAny(raw, ["plywood", "ply ceiling"])) return "plywood";
  if (
    includesAny(raw, [
      "gib",
      "plasterboard",
      "plaster board",
      "standard gib",
      "fyreline",
      "aqualine",
    ])
  ) {
    return "plasterboard";
  }
  return null;
}

export function canonicalCeilingPlasterboardProductFromText(
  text: string
): CeilingPlasterboardProduct | null {
  const raw = normalise(text);
  if (raw.includes("fyreline")) return "fyreline";
  if (raw.includes("aqualine")) return "aqualine";
  if (includesAny(raw, ["standard gib", "13mm standard", "standard plasterboard"])) {
    return "standard";
  }
  if (raw.includes("standard") && (raw.includes("gib") || raw.includes("plasterboard"))) {
    return "standard";
  }
  return null;
}

const PLASTERBOARD_THICKNESS_CONTEXT = [
  "gib",
  "plasterboard",
  "plaster board",
  "fyreline",
  "aqualine",
  "standard",
] as const;

export function canonicalCeilingPlasterboardThicknessFromText(
  text: string
): 10 | 13 | "other" | null {
  const raw = normalise(text);
  if (!includesAny(raw, PLASTERBOARD_THICKNESS_CONTEXT)) return null;
  const matches = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*mm/g)];
  for (const match of matches) {
    const index = match.index ?? 0;
    const after = raw.slice(index + match[0].length, index + match[0].length + 24);
    if (/(centres|centers|spacing|crs)\b/.test(after)) continue;
    const window = raw.slice(Math.max(0, index - 28), index + match[0].length + 28);
    if (!includesAny(window, PLASTERBOARD_THICKNESS_CONTEXT)) continue;
    const mm = Number(match[1]);
    if (mm === 10) return 10;
    if (mm === 13) return 13;
    if (Number.isFinite(mm) && mm > 0) return "other";
  }
  return null;
}

export function canonicalCeilingJobScopeFromText(
  text: string
): CeilingJobScope | null {
  const raw = normalise(text);
  if (
    includesAny(raw, [
      "complete replacement",
      "replace the ceiling",
      "replace ceilings",
      "replace ceiling",
      "new timber framing",
      "needs new timber",
      "new steel framing",
    ])
  ) {
    if (
      includesAny(raw, ["lining only", "reline", "lining over existing"])
    ) {
      return "replacement_lining_only";
    }
    if (includesAny(raw, ["existing framing", "reline existing"])) {
      return "reline_existing_suitable_framing";
    }
    if (includesAny(raw, ["complete replacement", "strip and replace"])) {
      return "complete_replacement";
    }
    if (includesAny(raw, ["new timber", "new steel", "new ceiling"])) {
      return "new_ceiling";
    }
    return "complete_replacement";
  }
  if (
    includesAny(raw, [
      "replacement lining",
      "lining only",
      "reline existing",
      "line existing",
      "existing framing",
      "existing ceiling",
      "existing ceilings",
    ])
  ) {
    return includesAny(raw, [
      "reline",
      "existing framing",
      "line existing",
      "existing ceiling",
      "existing ceilings",
    ])
      ? "reline_existing_suitable_framing"
      : "replacement_lining_only";
  }
  if (includesAny(raw, ["new ceiling", "new plasterboard ceiling"])) {
    return "new_ceiling";
  }
  return null;
}

type DimensionHit = {
  readonly index: number;
  readonly lengthM: number | null;
  readonly widthM: number | null;
  readonly areaM2: number | null;
};

function parseDimensions(text: string): DimensionHit[] {
  const hits: DimensionHit[] = [];
  const lxw = text.matchAll(
    /(\d+(?:\.\d+)?)\s*m(?:etre)?s?\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*m(?:etre)?s?)?/gi
  );
  for (const match of lxw) {
    hits.push({
      index: match.index ?? 0,
      lengthM: Number(match[1]),
      widthM: Number(match[2]),
      areaM2: null,
    });
  }
  const by = text.matchAll(
    /(\d+(?:\.\d+)?)\s*m(?:etre)?s?\s+by\s+(\d+(?:\.\d+)?)(?:\s*m(?:etre)?s?)?/gi
  );
  for (const match of by) {
    hits.push({
      index: match.index ?? 0,
      lengthM: Number(match[1]),
      widthM: Number(match[2]),
      areaM2: null,
    });
  }
  const area = text.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:m²|㎡|m2|sq\.?\s*m|sqm|square met(?:re|er)s?)/gi
  );
  for (const match of area) {
    const already = hits.some(
      (hit) => Math.abs(hit.index - (match.index ?? 0)) < 8
    );
    if (already) continue;
    hits.push({
      index: match.index ?? 0,
      lengthM: null,
      widthM: null,
      areaM2: Number(match[1]),
    });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits;
}

const PORTION_LABEL_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bmain room\b/i, label: "Main room" },
  { pattern: /\blounge\b/i, label: "Lounge" },
  { pattern: /\bliving room\b/i, label: "Living room" },
  { pattern: /\bhallway\b/i, label: "Hallway" },
  { pattern: /\bhall\b/i, label: "Hall" },
  { pattern: /\bbedroom\b/i, label: "Bedroom" },
  { pattern: /\bkitchen\b/i, label: "Kitchen" },
  { pattern: /\bgarage\b/i, label: "Garage" },
  { pattern: /\boffice\b/i, label: "Office" },
];

function labelFromSnippet(snippet: string): string | null {
  for (const row of PORTION_LABEL_PATTERNS) {
    if (row.pattern.test(snippet)) return row.label;
  }
  return null;
}

function snippetHasCeilingSignal(row: string): boolean {
  return (
    parseDimensions(row).length > 0 ||
    canonicalCeilingStructureFamilyFromText(row) != null ||
    canonicalCeilingLiningFamilyFromText(row) != null ||
    /\bceiling\b/i.test(row) ||
    labelFromSnippet(row) != null
  );
}

function trimLeadingPortionSeparator(snippet: string): string {
  return snippet.replace(/^(?:[,;]|\band\b|\banother\b)\s+/i, "").trim();
}

/**
 * Split a clause on named ceiling-subject + geometry groups.
 * Does not split coordinated rooms that share one "ceilings" noun
 * ("lounge and hallway ceilings in plasterboard").
 */
function splitOnCeilingSubjects(text: string): string[] {
  const subjectRe =
    /\b(?:another\s+)?(?:[a-z][a-z0-9]*(?:[-\s][a-z0-9]+){0,2}\s+)?ceilings?\b/gi;
  const hits: number[] = [];
  for (const match of text.matchAll(subjectRe)) {
    const index = match.index ?? 0;
    const after = text.slice(index + match[0].length);
    if (/^\s*height\b/i.test(after)) continue;
    hits.push(index);
  }
  if (hits.length < 2) return [text];

  const spans: string[] = [];
  for (let i = 0; i < hits.length; i += 1) {
    const start = i === 0 ? 0 : hits[i]!;
    const end = hits[i + 1] ?? text.length;
    const span = trimLeadingPortionSeparator(text.slice(start, end).trim());
    if (span) spans.push(span);
  }
  const withGeometry = spans.filter((row) => parseDimensions(row).length > 0);
  if (withGeometry.length < 2) return [text];
  return spans.filter(
    (row) =>
      parseDimensions(row).length > 0 ||
      canonicalCeilingLiningFamilyFromText(row) != null ||
      canonicalCeilingPlasterboardProductFromText(row) != null
  );
}

function splitPortionSnippets(brief: string): string[] {
  const trimmed = brief.trim();
  if (!trimmed) return [];
  const bySentence = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((row) => row.trim())
    .filter(Boolean);
  const expanded: string[] = [];
  for (const sentence of bySentence.length > 0 ? bySentence : [trimmed]) {
    const bySemi = sentence
      .split(/\s*;\s*/)
      .map((row) => row.trim())
      .filter(Boolean);
    for (const part of bySemi.length > 0 ? bySemi : [sentence]) {
      expanded.push(...splitOnCeilingSubjects(part));
    }
  }
  const withCeilingSignal = expanded.filter(snippetHasCeilingSignal);
  if (withCeilingSignal.length >= 2) return withCeilingSignal;
  if (expanded.length >= 2) {
    const labelled = expanded.filter(
      (row) => labelFromSnippet(row) != null || parseDimensions(row).length > 0
    );
    if (labelled.length >= 2) return labelled;
  }
  return [trimmed];
}

function bulkheadFormFromText(
  text: string
): "conventional_two_face_downstand" | "island" | "boxed" | "complex" | null {
  const raw = normalise(text);
  if (includesAny(raw, ["island bulkhead", "island bulkheads"])) return "island";
  if (includesAny(raw, ["boxed bulkhead", "box bulkhead"])) return "boxed";
  if (
    includesAny(raw, [
      "complex bulkhead",
      "feature bulkhead",
      "feature ceiling bulkhead",
    ])
  ) {
    return "complex";
  }
  if (/\bbulkhead/.test(raw)) return "conventional_two_face_downstand";
  return null;
}

function applySnippetToPortion(portion: CeilingPortion, snippet: string): void {
  const dims = parseDimensions(snippet);
  if (dims[0]) {
    portion.geometry.length_m = dims[0].lengthM;
    portion.geometry.width_m = dims[0].widthM;
    portion.geometry.area_m2 = dims[0].areaM2;
    if (dims[0].lengthM != null && dims[0].widthM != null) {
      portion.geometry.mode = "length_width";
      portion.geometry.area_m2 = Number(
        (dims[0].lengthM * dims[0].widthM).toFixed(2)
      );
    } else if (dims[0].areaM2 != null) {
      portion.geometry.mode = "area_only";
    }
  }
  const family = canonicalCeilingStructureFamilyFromText(snippet);
  if (family) portion.structure.family = family;
  const lining = canonicalCeilingLiningFamilyFromText(snippet);
  if (lining) portion.lining.family = lining;
  const product = canonicalCeilingPlasterboardProductFromText(snippet);
  if (product) {
    portion.lining.family = portion.lining.family ?? "plasterboard";
    portion.lining.plasterboard_product = product;
  }
  const thickness = canonicalCeilingPlasterboardThicknessFromText(snippet);
  if (thickness != null) {
    portion.lining.family = portion.lining.family ?? "plasterboard";
    portion.lining.thickness_mm = thickness;
  }
  const scope = canonicalCeilingJobScopeFromText(snippet);
  if (scope) portion.structure.job_scope = scope;
  const height = snippet.match(
    /(\d+(?:\.\d+)?)\s*m(?:etre)?s?\s+(?:high|ceiling height|to the ceiling)/i
  );
  if (height) portion.height_m = Number(height[1]);
  const drop = snippet.match(
    /(?:drop(?:ped)?(?: height)?|suspension drop)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*m/i
  );
  if (drop && family === "suspended_steel") {
    portion.structure.suspended = {
      drop_height_m: Number(drop[1]),
      max_spacing_m: 0,
      edge_offset_m: 0,
    };
  }
  const spacing = snippet.match(
    /(\d{2,4})\s*mm\s+(?:centres|centers|spacing|crs)/i
  );
  if (spacing && family === "timber_direct_fix") {
    portion.structure.timber = {
      size: "140x45_h1.2",
      spacing_mm: Number(spacing[1]),
      direction: "along_length",
    };
  }
  const form = bulkheadFormFromText(snippet);
  if (form) {
    portion.has_bulkheads = true;
    const bulkhead = createEmptyCeilingBulkhead();
    if (form !== "conventional_two_face_downstand") {
      bulkhead.form = form;
      bulkhead.topology = "unsupported_specialist";
    } else {
      bulkhead.form = form;
    }
    portion.bulkheads = [bulkhead];
    portion.active_bulkhead_id = bulkhead.id;
  } else if (/\bno bulkhead/.test(normalise(snippet))) {
    portion.has_bulkheads = false;
  }
  if (includesAny(normalise(snippet), ["insulat"])) {
    portion.finish.insulation_included = true;
  }
  const specialist = canonicalCeilingSpecialistKindFromText(snippet);
  if (specialist) {
    portion.specialist_kind = specialist;
    if (
      specialist === "unknown_proprietary_fire" ||
      specialist === "proprietary_acoustic"
    ) {
      portion.fire_acoustic_requirement = "unknown_proprietary";
    }
  }
  portion.label = labelFromSnippet(snippet) ?? portion.label;
}

export function extractCeilingPortionsFromBrief(briefText: string): CeilingPortion[] {
  const snippets = splitPortionSnippets(briefText);
  const portions: CeilingPortion[] = [];
  for (const snippet of snippets) {
    const dims = parseDimensions(snippet);
    const hasSignal =
      dims.length > 0 ||
      canonicalCeilingStructureFamilyFromText(snippet) != null ||
      canonicalCeilingLiningFamilyFromText(snippet) != null ||
      bulkheadFormFromText(snippet) != null ||
      canonicalCeilingSpecialistKindFromText(snippet) != null;
    if (!hasSignal && snippets.length > 1) continue;
    const portion = createEmptyCeilingPortion({
      label: labelFromSnippet(snippet),
    });
    applySnippetToPortion(portion, snippet);
    portions.push(portion);
  }
  if (portions.length === 0 && briefText.trim()) {
    const fallback = createEmptyCeilingPortion();
    applySnippetToPortion(fallback, briefText);
    if (
      fallback.geometry.area_m2 != null ||
      fallback.geometry.length_m != null ||
      fallback.structure.family != null ||
      fallback.lining.family != null
    ) {
      portions.push(fallback);
    }
  }
  return portions;
}

function cloneCeilingPortion(portion: CeilingPortion): CeilingPortion {
  const parsed = parseCeilingPortion(JSON.parse(JSON.stringify(portion)));
  return parsed ?? portion;
}

function firstPresent<T>(explicit: T, fallback: T): T {
  if (explicit == null || explicit === "") return fallback;
  return explicit;
}

function fillMissingCeilingPortion(
  ai: CeilingPortion,
  parsed: CeilingPortion
): CeilingPortion {
  const out = cloneCeilingPortion(ai);
  out.label = firstPresent(out.label, parsed.label);
  out.geometry = {
    mode: out.geometry.mode,
    length_m: out.geometry.length_m ?? parsed.geometry.length_m,
    width_m: out.geometry.width_m ?? parsed.geometry.width_m,
    area_m2: out.geometry.area_m2 ?? parsed.geometry.area_m2,
    perimeter_m: out.geometry.perimeter_m ?? parsed.geometry.perimeter_m,
  };
  if (
    out.geometry.length_m != null &&
    out.geometry.width_m != null &&
    ai.geometry.length_m == null &&
    ai.geometry.width_m == null
  ) {
    out.geometry.mode = "length_width";
  }
  out.height_m = out.height_m ?? parsed.height_m;
  out.structure = {
    job_scope: out.structure.job_scope ?? parsed.structure.job_scope,
    family: out.structure.family ?? parsed.structure.family,
    timber: out.structure.timber ?? parsed.structure.timber,
    steel: out.structure.steel ?? parsed.structure.steel,
    suspended: out.structure.suspended ?? parsed.structure.suspended,
  };
  out.lining = {
    family: out.lining.family ?? parsed.lining.family,
    plasterboard_product:
      out.lining.plasterboard_product ?? parsed.lining.plasterboard_product,
    thickness_mm: out.lining.thickness_mm ?? parsed.lining.thickness_mm,
    plywood_spec: firstPresent(out.lining.plywood_spec, parsed.lining.plywood_spec),
    sheet_length_mm: out.lining.sheet_length_mm ?? parsed.lining.sheet_length_mm,
    sheet_width_mm: out.lining.sheet_width_mm ?? parsed.lining.sheet_width_mm,
    layers: out.lining.layers ?? parsed.lining.layers,
    timber_lined: out.lining.timber_lined ?? parsed.lining.timber_lined,
    tile: out.lining.tile ?? parsed.lining.tile,
  };
  out.finish = {
    insulation_included:
      out.finish.insulation_included ?? parsed.finish.insulation_included,
    insulation_type: firstPresent(
      out.finish.insulation_type,
      parsed.finish.insulation_type
    ),
    stopping_included:
      out.finish.stopping_included ?? parsed.finish.stopping_included,
    painting_included:
      out.finish.painting_included ?? parsed.finish.painting_included,
    demolition_included:
      out.finish.demolition_included ?? parsed.finish.demolition_included,
  };
  out.has_bulkheads = out.has_bulkheads ?? parsed.has_bulkheads;
  if (out.bulkheads.length === 0 && parsed.bulkheads.length > 0) {
    out.bulkheads = parsed.bulkheads.map((row) => ({ ...row }));
    out.active_bulkhead_id = out.active_bulkhead_id ?? parsed.active_bulkhead_id;
  }
  out.significant_penetrations =
    out.significant_penetrations ?? parsed.significant_penetrations;
  out.penetrations = firstPresent(out.penetrations, parsed.penetrations);
  out.fire_acoustic_requirement =
    out.fire_acoustic_requirement ?? parsed.fire_acoustic_requirement;
  out.fire_acoustic_system = firstPresent(
    out.fire_acoustic_system,
    parsed.fire_acoustic_system
  );
  out.specialist_kind = out.specialist_kind ?? parsed.specialist_kind;
  return out;
}

function matchParsedPortion(
  ai: CeilingPortion,
  parsed: readonly CeilingPortion[],
  index: number,
  aiCount: number,
  used: Set<number>
): CeilingPortion | null {
  const aiLabel = ai.label?.trim().toLowerCase();
  if (aiLabel) {
    const found = parsed.findIndex(
      (row, i) => !used.has(i) && row.label?.trim().toLowerCase() === aiLabel
    );
    if (found >= 0) {
      used.add(found);
      return parsed[found] ?? null;
    }
  }
  if (parsed.length !== aiCount) return null;
  if (!used.has(index) && parsed[index]) {
    used.add(index);
    return parsed[index] ?? null;
  }
  return null;
}

/**
 * Explicit valid AI nested Portions win. Deterministic parser fills only
 * genuinely missing safe fields and must not overwrite stronger AI values
 * or collapse Portion separation.
 */
export function mergeCeilingPortionsPreferringExplicitAi(
  aiPortions: readonly CeilingPortion[],
  parsedPortions: readonly CeilingPortion[]
): CeilingPortion[] {
  const ai = normalizeExtractedCeilingPortions(aiPortions);
  if (ai.length > 0) {
    const used = new Set<number>();
    return ai.map((portion, index) => {
      const match = matchParsedPortion(
        portion,
        parsedPortions,
        index,
        ai.length,
        used
      );
      return match
        ? fillMissingCeilingPortion(portion, match)
        : cloneCeilingPortion(portion);
    });
  }
  return parsedPortions.map((row) => cloneCeilingPortion(row));
}

export function readAiCeilingPortionsFromExtraction(
  extraction: AIExtractionOutput,
  workAreaName?: string
): CeilingPortion[] {
  const wanted = workAreaName ?? "";
  const facts = extraction.facts.filter(
    (fact) =>
      fact.key === CEILINGS_PORTIONS_FACT_KEY &&
      fact.work_area_type === "ceilings" &&
      (fact.work_area_name ?? "") === wanted
  );
  const out: CeilingPortion[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    for (const portion of normalizeExtractedCeilingPortions(fact.value)) {
      if (seen.has(portion.id)) continue;
      seen.add(portion.id);
      out.push(portion);
    }
  }
  return out;
}

export function applyExtractedCeilingsToFacts(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly portions: readonly CeilingPortion[];
}): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: params.facts,
    workAreaId: params.workAreaId,
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: [...params.portions],
  });
}

export function seedExtractedCeilingsFact(
  extraction: AIExtractionOutput,
  params: {
    readonly portions: readonly CeilingPortion[];
    readonly workAreaName?: string;
  }
): void {
  const seeded = applyExtractedCeilingsToFacts({
    facts: [],
    workAreaId: "extract",
    portions: params.portions,
  });
  const portions = seeded.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)
    ?.value;
  if (!Array.isArray(portions) || portions.length === 0) return;
  extraction.facts = extraction.facts.filter(
    (fact) =>
      !(
        fact.key === CEILINGS_PORTIONS_FACT_KEY &&
        fact.work_area_type === "ceilings" &&
        (fact.work_area_name ?? "") === (params.workAreaName ?? "")
      )
  );
  extraction.facts.push({
    work_area_type: "ceilings",
    work_area_name: params.workAreaName,
    key: CEILINGS_PORTIONS_FACT_KEY,
    label: "Ceiling portions",
    value: portions as Record<string, unknown>[],
    confidence: 0.9,
  });
}
