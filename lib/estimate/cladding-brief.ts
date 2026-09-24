/**
 * CLADDING-02 — deterministic Cladding Section extraction and AI fill-only merge.
 *
 * Extracts explicit clause-local facts into cladding.portions.
 * Does not calculate quantities, money, hours, waste, or quote copy.
 */

import type { AIExtractionOutput } from "@/lib/ai/schema";
import {
  CLADDING_APPROVED_PROFILES,
  claddingApprovedProfileById,
  isApprovedCladdingBattenThickness,
  isApprovedCladdingBattenWidth,
  type CladdingApprovedProfile,
} from "@/lib/estimate/cladding-profiles";
import {
  applyCladdingFactWrite,
  claddingPortionFieldsCompatible,
  CLADDING_PORTIONS_FACT_KEY,
  cloneCladdingPortion,
  createEmptyCladdingPortion,
  parseCladdingPortions,
  type CladdingFamily,
  type CladdingPortion,
  type CladdingScopeIntent,
  type CladdingSystem,
} from "@/lib/estimate/cladding-portions";
import { briefHasIndependentCladding } from "@/lib/work-areas/cladding-ownership";
import type { EstimateFact } from "@/lib/estimate/types";

const LEGACY_CLADDING_FACT_KEYS = new Set([
  "cladding.type",
  "cladding.area_m2",
  "cladding.count",
  "cladding.material",
  "cladding.orientation",
  "scope.cladding.m2",
]);

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleElevation(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ").toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function splitCladdingSnippets(briefText: string): string[] {
  const brief = briefText.trim();
  if (!brief) return [];
  const boundary =
    /(?:\s*;\s*|\s+\bplus\b\s+|\s+\band then\b\s+|\s+\band also\b\s+|\s+\band\s+(?=\d+\s*(?:m²|m2|sqm|square)(?!\w))|\s+\band\s+(?=the\s+\w+\s+elevation\b)|\s+\band\s+(?=(?:replace|reclad|remove)\b)|[.!?]\s+(?:also\s+)?(?=(?:install|replace|reclad|remove|supply)\b)|\s+\balso\s+(?=(?:install|replace|reclad|remove|supply)\b))/i;
  const parts = brief
    .split(boundary)
    .map((part) => part.replace(/^(?:also|plus)\b[\s,]*/i, "").trim())
    .filter(Boolean);
  if (parts.length <= 1) return parts.length ? parts : [brief];
  const folded: string[] = [];
  for (const part of parts) {
    if (folded.length === 0 || snippetStartsSection(part)) folded.push(part);
    else folded[folded.length - 1] = `${folded[folded.length - 1]}. ${part}`;
  }
  return folded;
}

function snippetStartsSection(text: string): boolean {
  const clause = normalise(text);
  if (
    /^\d+(?:\.\d+)?\s*(?:m²|m2|sqm|square)/.test(clause) &&
    /\b(?:cladding|weatherboard|fibre|fiber|timber|linea|veneer|bevel|rustic|shiplap|batten)\b/.test(
      clause
    )
  ) {
    return true;
  }
  return (
    /\b(?:install|replace|reclad|supply and install|supply)\b/.test(clause) ||
    /\bremove existing cladding only\b/.test(clause) ||
    (/\b(?:north|south|east|west|garage|front|rear)\s+elevation\b/.test(clause) &&
      /\b(?:cladding|weatherboard|reclad|bevelback|shiplap|batten|linea|veneer)\b/.test(
        clause
      ))
  );
}

function setExtracted<K extends keyof CladdingPortion>(
  portion: CladdingPortion,
  field: K,
  authority: keyof CladdingPortion,
  value: CladdingPortion[K]
): void {
  if (value == null || value === "") return;
  portion[field] = value;
  (portion as unknown as Record<string, unknown>)[authority] = "extracted";
}

