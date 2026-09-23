/**
 * FLOORING-02 — deterministic brief extraction into `flooring.portions`.
 *
 * Structures explicit Flooring Areas. Does not invent area, finish,
 * underlay, preparation, substrate, framing, or removal. Specialist
 * language is never rewritten as ordinary.
 */

import type { AIExtractionOutput } from "@/lib/ai/schema";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
} from "@/lib/estimate/bathroom-identities";
import {
  applyFlooringFactWrite,
  cloneFlooringPortion,
  createEmptyFlooringPortion,
  flooringPortionFieldsCompatible,
  FLOORING_PORTIONS_FACT_KEY,
  normalizeExtractedFlooringPortions,
  parseFlooringExistingFinishType,
  parseFlooringFinishType,
  parseFlooringFramingAllowanceLevel,
  parseFlooringPortions,
  parseFlooringPositiveMeasure,
  parseFlooringPositiveMm,
  parseFlooringSpecialistKind,
  type FlooringExistingFinishType,
  type FlooringFinishType,
  type FlooringFramingAllowanceLevel,
  type FlooringPortion,
  type FlooringSpecialistKind,
  type FlooringSubstrateFamily,
} from "@/lib/estimate/flooring-portions";
import {
  briefHasIndependentFlooring,
  clauseHasFlooringOperation,
  clauseIsBathroomOwnedFloor,
  clauseIsKitchenOwnedFloor,
} from "@/lib/work-areas/ownership";

export const FLOORING_BATHROOM_OVERLAP_WARNING =
  "Nested Flooring Area shares a bathroom/ensuite location with Bathroom Renovation. Overlap is unresolved; no money is calculated in FLOORING-02." as const;

export const FLOORING_KNOWN_SUBSTRATE_ITEM_KEYS = [
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
] as const;

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  const raw = normalise(text);
  return phrases.some((phrase) => raw.includes(phrase));
}

function conciseDescription(snippet: string): string {
  const collapsed = snippet.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 160) return collapsed;
  return `${collapsed.slice(0, 157).trim()}…`;
}

const SPECIALIST_PHRASES: readonly { kind: FlooringSpecialistKind; phrases: readonly string[] }[] =
  [
    { kind: "sheet_vinyl", phrases: ["sheet vinyl"] },
    { kind: "laminate", phrases: ["laminate"] },
    { kind: "engineered_timber", phrases: ["engineered timber", "engineered wood"] },
    {
      kind: "stairs_landings",
      phrases: ["stair flooring", "landing flooring", "stairs and landings"],
    },
    { kind: "waterproofing", phrases: ["waterproof flooring membrane"] },
    {
      kind: "structural",
      phrases: [
        "structural flooring engineer",
        "engineered subfloor framing",
        "structural framing below the floor",
      ],
    },
    {
      kind: "other_unsupported",
      phrases: [
        "parquet",
        "herringbone",
        "epoxy",
        "polished concrete",
        "rubber flooring",
        "cork flooring",
        "cork floor",
      ],
    },
  ];

export function specialistKindFromSnippet(
  text: string
): FlooringSpecialistKind | null {
  const raw = normalise(text);
  for (const row of SPECIALIST_PHRASES) {
    if (includesAny(raw, row.phrases)) return row.kind;
  }
  return parseFlooringSpecialistKind(text);
}

function installFacingText(text: string): string {
  return text.replace(
    /\b(?:remove|uplift)\s+existing(?:\s+\w+){0,8}/gi,
    " "
  );
}

function finishFromSnippet(text: string): FlooringFinishType | null {
  const specialist = specialistKindFromSnippet(text);
  if (specialist) return "other";
  return parseFlooringFinishType(installFacingText(text));
}