function applyProfile(
  portion: CladdingPortion,
  profile: CladdingApprovedProfile,
  stated: {
    width?: boolean;
    thickness?: boolean;
    sheet?: boolean;
    gap?: boolean;
  }
): void {
  portion.approved_profile_id = profile.id;
  portion.approved_profile_authority = "extracted";
  portion.cladding_family = profile.family;
  portion.family_authority = "extracted";
  portion.cladding_system = profile.system;
  portion.system_authority = "extracted";
  if (profile.orientation) {
    portion.orientation = profile.orientation;
    if (!portion.orientation_authority) {
      portion.orientation_authority = "assumed_disclosed";
    }
  }
  portion.nominal_width_mm = profile.nominal_width_mm;
  portion.nominal_thickness_mm = profile.nominal_thickness_mm;
  portion.effective_cover_mm = profile.effective_cover_mm;
  portion.board_sheet_length_mm = profile.board_sheet_length_mm;
  portion.board_sheet_width_mm = profile.board_sheet_width_mm;
  portion.board_gap_mm = profile.board_gap_mm;
  if (profile.nominal_width_mm != null) {
    portion.nominal_width_authority = stated.width ? "extracted" : "assumed_disclosed";
  }
  if (profile.nominal_thickness_mm != null) {
    portion.nominal_thickness_authority = stated.thickness
      ? "extracted"
      : "assumed_disclosed";
  }
  if (profile.effective_cover_mm != null) {
    portion.effective_cover_authority = "assumed_disclosed";
  }
  if (profile.board_sheet_length_mm != null) {
    portion.board_sheet_length_authority = stated.sheet ? "extracted" : "assumed_disclosed";
    portion.board_sheet_width_authority = stated.sheet ? "extracted" : "assumed_disclosed";
  }
  if (profile.board_gap_mm != null) {
    portion.board_gap_authority = stated.gap ? "extracted" : "assumed_disclosed";
  }
}

function markCustom(
  portion: CladdingPortion,
  description: string,
  width: number | null,
  thickness: number | null
): void {
  portion.approved_profile_id = null;
  portion.approved_profile_authority = "extracted";
  portion.cladding_family = "other";
  portion.family_authority = "extracted";
  portion.cladding_system = "specialist_unresolved";
  portion.system_authority = "extracted";
  portion.specialist_kind = "custom_profile";
  portion.specialist_kind_authority = "extracted";
  portion.other_description = description;
  portion.other_description_authority = "extracted";
  if (width != null) {
    portion.nominal_width_mm = width;
    portion.nominal_width_authority = "extracted";
  }
  if (thickness != null) {
    portion.nominal_thickness_mm = thickness;
    portion.nominal_thickness_authority = "extracted";
  }
}

function profileFor(
  system: CladdingSystem,
  width: number | null,
  thickness: number | null
): CladdingApprovedProfile | null {
  return (
    CLADDING_APPROVED_PROFILES.find((profile) => {
      if (profile.system !== system) return false;
      if (system === "fibre_cement_horizontal_weatherboard") {
        return width != null && profile.nominal_width_mm === width;
      }
      if (system === "timber_sheet_board_and_batten") return true;
      return (
        width != null &&
        thickness != null &&
        profile.nominal_width_mm === width &&
        profile.nominal_thickness_mm === thickness
      );
    }) ?? null
  );
}

function productMillimetres(text: string): { width: number; thickness: number | null } | null {
  const pair = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*mm\b/i);
  if (pair) return { width: Number(pair[1]), thickness: Number(pair[2]) };
  const single = text.match(/\b(\d{2,3})\s*mm\b/i);
  if (!single) return null;
  const width = Number(single[1]);
  if (width >= 1000) return null;
  return { width, thickness: null };
}

function statedCover(text: string): number | null {
  const match = text.match(/effective cover(?: of)?\s*(\d+(?:\.\d+)?)\s*mm/i);
  return match ? Number(match[1]) : null;
}

function applySystemAndProfile(portion: CladdingPortion, text: string): void {
  const clause = normalise(text);
  const dims = productMillimetres(text);
  const cover = statedCover(text);
  let family: CladdingFamily | null = null;
  let system: CladdingSystem | null = null;
  if (/\bbrick veneer\b/.test(clause)) {
    family = "brick_veneer";
  } else if (/\bmasonry veneer\b|\bmasonry cladding\b/.test(clause)) {
    family = "masonry";
  } else if (/\bboard(?:\s|-)+and(?:\s|-)+batten\b|\bsheet board-and-batten\b/.test(clause)) {
    family = "timber";
    system = "timber_sheet_board_and_batten";
  } else if (/\bshiplap\b/.test(clause)) {
    family = "timber";
    system = "timber_vertical_shiplap";
  } else if (/\bbevel-?back\b/.test(clause)) {
    family = "timber";
    system = "timber_bevelback";
  } else if (/\brusticated\b/.test(clause)) {
    family = "timber";
    system = "timber_rusticated";
  } else if (/\blinea\b|\bfibre-?cement\b|\bfiber-?cement\b/.test(clause)) {
    family = "fibre_cement";
    system = "fibre_cement_horizontal_weatherboard";
  } else if (/\btimber\b|\bweatherboards?\b/.test(clause)) {
    family = "timber";
  } else if (/\bother\b|\bcustom\b/.test(clause) && /\bcladding\b/.test(clause)) {
    family = "other";
  }

  if (/\bhorizontal\b/.test(clause)) {
    setExtracted(portion, "orientation", "orientation_authority", "horizontal");
  } else if (/\bvertical\b/.test(clause) && !/\bvertical joint\b/.test(clause)) {
    setExtracted(portion, "orientation", "orientation_authority", "vertical");
  }

  if (family === "brick_veneer" || family === "masonry" || family === "other") {
    setExtracted(portion, "cladding_family", "family_authority", family);
    setExtracted(portion, "cladding_system", "system_authority", "specialist_unresolved");
    setExtracted(
      portion,
      "specialist_kind",
      "specialist_kind_authority",
      family === "brick_veneer"
        ? "brick_veneer"
        : family === "masonry"
          ? "masonry"
          : "other_custom"
    );
    const description =
      family === "brick_veneer"
        ? "Brick veneer"
        : family === "masonry"
          ? "Masonry veneer"
          : text.trim().slice(0, 180);
    setExtracted(portion, "other_description", "other_description_authority", description);
    return;
  }

  if (family) setExtracted(portion, "cladding_family", "family_authority", family);
  if (system) setExtracted(portion, "cladding_system", "system_authority", system);
  if (
    family === "fibre_cement" &&
    system === "fibre_cement_horizontal_weatherboard" &&
    !portion.orientation
  ) {
    portion.orientation = "horizontal";
    portion.orientation_authority = "assumed_disclosed";
  }
  if (!system) return;

  if (system === "timber_sheet_board_and_batten") {
    const profile = profileFor(system, null, null);
    if (profile) {
      applyProfile(portion, profile, {
        sheet: /2400/.test(text) && /1200/.test(text),
        gap: /\b8\s*mm\b/.test(clause) && /\bgap\b/.test(clause),
      });
    }
    const batten = clause.match(/\b(45|65|90)\s*(?:mm)?\s*[x×]\s*(19|20)\s*mm\b/);
    if (batten) {
      const width = Number(batten[1]);
      const thickness = Number(batten[2]);
      if (isApprovedCladdingBattenWidth(width)) {
        portion.batten_width_mm = width;
        portion.batten_width_authority = "extracted";
      }
      if (isApprovedCladdingBattenThickness(thickness)) {
        portion.batten_thickness_mm = thickness;
        portion.batten_thickness_authority = "extracted";
      }
    }
    return;
  }

  if (!dims) return;
  const exact = profileFor(system, dims.width, dims.thickness);
  const coverConflicts =
    exact != null &&
    cover != null &&
    exact.effective_cover_mm != null &&
    cover !== exact.effective_cover_mm;
  if (!exact || coverConflicts) {
    markCustom(
      portion,
      `${dims.width}${dims.thickness != null ? ` × ${dims.thickness}` : ""} mm custom cladding`,
      dims.width,
      dims.thickness
    );
    if (cover != null) {
      portion.effective_cover_mm = cover;
      portion.effective_cover_authority = "extracted";
    }
    return;
  }
  applyProfile(portion, exact, {
    width: true,
    thickness: dims.thickness != null,
  });
}

function applyArea(portion: CladdingPortion, text: string): void {
  const withoutProducts = text
    .replace(/\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*mm\b/gi, " ")
    .replace(/\b\d{2,4}\s*mm\b/gi, " ");
  const direct = withoutProducts.match(
    /(\d+(?:\.\d+)?)\s*(?:m²|m2|sqm|square metres|square meters)(?!\w)/i
  );
  if (direct) {
    const area = Number(direct[1]);
    if (Number.isFinite(area) && area > 0) {
      portion.direct_area_m2 = area;
      portion.direct_area_authority = "extracted";
      portion.area_method = "direct_m2";
      portion.area_method_authority = "extracted";
    }
  }
  const geometry =
    withoutProducts.match(
      /(\d+(?:\.\d+)?)\s*m(?:etres|eters)?\s+long\s*[x×]\s*(\d+(?:\.\d+)?)\s*m(?:etres|eters)?\s+high/i
    ) ||
    withoutProducts.match(
      /length\s*(\d+(?:\.\d+)?)\s*m\b[^.]{0,40}?height\s*(\d+(?:\.\d+)?)\s*m\b/i
    ) ||
    withoutProducts.match(
      /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*m(?:etre|eter)?\s+wall\b/i
    );
  if (!geometry) return;
  const length = Number(geometry[1]);
  const height = Number(geometry[2]);
  if (!(length > 0) || !(height > 0)) return;
  portion.length_m = length;
  portion.length_authority = "extracted";
  portion.height_m = height;
  portion.height_authority = "extracted";
  if (portion.direct_area_m2 == null) {
    portion.area_method = "length_height";
    portion.area_method_authority = "extracted";
  }
}