function locationFromSnippet(text: string): string | null {
  if (/\bbedrooms?\b/i.test(text)) return "Bedrooms";
  if (/\bliving rooms?\b/i.test(text)) return "Living room";
  if (/\blounge\b/i.test(text)) return "Lounge";
  if (/\bensuite\b/i.test(text)) return "Ensuite";
  if (/\bbathroom\b/i.test(text)) return "Bathroom";
  if (/\bkitchen\b/i.test(text)) return "Kitchen";
  if (/\blaundry\b/i.test(text)) return "Laundry";
  if (/\bhall(?:way)?\b/i.test(text)) return "Hallway";
  if (/\bentr(?:y|ance)\b/i.test(text)) return "Entry";
  return null;
}

function stripProductMillimetres(text: string): string {
  return text
    .replace(
      /\b\d{2,4}\s*(?:mm)?\s*[x×]\s*\d{2,4}\s*mm\b(?:\s+(?:tiles?|porcelain|ceramic|floor tiles?))?/gi,
      " "
    )
    .replace(
      /\b\d{2,3}\s*mm\s+(?:wide\s+)?(?:hardwood|timber|boards?|floorboards?)\b/gi,
      " "
    )
    .replace(
      /\b(?:hardwood|timber|boards?|floorboards?)\s+\d{2,3}\s*mm\s+wide\b/gi,
      " "
    )
    .replace(
      /\b(?:2400|2700|1800)\s*(?:mm)?\s*[x×]\s*(?:1200|900|600)\s*(?:mm)?\b/gi,
      " "
    );
}

function directAreaFromSnippet(text: string): number | null {
  const stripped = stripProductMillimetres(text);
  const match = stripped.match(
    /(\d+(?:\.\d+)?)\s*(?:m²|m2|m\^2|square\s*metres?|sqm)/i
  );
  if (!match) return null;
  return parseFlooringPositiveMeasure(match[1]);
}

function roomDimensionsFromSnippet(text: string): {
  length_m: number | null;
  width_m: number | null;
} {
  const stripped = stripProductMillimetres(text);
  const match = stripped.match(
    /(\d+(?:\.\d+)?)\s*m\s*(?:[x×]|by)\s*(\d+(?:\.\d+)?)\s*m\b/i
  );
  if (!match) return { length_m: null, width_m: null };
  return {
    length_m: parseFlooringPositiveMeasure(match[1]),
    width_m: parseFlooringPositiveMeasure(match[2]),
  };
}

function tileDimensionsFromSnippet(text: string): {
  width_mm: number | null;
  length_mm: number | null;
} {
  const raw = normalise(text);
  if (!/\btile/.test(raw) && !/\bporcelain\b/.test(raw) && !/\bceramic\b/.test(raw)) {
    return { width_mm: null, length_mm: null };
  }
  const match = text.match(
    /(\d{2,4})\s*(?:mm)?\s*[x×]\s*(\d{2,4})\s*(?:mm)?(?:\s+(?:porcelain\s+|ceramic\s+|floor\s+)?tiles?)?/i
  );
  if (!match) return { width_mm: null, length_mm: null };
  const first = parseFlooringPositiveMm(match[1]);
  const second = parseFlooringPositiveMm(match[2]);
  if (first == null || second == null) return { width_mm: null, length_mm: null };
  if (first >= 1000 || second >= 1000) {
    return { width_mm: null, length_mm: null };
  }
  return { width_mm: Math.min(first, second), length_mm: Math.max(first, second) };
}

function hardwoodWidthFromSnippet(text: string): number | null {
  const raw = normalise(text);
  if (!/\b(?:hardwood|timber|floorboards?|boards?)\b/.test(raw)) return null;
  const labelled = text.match(
    /(\d{2,3})\s*mm\s+wide(?:\s+(?:hardwood|timber|boards?|floorboards?))?/i
  );
  const reverse = text.match(
    /(?:hardwood|timber|boards?|floorboards?)\s+(\d{2,3})\s*mm\s+wide/i
  );
  const token = labelled?.[1] ?? reverse?.[1];
  if (!token) return null;
  return parseFlooringPositiveMm(token);
}

function triFromPhrases(
  text: string,
  yes: readonly string[],
  no: readonly string[]
): boolean | null {
  const raw = normalise(text);
  if (includesAny(raw, no)) return false;
  if (includesAny(raw, yes)) return true;
  return null;
}

function underlayFromSnippet(text: string): boolean | null {
  return triFromPhrases(
    text,
    ["with underlay", "include underlay", "including underlay", "new underlay", "carpet and underlay"],
    [
      "without underlay",
      "no underlay",
      "reuse existing underlay",
      "retain existing underlay",
    ]
  );
}

function preparationFromSnippet(text: string): boolean | null {
  return triFromPhrases(
    text,
    [
      "include floor preparation",
      "including floor preparation",
      "with floor preparation",
      "floor preparation",
      "prepare the floor",
      "self-levelling required",
      "self-leveling required",
      "self-level the floor",
      "self level the floor",
      "levelling compound required",
      "leveling compound required",
    ],
    [
      "no floor preparation",
      "no levelling required",
      "no leveling required",
      "existing substrate ready for installation",
      "existing substrate is ready",
    ]
  );
}

function substrateRequiredFromSnippet(text: string): boolean | null {
  return triFromPhrases(
    text,
    [
      "replace the floor substrate",
      "replace floor substrate",
      "install new flooring substrate",
      "new flooring substrate",
      "new floor substrate",
      "new particleboard flooring",
      "new plywood flooring",
      "new plywood substrate",
      "new fibre-cement flooring",
      "new fibre cement flooring",
      "replace the subfloor sheets",
      "new substrate",
    ],
    [
      "existing substrate retained",
      "existing substrates and framing are to remain",
      "existing substrates are to remain",
      "existing substrate is to remain",
      "no substrate replacement",
      "existing floor substrate is suitable",
      "lay over existing substrate",
      "existing substrates remain",
    ]
  );
}

function exactSubstrateItemKeyFromSnippet(text: string): string | null {
  const raw = normalise(text);
  if (/\bsecura\b/.test(raw)) return BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY;
  if (/\b19\s*mm\b/.test(raw) && /\bh3\.?2\b/.test(raw) && /\bplywood\b/.test(raw)) {
    return BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY;
  }
  if (/\b19\s*mm\b/.test(raw) && /\bfibre[-\s]?cement\b/.test(raw)) {
    if (/\b2700\b/.test(raw) && /\b600\b/.test(raw)) {
      return BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY;
    }
    if (/\b1800\b/.test(raw) && /\b900\b/.test(raw)) {
      return BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY;
    }
    return BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY;
  }
  if (
    /\b18\s*mm\b/.test(raw) &&
    /\bfibre[-\s]?cement\b/.test(raw) &&
    /\b2400\b/.test(raw)
  ) {
    return BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY;
  }
  return null;
}

function substrateFamilyFromSnippet(text: string): FlooringSubstrateFamily | null {
  const raw = normalise(text);
  if (/\bparticleboard\b/.test(raw) || /\bchipboard\b/.test(raw)) {
    return "particleboard";
  }
  if (/\bsecura\b/.test(raw)) return "secura";
  if (/\bfibre[-\s]?cement\b/.test(raw) || /\bfiber[-\s]?cement\b/.test(raw)) {
    return "fibre_cement";
  }
  if (/\bplywood\b/.test(raw) || /\bstructural ply\b/.test(raw)) {
    return "structural_plywood";
  }
  return null;
}

function framingRequiredFromSnippet(text: string): boolean | null {
  const raw = normalise(text);
  if (
    includesAny(raw, [
      "structural framing",
      "engineered framing",
      "engineer the subfloor",
    ])
  ) {
    return true;
  }
  return triFromPhrases(
    text,
    [
      "new framing below the floor",
      "new subfloor framing",
      "framing repairs required",
      "include minor subfloor framing",
      "include standard subfloor framing",
      "include major subfloor framing",
      "minor subfloor framing allowance",
      "standard subfloor framing allowance",
      "major subfloor framing allowance",
      "new framing",
    ],
    [
      "no new framing",
      "existing framing retained",
      "framing is sound",
      "existing substrates and framing are to remain",
      "existing framing is to remain",
    ]
  );
}