function applyOpenings(portion: CladdingPortion, text: string): void {
  const clause = normalise(text);
  if (
    /net of openings/.test(clause) ||
    /already excludes windows and doors/.test(clause) ||
    /area already excludes/.test(clause)
  ) {
    portion.openings_already_deducted = true;
    portion.openings_deducted_authority = "extracted";
    return;
  }
  const deduct = text.match(
    /(?:less|deduct)\s*(\d+(?:\.\d+)?)\s*(?:m²|m2|sqm|square metres)/i
  );
  if (!deduct) return;
  const area = Number(deduct[1]);
  if (!Number.isFinite(area) || area < 0) return;
  portion.openings_already_deducted = false;
  portion.openings_deducted_authority = "extracted";
  portion.opening_area_m2 = area;
  portion.opening_area_authority = "extracted";
}

function applyBool(
  portion: CladdingPortion,
  text: string,
  pattern: RegExp,
  field: "cavity_included" | "wall_underlay_or_rab_included" | "trims_flashings_corners_included" | "existing_cladding_removal_required" | "painting_or_coating_included",
  authority: keyof CladdingPortion
): void {
  const clause = normalise(text);
  if (!pattern.test(clause)) return;
  const wrapped = `(?:${pattern.source})`;
  const negative =
    new RegExp(
      `(?:no|not|without|exclud\\w*|excluding)\\s+(?:\\w+\\s+){0,4}${wrapped}`,
      "i"
    ).test(clause) ||
    new RegExp(`${wrapped}[^.]{0,40}(?:not included|by others|not required)`, "i").test(
      clause
    ) ||
    (field === "existing_cladding_removal_required" &&
      /no removal/.test(clause)) ||
    (field === "painting_or_coating_included" &&
      /no painting|excluding painting|painting is not|but excluding painting/.test(clause));
  const positive =
    new RegExp(`including[^.]{0,80}(?:${pattern.source})`, "i").test(clause) ||
    (field === "existing_cladding_removal_required" &&
      /including removal|removal of the existing cladding|remove existing cladding/.test(
        clause
      ) &&
      !/no removal|remove existing cladding only/.test(clause));
  if (negative) {
    (portion as unknown as Record<string, unknown>)[field] = false;
    (portion as unknown as Record<string, unknown>)[authority] = "extracted";
    return;
  }
  if (positive || (field === "cavity_included" && /new cavity battens|drained cavity/.test(clause))) {
    (portion as unknown as Record<string, unknown>)[field] = true;
    (portion as unknown as Record<string, unknown>)[authority] = "extracted";
  }
}

function applyInclusions(portion: CladdingPortion, text: string): void {
  applyBool(portion, text, /cavity(?: battens)?|drained cavity/, "cavity_included", "cavity_authority");
  applyBool(
    portion,
    text,
    /wall underlay|underlay|rigid air barrier|\brab\b/,
    "wall_underlay_or_rab_included",
    "underlay_authority"
  );
  applyBool(
    portion,
    text,
    /trims|corners|flashings|scribers|facings/,
    "trims_flashings_corners_included",
    "trims_authority"
  );
  applyBool(
    portion,
    text,
    /removal/,
    "existing_cladding_removal_required",
    "removal_authority"
  );
  applyBool(
    portion,
    text,
    /painting|coating/,
    "painting_or_coating_included",
    "painting_authority"
  );
}