function framingLevelFromSnippet(
  text: string
): FlooringFramingAllowanceLevel | null {
  const raw = normalise(text);
  if (/\bminor\b/.test(raw) && /\bframing\b/.test(raw)) return "minor";
  if (/\bmajor\b/.test(raw) && /\bframing\b/.test(raw)) return "major";
  if (/\bstandard\b/.test(raw) && /\bframing\b/.test(raw)) return "standard";
  return parseFlooringFramingAllowanceLevel(text);
}

function finishRemovalFromSnippet(text: string): boolean | null {
  return triFromPhrases(
    text,
    [
      "remove existing carpet",
      "uplift existing vinyl",
      "remove existing tiles",
      "remove existing hardwood",
      "remove existing floor finish",
      "remove existing flooring",
      "uplift existing",
      "remove the existing floor",
    ],
    [
      "no floor removal",
      "no flooring removal",
      "install over existing finish",
      "existing finish already removed",
      "floor will be cleared by others",
      "no flooring removal is required",
    ]
  );
}

function existingFinishFromSnippet(
  text: string
): FlooringExistingFinishType | null {
  const match = text.match(
    /\b(?:remove|uplift)\s+existing\s+(carpet|vinyl|tiles?|hardwood|timber|floor finish|flooring)\b/i
  );
  if (!match) return null;
  if (/^(?:floor finish|flooring)$/i.test(match[1])) return null;
  return parseFlooringExistingFinishType(match[1]);
}

function substrateRemovalFromSnippet(text: string): boolean | null {
  return triFromPhrases(
    text,
    [
      "remove existing floor substrate",
      "remove existing particleboard",
      "remove existing plywood",
      "remove existing fibre-cement",
      "remove existing fibre cement",
      "strip out existing subfloor sheets",
      "remove existing subfloor sheets",
      "substrate removal",
    ],
    ["retain existing substrate", "no substrate removal"]
  );
}

function snippetHasFlooringSignal(text: string): boolean {
  return clauseHasFlooringOperation(text) || specialistKindFromSnippet(text) != null;
}

function splitFlooringSnippets(briefText: string): string[] {
  const trimmed = briefText.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(
      /(?:\s*;\s*|\s+\bplus\b\s+|\s+\band then\b\s+|\s+\band also\b\s+|[.!?]\s+(?:also\s+)?(?=(?:install|lay|replace|supply and install|carpet|tile)\b)|\s+\balso\s+(?=(?:install|lay|replace|supply and install|carpet|tile)\b))/i
    )
    .map((row) => row.replace(/^(?:also|plus)\s+/i, "").trim())
    .filter(Boolean);
  const withSignal = parts.filter(snippetHasFlooringSignal);
  if (withSignal.length >= 2) return withSignal;
  if (withSignal.length === 1 && parts.length > 1) return withSignal;
  return snippetHasFlooringSignal(trimmed) ? [trimmed] : parts.length > 0 ? parts : [trimmed];
}

function applyGlobalConstraints(
  portion: FlooringPortion,
  briefText: string
): void {
  const substrate = substrateRequiredFromSnippet(briefText);
  if (portion.substrate_required == null && substrate != null) {
    portion.substrate_required = substrate;
    portion.substrate_required_authority = "extracted";
  }
  const framing = framingRequiredFromSnippet(briefText);
  if (portion.framing_required == null && framing != null) {
    portion.framing_required = framing;
    portion.framing_required_authority = "extracted";
  }
  const removal = finishRemovalFromSnippet(briefText);
  if (portion.finish_removal_required == null && removal != null) {
    portion.finish_removal_required = removal;
    portion.finish_removal_authority = "extracted";
  }
}

function applySnippetToPortion(portion: FlooringPortion, snippet: string): void {
  const specialist = specialistKindFromSnippet(snippet);
  const finish = finishFromSnippet(snippet);
  const label = locationFromSnippet(snippet);
  const area = directAreaFromSnippet(snippet);
  const dims = roomDimensionsFromSnippet(snippet);
  const tile = tileDimensionsFromSnippet(snippet);
  const board = hardwoodWidthFromSnippet(snippet);

  if (specialist) {
    portion.finish_type = "other";
    portion.finish_authority = "extracted";
    portion.specialist_kind = specialist;
    portion.specialist_authority = "extracted";
    portion.other_description = conciseDescription(snippet);
    portion.other_description_authority = "extracted";
  } else if (finish) {
    portion.finish_type = finish;
    portion.finish_authority = "extracted";
    if (finish === "other") {
      portion.other_description = conciseDescription(snippet);
      portion.other_description_authority = "extracted";
    }
  }

  if (label) {
    portion.label = label;
    portion.label_authority = "extracted";
  }

  if (area != null) {
    portion.area_m2 = area;
    portion.area_authority = "extracted";
    portion.area_input_method = "direct_m2";
    portion.area_method_authority = "extracted";
  }
  if (dims.length_m != null) {
    portion.length_m = dims.length_m;
    portion.length_authority = "extracted";
  }
  if (dims.width_m != null) {
    portion.width_m = dims.width_m;
    portion.width_authority = "extracted";
  }
  if (area == null && dims.length_m != null && dims.width_m != null) {
    portion.area_input_method = "length_width";
    portion.area_method_authority = "extracted";
  }

  const underlay = underlayFromSnippet(snippet);
  if (underlay != null) {
    portion.underlay_required = underlay;
    portion.underlay_authority = "extracted";
  }
  const prep = preparationFromSnippet(snippet);
  if (prep != null) {
    portion.floor_preparation_required = prep;
    portion.preparation_authority = "extracted";
  }
  if (tile.width_mm != null) {
    portion.tile_width_mm = tile.width_mm;
    portion.tile_width_authority = "extracted";
  }
  if (tile.length_mm != null) {
    portion.tile_length_mm = tile.length_mm;
    portion.tile_length_authority = "extracted";
  }
  if (board != null) {
    portion.hardwood_board_width_mm = board;
    portion.hardwood_width_authority = "extracted";
  }

  const substrate = substrateRequiredFromSnippet(snippet);
  if (substrate != null) {
    portion.substrate_required = substrate;
    portion.substrate_required_authority = "extracted";
  }
  const family = substrateFamilyFromSnippet(snippet);
  if (family) {
    portion.substrate_family = family;
    portion.substrate_family_authority = "extracted";
    if (portion.substrate_required == null && substrate !== false) {
      portion.substrate_required = true;
      portion.substrate_required_authority = "extracted";
    }
  }
  const itemKey = exactSubstrateItemKeyFromSnippet(snippet);
  if (itemKey) {
    portion.substrate_item_key = itemKey;
    portion.substrate_item_authority = "extracted";
    if (portion.substrate_required == null) {
      portion.substrate_required = true;
      portion.substrate_required_authority = "extracted";
    }
    if (portion.substrate_family == null) {
      portion.substrate_family = itemKey.includes("secura")
        ? "secura"
        : itemKey.includes("plywood")
          ? "structural_plywood"
          : "fibre_cement";
      portion.substrate_family_authority = "extracted";
    }
  }

  const structuralFraming = includesAny(normalise(snippet), [
    "structural framing",
    "engineered framing",
  ]);
  if (structuralFraming) {
    portion.finish_type = portion.finish_type ?? "other";
    portion.finish_authority = portion.finish_authority ?? "extracted";
    portion.specialist_kind = "structural";
    portion.specialist_authority = "extracted";
  }
  const framing = framingRequiredFromSnippet(snippet);
  if (framing != null && !structuralFraming) {
    portion.framing_required = framing;
    portion.framing_required_authority = "extracted";
  }
  const framingLevel = framingLevelFromSnippet(snippet);
  if (framingLevel && portion.framing_required !== false && !structuralFraming) {
    portion.framing_allowance_level = framingLevel;
    portion.framing_level_authority = "extracted";
    if (portion.framing_required == null) {
      portion.framing_required = true;
      portion.framing_required_authority = "extracted";
    }
  }

  const finishRemoval = finishRemovalFromSnippet(snippet);
  if (finishRemoval != null) {
    portion.finish_removal_required = finishRemoval;
    portion.finish_removal_authority = "extracted";
  }
  const existing = existingFinishFromSnippet(snippet);
  if (existing && portion.finish_removal_required !== false) {
    portion.existing_finish_type = existing;
    portion.existing_finish_authority = "extracted";
    if (portion.finish_removal_required == null && finishRemoval !== false) {
      portion.finish_removal_required = true;
      portion.finish_removal_authority = "extracted";
    }
  }
  const substrateRemoval = substrateRemovalFromSnippet(snippet);
  if (substrateRemoval != null) {
    portion.substrate_removal_required = substrateRemoval;
    portion.substrate_removal_authority = "extracted";
  }
}