function applyScope(portion: CladdingPortion, text: string): void {
  const clause = normalise(text);
  let intent: CladdingScopeIntent | null = null;
  if (
    /remove existing cladding only|cladding removal only|remove cladding only/.test(clause) &&
    !/\binstall\b|\breplace\b|\breclad/.test(clause)
  ) {
    intent = "removal_only";
  } else if (/\breclad|\breplace\b/.test(clause)) intent = "replace";
  else if (/\binstall\b|\bsupply\b|\bnew cladding\b|\bnew weatherboards?\b/.test(clause)) {
    intent = "install";
  }
  if (!intent) return;
  setExtracted(portion, "scope_intent", "scope_intent_authority", intent);
  if (intent === "removal_only") {
    portion.existing_cladding_removal_required = true;
    portion.removal_authority = "extracted";
  }
}

function applyLabel(portion: CladdingPortion, text: string): void {
  const match = text.match(
    /\b((?:north|south|east|west|garage|front|rear)(?:\s+\w+){0,2}\s+elevation)\b/i
  );
  if (!match?.[1]) return;
  setExtracted(portion, "label", "label_authority", titleElevation(match[1]));
}

function applySnippet(portion: CladdingPortion, text: string): void {
  applyScope(portion, text);
  applyLabel(portion, text);
  applySystemAndProfile(portion, text);
  applyArea(portion, text);
  applyOpenings(portion, text);
  applyInclusions(portion, text);
}

function snippetHasSignal(text: string): boolean {
  const clause = normalise(text);
  return (
    /\bcladding\b|\bweatherboards?\b|\breclad|\blinea\b|\bveneer\b|\bbevel-?back\b|\brusticated\b|\bshiplap\b|\bboard(?:\s|-)+and(?:\s|-)+batten\b/.test(
      clause
    )
  );
}

export function extractCladdingPortionsFromBrief(briefText: string): CladdingPortion[] {
  if (!briefHasIndependentCladding(briefText)) return [];
  const snippets = splitCladdingSnippets(briefText).filter(snippetHasSignal);
  const source = snippets.length > 0 ? snippets : [briefText];
  const portions: CladdingPortion[] = [];
  source.forEach((snippet, index) => {
    const portion = createEmptyCladdingPortion();
    portion.clause_ordinal = index;
    applySnippet(portion, snippet);
    const useful =
      portion.scope_intent != null ||
      portion.cladding_family != null ||
      portion.direct_area_m2 != null ||
      portion.length_m != null;
    if (useful) portions.push(portion);
  });
  return portions;
}

const FILL_FIELDS: readonly [keyof CladdingPortion, keyof CladdingPortion][] = [
  ["label", "label_authority"],
  ["scope_intent", "scope_intent_authority"],
  ["cladding_family", "family_authority"],
  ["cladding_system", "system_authority"],
  ["orientation", "orientation_authority"],
  ["approved_profile_id", "approved_profile_authority"],
  ["nominal_width_mm", "nominal_width_authority"],
  ["nominal_thickness_mm", "nominal_thickness_authority"],
  ["effective_cover_mm", "effective_cover_authority"],
  ["board_sheet_length_mm", "board_sheet_length_authority"],
  ["board_sheet_width_mm", "board_sheet_width_authority"],
  ["board_gap_mm", "board_gap_authority"],
  ["batten_width_mm", "batten_width_authority"],
  ["batten_thickness_mm", "batten_thickness_authority"],
  ["area_method", "area_method_authority"],
  ["direct_area_m2", "direct_area_authority"],
  ["length_m", "length_authority"],
  ["height_m", "height_authority"],
  ["openings_already_deducted", "openings_deducted_authority"],
  ["opening_area_m2", "opening_area_authority"],
  ["cavity_included", "cavity_authority"],
  ["wall_underlay_or_rab_included", "underlay_authority"],
  ["trims_flashings_corners_included", "trims_authority"],
  ["existing_cladding_removal_required", "removal_authority"],
  ["painting_or_coating_included", "painting_authority"],
  ["specialist_kind", "specialist_kind_authority"],
  ["other_description", "other_description_authority"],
];

function aiCompatible(primary: CladdingPortion, secondary: CladdingPortion): boolean {
  if (!claddingPortionFieldsCompatible(primary, secondary)) return false;
  if (
    primary.clause_ordinal != null &&
    secondary.clause_ordinal != null &&
    primary.clause_ordinal !== secondary.clause_ordinal
  ) {
    return false;
  }
  return true;
}