export function extractFlooringPortionsFromBrief(briefText: string): FlooringPortion[] {
  if (!briefHasIndependentFlooring(briefText)) {
    return [];
  }
  const snippets = splitFlooringSnippets(briefText);
  const portions: FlooringPortion[] = [];
  for (const [index, snippet] of snippets.entries()) {
    if (clauseIsBathroomOwnedFloor(snippet)) continue;
    if (clauseIsKitchenOwnedFloor(snippet)) continue;
    if (!snippetHasFlooringSignal(snippet) && snippets.length > 1) continue;
    const portion = createEmptyFlooringPortion({
      label: locationFromSnippet(snippet),
    });
    applySnippetToPortion(portion, snippet);
    applyGlobalConstraints(portion, briefText);
    portion.clause_ordinal = index;
    if (
      portion.finish_type != null ||
      portion.area_m2 != null ||
      portion.length_m != null ||
      portion.specialist_kind != null ||
      portion.finish_removal_required === true
    ) {
      portions.push(portion);
    }
  }
  return portions;
}

function firstPresent<T>(explicit: T, fallback: T): T {
  if (explicit == null || explicit === "") return fallback;
  return explicit;
}

function fillMissingFlooringPortion(
  primary: FlooringPortion,
  secondary: FlooringPortion
): FlooringPortion {
  const out = cloneFlooringPortion(primary);
  out.label = firstPresent(out.label, secondary.label);
  out.finish_type = firstPresent(out.finish_type, secondary.finish_type);
  out.area_input_method = firstPresent(
    out.area_input_method,
    secondary.area_input_method
  );
  out.length_m = firstPresent(out.length_m, secondary.length_m);
  out.width_m = firstPresent(out.width_m, secondary.width_m);
  out.area_m2 = firstPresent(out.area_m2, secondary.area_m2);
  out.underlay_required = firstPresent(
    out.underlay_required,
    secondary.underlay_required
  );
  out.floor_preparation_required = firstPresent(
    out.floor_preparation_required,
    secondary.floor_preparation_required
  );
  out.tile_width_mm = firstPresent(out.tile_width_mm, secondary.tile_width_mm);
  out.tile_length_mm = firstPresent(out.tile_length_mm, secondary.tile_length_mm);
  out.hardwood_board_width_mm = firstPresent(
    out.hardwood_board_width_mm,
    secondary.hardwood_board_width_mm
  );
  out.substrate_required = firstPresent(
    out.substrate_required,
    secondary.substrate_required
  );
  out.substrate_family = firstPresent(
    out.substrate_family,
    secondary.substrate_family
  );
  out.substrate_item_key = firstPresent(
    out.substrate_item_key,
    secondary.substrate_item_key
  );
  out.framing_required = firstPresent(
    out.framing_required,
    secondary.framing_required
  );
  out.framing_allowance_level = firstPresent(
    out.framing_allowance_level,
    secondary.framing_allowance_level
  );
  out.finish_removal_required = firstPresent(
    out.finish_removal_required,
    secondary.finish_removal_required
  );
  out.existing_finish_type = firstPresent(
    out.existing_finish_type,
    secondary.existing_finish_type
  );
  out.substrate_removal_required = firstPresent(
    out.substrate_removal_required,
    secondary.substrate_removal_required
  );
  out.other_description = firstPresent(
    out.other_description,
    secondary.other_description
  );
  out.specialist_kind = firstPresent(out.specialist_kind, secondary.specialist_kind);
  out.finish_authority = out.finish_authority ?? secondary.finish_authority;
  out.area_method_authority =
    out.area_method_authority ?? secondary.area_method_authority;
  out.length_authority = out.length_authority ?? secondary.length_authority;
  out.width_authority = out.width_authority ?? secondary.width_authority;
  out.area_authority = out.area_authority ?? secondary.area_authority;
  out.underlay_authority = out.underlay_authority ?? secondary.underlay_authority;
  out.preparation_authority =
    out.preparation_authority ?? secondary.preparation_authority;
  out.tile_width_authority =
    out.tile_width_authority ?? secondary.tile_width_authority;
  out.tile_length_authority =
    out.tile_length_authority ?? secondary.tile_length_authority;
  out.hardwood_width_authority =
    out.hardwood_width_authority ?? secondary.hardwood_width_authority;
  out.substrate_required_authority =
    out.substrate_required_authority ?? secondary.substrate_required_authority;
  out.substrate_family_authority =
    out.substrate_family_authority ?? secondary.substrate_family_authority;
  out.substrate_item_authority =
    out.substrate_item_authority ?? secondary.substrate_item_authority;
  out.framing_required_authority =
    out.framing_required_authority ?? secondary.framing_required_authority;
  out.framing_level_authority =
    out.framing_level_authority ?? secondary.framing_level_authority;
  out.finish_removal_authority =
    out.finish_removal_authority ?? secondary.finish_removal_authority;
  out.existing_finish_authority =
    out.existing_finish_authority ?? secondary.existing_finish_authority;
  out.substrate_removal_authority =
    out.substrate_removal_authority ?? secondary.substrate_removal_authority;
  out.label_authority = out.label_authority ?? secondary.label_authority;
  out.other_description_authority =
    out.other_description_authority ?? secondary.other_description_authority;
  out.specialist_authority =
    out.specialist_authority ?? secondary.specialist_authority;
  if (
    primary.finish_type === "other" &&
    secondary.finish_type != null &&
    secondary.finish_type !== "other"
  ) {
    out.finish_type = "other";
    out.specialist_kind = primary.specialist_kind ?? out.specialist_kind;
  }
  return out;
}