function fillMissing(primary: CladdingPortion, secondary: CladdingPortion): CladdingPortion {
  const next = cloneCladdingPortion(primary);
  for (const [field, authority] of FILL_FIELDS) {
    const current = next[field];
    const incoming = secondary[field];
    if (current != null && current !== "") continue;
    if (incoming == null || incoming === "") continue;
    (next as unknown as Record<string, unknown>)[field] = incoming;
    const incomingAuthority = secondary[authority];
    if (incomingAuthority) {
      (next as unknown as Record<string, unknown>)[authority] = incomingAuthority;
    }
  }
  if (next.approved_profile_id && !claddingApprovedProfileById(next.approved_profile_id)) {
    next.approved_profile_id = null;
  }
  return next;
}

function matchAiPortion(
  ai: readonly CladdingPortion[],
  portion: CladdingPortion,
  index: number,
  used: Set<number>
): CladdingPortion | null {
  const take = (predicate: (row: CladdingPortion, rowIndex: number) => boolean) => {
    const found = ai.findIndex((row, rowIndex) => !used.has(rowIndex) && predicate(row, rowIndex));
    if (found < 0) return null;
    used.add(found);
    return ai[found] ?? null;
  };
  return (
    take((row) => row.id === portion.id) ??
    take(
      (row) =>
        portion.clause_ordinal != null &&
        row.clause_ordinal === portion.clause_ordinal &&
        aiCompatible(portion, row)
    ) ??
    take(
      (row) =>
        Boolean(portion.label) &&
        row.label?.trim().toLowerCase() === portion.label?.trim().toLowerCase() &&
        aiCompatible(portion, row)
    ) ??
    take((row, rowIndex) => rowIndex === index && aiCompatible(portion, row))
  );
}

export function mergeCladdingPortionsPreferringDeterministic(
  aiPortions: readonly CladdingPortion[],
  parsedPortions: readonly CladdingPortion[]
): CladdingPortion[] {
  if (parsedPortions.length === 0) return aiPortions.map(cloneCladdingPortion);
  const used = new Set<number>();
  return parsedPortions.map((portion, index) => {
    const match = matchAiPortion(aiPortions, portion, index, used);
    return match ? fillMissing(portion, match) : cloneCladdingPortion(portion);
  });
}

export function readAiCladdingPortionsFromExtraction(
  extraction: AIExtractionOutput
): CladdingPortion[] {
  const out: CladdingPortion[] = [];
  const seen = new Set<string>();
  for (const fact of extraction.facts) {
    if (fact.key !== CLADDING_PORTIONS_FACT_KEY || fact.work_area_type !== "cladding") {
      continue;
    }
    for (const portion of parseCladdingPortions(fact.value)) {
      if (seen.has(portion.id)) continue;
      seen.add(portion.id);
      out.push(portion);
    }
  }
  return out;
}

export function seedExtractedCladdingFact(
  extraction: AIExtractionOutput,
  params: { readonly portions: readonly CladdingPortion[] }
): void {
  const seeded = applyCladdingFactWrite({
    facts: [],
    workAreaId: "extract",
    key: CLADDING_PORTIONS_FACT_KEY,
    value: [...params.portions],
    factSource: "ai_extracted",
  });
  const value = seeded.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value;
  const parsed = parseCladdingPortions(value);
  extraction.facts = extraction.facts.filter(
    (fact) =>
      !(fact.key === CLADDING_PORTIONS_FACT_KEY && fact.work_area_type === "cladding") &&
      !LEGACY_CLADDING_FACT_KEYS.has(fact.key)
  );
  if (parsed.length === 0) return;
  extraction.facts.push({
    work_area_type: "cladding",
    key: CLADDING_PORTIONS_FACT_KEY,
    label: "Cladding sections",
    value: parsed as unknown as Record<string, unknown>[],
    confidence: 0.9,
  });
}

export function stripLegacyCladdingFactsFromExtraction(
  extraction: AIExtractionOutput
): void {
  extraction.facts = extraction.facts.filter(
    (fact) => !LEGACY_CLADDING_FACT_KEYS.has(fact.key)
  );
}

export function applyExtractedCladdingToFacts(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly portions: readonly CladdingPortion[];
}): EstimateFact[] {
  return applyCladdingFactWrite({
    facts: params.facts,
    workAreaId: params.workAreaId,
    key: CLADDING_PORTIONS_FACT_KEY,
    value: [...params.portions],
    factSource: "ai_extracted",
  });
}