function matchAiPortion(
  parsed: FlooringPortion,
  aiPortions: readonly FlooringPortion[],
  index: number,
  used: Set<number>
): FlooringPortion | null {
  const take = (
    predicate: (row: FlooringPortion, i: number) => boolean
  ): FlooringPortion | null => {
    const found = aiPortions.findIndex(
      (row, i) => !used.has(i) && predicate(row, i)
    );
    if (found < 0) return null;
    used.add(found);
    return aiPortions[found] ?? null;
  };
  if (parsed.id) {
    const byId = take((row) => row.id === parsed.id);
    if (byId) return byId;
  }
  if (parsed.clause_ordinal != null) {
    const byOrdinal = take(
      (row) =>
        row.clause_ordinal === parsed.clause_ordinal &&
        flooringPortionFieldsCompatible(row, parsed)
    );
    if (byOrdinal) return byOrdinal;
  }
  const label = parsed.label?.trim().toLowerCase();
  if (label) {
    const byLabel = take(
      (row) =>
        row.label?.trim().toLowerCase() === label &&
        flooringPortionFieldsCompatible(row, parsed)
    );
    if (byLabel) return byLabel;
  }
  const byIndex = take(
    (row, i) => i === index && flooringPortionFieldsCompatible(row, parsed)
  );
  if (byIndex) return byIndex;
  return take((row) => flooringPortionFieldsCompatible(row, parsed));
}

export function mergeFlooringPortionsPreferringDeterministic(
  aiPortions: readonly FlooringPortion[],
  parsedPortions: readonly FlooringPortion[]
): FlooringPortion[] {
  const parsed = parsedPortions.map(cloneFlooringPortion);
  const ai = normalizeExtractedFlooringPortions(aiPortions);
  if (parsed.length > 0) {
    const used = new Set<number>();
    return parsed.map((portion, index) => {
      const match = matchAiPortion(portion, ai, index, used);
      if (!match) return portion;
      if (
        portion.finish_type === "other" &&
        match.finish_type != null &&
        match.finish_type !== "other"
      ) {
        return portion;
      }
      if (
        match.finish_type === "other" &&
        portion.finish_type != null &&
        portion.finish_type !== "other"
      ) {
        return fillMissingFlooringPortion(match, portion);
      }
      return fillMissingFlooringPortion(portion, match);
    });
  }
  return ai.map(cloneFlooringPortion);
}

function flooringPortionsFactNameMatches(
  factName: string | null | undefined,
  wanted?: string | null
): boolean {
  const name = factName ?? "";
  if (wanted != null && wanted !== "") {
    return name === wanted || name === "";
  }
  return true;
}

export function readAiFlooringPortionsFromExtraction(
  extraction: AIExtractionOutput,
  workAreaName?: string
): FlooringPortion[] {
  const facts = extraction.facts.filter(
    (fact) =>
      fact.key === FLOORING_PORTIONS_FACT_KEY &&
      fact.work_area_type === "flooring" &&
      flooringPortionsFactNameMatches(fact.work_area_name, workAreaName)
  );
  const out: FlooringPortion[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    for (const portion of normalizeExtractedFlooringPortions(fact.value)) {
      if (seen.has(portion.id)) continue;
      seen.add(portion.id);
      out.push(portion);
    }
  }
  return out;
}

export function applyExtractedFlooringToFacts(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly portions: readonly FlooringPortion[];
}): EstimateFact[] {
  return applyFlooringFactWrite({
    facts: params.facts,
    workAreaId: params.workAreaId,
    key: FLOORING_PORTIONS_FACT_KEY,
    value: [...params.portions],
    factSource: "ai_extracted",
  });
}

export function seedExtractedFlooringFact(
  extraction: AIExtractionOutput,
  params: {
    readonly portions: readonly FlooringPortion[];
    readonly workAreaName?: string;
  }
): void {
  const seeded = applyExtractedFlooringToFacts({
    facts: [],
    workAreaId: "extract",
    portions: params.portions,
  });
  const portions = seeded.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)
    ?.value;
  const parsed = parseFlooringPortions(portions);
  if (parsed.length === 0) return;
  extraction.facts = extraction.facts.filter(
    (fact) =>
      !(
        fact.key === FLOORING_PORTIONS_FACT_KEY &&
        fact.work_area_type === "flooring" &&
        flooringPortionsFactNameMatches(fact.work_area_name, params.workAreaName)
      )
  );
  extraction.facts.push({
    work_area_type: "flooring",
    work_area_name: params.workAreaName,
    key: FLOORING_PORTIONS_FACT_KEY,
    label: "Flooring areas",
    value: parsed as unknown as Record<string, unknown>[],
    confidence: 0.9,
  });
}

const LEGACY_FLOORING_FACT_KEYS = new Set([
  "flooring.area_m2",
  "flooring.type",
  "flooring.supply_scope",
  "flooring.client_supplied",
  "flooring.existing_flooring_removal",
  "flooring.floor_prep_level",
  "flooring.underlay_included",
  "flooring.scotia_included",
  "flooring.stairs_or_landings_included",
  "flooring.disposal_included",
  "flooring.subfloor_replacement_required",
  "flooring.new_flooring_included",
  "flooring.stair_count",
  "flooring.landing_area_m2",
]);

export function stripLegacyFlooringFactsFromExtraction(
  extraction: AIExtractionOutput
): void {
  extraction.facts = extraction.facts.filter(
    (fact) => !LEGACY_FLOORING_FACT_KEYS.has(fact.key)
  );
}

export function flooringExtractionHasBathroomOverlap(
  portions: readonly FlooringPortion[],
  hasBathroomWorkArea: boolean
): boolean {
  if (!hasBathroomWorkArea) return false;
  return portions.some((row) => {
    const label = row.label?.trim().toLowerCase() ?? "";
    return label === "ensuite" || label === "bathroom";
  });
}
