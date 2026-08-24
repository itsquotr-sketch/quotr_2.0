import type { AIExtractionOutput } from "@/lib/ai/schema";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import { shouldDropDuplicateFactOnIngest } from "@/lib/project-conditions/canonical";
import {
  briefHasExplicitPileSpacing,
  briefHasSpoilCartingLanguage,
  briefRequiresExcavation,
  matchCarryDistanceMetresFromBrief,
  matchRetainingWallLengthM,
  matchRetainingWallRakingHeightsM,
} from "@/lib/project-conditions/brief-logistics";

export type QualityLevelExtract = "budget" | "standard" | "premium";

export type ExtractedConstraint = {
  key: string;
  label: string;
  value: string | number | boolean;
};

export type BriefEnrichmentResult = {
  extraction: AIExtractionOutput;
  qualityLevel: QualityLevelExtract | null;
  constraints: ExtractedConstraint[];
};

const CATALOGUE_LABELS = new Map(
  SCOPE_CATALOGUE.map((item) => [item.type, item.label])
);

function normaliseBrief(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function matchAreaM2(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*m²|\b(\d+(?:\.\d+)?)\s*(?:square\s*metre|sqm|m2)\b/i);
  if (!match) return null;
  const value = Number(match[1] ?? match[2]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function matchLinearMetres(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:lm|linear\s*metre|m\s+(?:of|long))/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function matchCartingDistanceM(text: string): number | null {
  const fromLogistics = matchCarryDistanceMetresFromBrief(text);
  if (fromLogistics != null) return fromLogistics;
  const patterns = [
    /cart(?:ed|ing)?\s*(?:distance\s*)?(?:of\s*)?(\d+)\s*m/i,
    /carried\s*(\d+)\s*m/i,
    /hand[-\s]?carried?\s*(?:approximately\s*|approx\.?\s*|about\s*)?(\d+)\s*(?:–|-|to)\s*(\d+)\s*m/i,
    /hand[-\s]?carried?\s*(?:approximately\s*|approx\.?\s*|about\s*)?(\d+)\s*m/i,
    /(?:waste|materials?).*?(?:hand[-\s]?carried?|carried).*?(\d+)\s*(?:–|-|to)\s*(\d+)\s*m/i,
    /(?:waste|materials?).*?(?:hand[-\s]?carried?|carried).*?(\d+)\s*m/i,
    /waste\s+(?:to\s+be\s+)?cart(?:ed)?\s*(\d+)\s*m/i,
    /(?:waste\s+)?carting\s+(?:(?:about|approximately|approx\.?)\s+)?(\d+)\s*(?:–|-|to)\s*(\d+)\s*m/i,
    /(?:waste\s+)?carting\s+(?:(?:about|approximately|approx\.?)\s+)?(\d+)\s*m/i,
    /(?:approximately|approx\.?|about)\s*(\d+)\s*(?:–|-|to)\s*(\d+)\s*m\s+(?:manual\s+)?(?:hand[-\s]?carry|carry|carting)/i,
    /(\d+)\s*(?:–|-|to)\s*(\d+)\s*m\s+(?:manual\s+)?(?:hand[-\s]?carry|carry|carting)/i,
    /(\d+)\s*m\s+(?:manual\s+)?(?:hand[-\s]?carry|carry|carting)/i,
    /manual\s+carry(?:\s+for\s+(?:materials?|waste|materials?\s+and\s+waste))?\s*(?:of\s*|for\s*)?(?:approximately\s*|approx\.?\s*|about\s*)?(\d+)\s*(?:–|-|to)\s*(\d+)\s*m/i,
    /(\d+)\s*m\s+(?:to\s+)?(?:skip|bin)/i,
    /(\d+)\s*m\s+carting/i,
    /carting\s+distance\s+(\d+)\s*m/i,
    // Intentionally NO bare "approximately N–M m" pattern — that over-maps
    // deck dimensions / other distances into material_carry_distance.
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const a = Number(match[1]);
      const b = match[2] != null ? Number(match[2]) : null;
      if (Number.isFinite(a) && a > 0) {
        // Prefer upper bound of a range for band mapping (25–30 → 30 → 10–30m).
        if (b != null && Number.isFinite(b) && b > 0) {
          return Math.max(a, b);
        }
        return a;
      }
    }
  }
  return null;
}

function matchRiserCount(text: string): number | null {
  const match = text.match(/(\d+)\s*-?\s*step/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function hasWorkAreaType(
  extraction: AIExtractionOutput,
  type: string
): boolean {
  return extraction.workAreas.some((wa) => wa.type === type);
}

function addWorkAreaIfMissing(
  extraction: AIExtractionOutput,
  type: string,
  confidence: number,
  rationale: string,
  allowedTypes: string[]
): void {
  if (!allowedTypes.includes(type)) return;
  if (hasWorkAreaType(extraction, type)) return;
  extraction.workAreas.push({
    type,
    confidence,
    rationale,
  });
}

function addFact(
  extraction: AIExtractionOutput,
  params: {
    workAreaType: string | null;
    key: string;
    label: string;
    value: string | number | boolean | string[];
    unit?: string;
    confidence?: number;
  }
): void {
  if (shouldDropDuplicateFactOnIngest(params.key)) return;
  const exists = extraction.facts.some(
    (fact) =>
      fact.key === params.key && fact.work_area_type === params.workAreaType
  );
  if (exists) return;

  extraction.facts.push({
    work_area_type: params.workAreaType,
    key: params.key,
    label: params.label,
    value: params.value,
    unit: params.unit,
    confidence: params.confidence ?? 0.85,
  });
}

/** Insert or overwrite — used for polarity corrections (explicit no/yes). */
function upsertFact(
  extraction: AIExtractionOutput,
  params: {
    workAreaType: string | null;
    key: string;
    label: string;
    value: string | number | boolean | string[];
    unit?: string;
    confidence?: number;
  }
): void {
  if (shouldDropDuplicateFactOnIngest(params.key)) return;
  const existing = extraction.facts.find(
    (fact) =>
      fact.key === params.key && fact.work_area_type === params.workAreaType
  );
  if (existing) {
    existing.value = params.value;
    existing.label = params.label;
    if (params.unit !== undefined) existing.unit = params.unit;
    if (params.confidence !== undefined) existing.confidence = params.confidence;
    return;
  }
  addFact(extraction, params);
}

function inferPainting(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  const patterns = [
    "paint wall",
    "paint ceiling",
    "repaint",
    "two coats",
    "2 coats",
    "paint doors",
    "paint trims",
  ];
  if (!includesAny(brief, patterns)) return;

  addWorkAreaIfMissing(
    extraction,
    "painting",
    0.82,
    "Painting mentioned in brief",
    allowedTypes
  );

  if (includesAny(brief, ["internal", "walls and ceiling", "walls and ceilings"])) {
    addFact(extraction, {
      workAreaType: "painting",
      key: "painting.location",
      label: "Location",
      value: "Internal",
    });
  }

  const areaMatch = brief.match(/(\d+(?:\.\d+)?)\s*m²\s+total/i);
  if (areaMatch) {
    addFact(extraction, {
      workAreaType: "painting",
      key: "painting.internal_area_m2",
      label: "Internal area",
      value: Number(areaMatch[1]),
      unit: "m²",
    });
  }
}

function inferInternalWalls(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  const patterns = [
    "internal wall",
    "timber framed wall",
    "timber framed internal",
    "m of new internal wall",
    "line both sides with",
    "new internal wall",
  ];
  if (!includesAny(brief, patterns)) return;

  addWorkAreaIfMissing(
    extraction,
    "internal_walls",
    0.85,
    "Internal walls mentioned in brief",
    allowedTypes
  );

  const length = matchLinearMetres(brief);
  if (length !== null) {
    addFact(extraction, {
      workAreaType: "internal_walls",
      key: "internal_walls.length_lm",
      label: "Wall length",
      value: length,
      unit: "lm",
    });
  }

  const heightMatch = brief.match(/(\d+(?:\.\d+)?)\s*m\s+high/i);
  if (heightMatch) {
    addFact(extraction, {
      workAreaType: "internal_walls",
      key: "internal_walls.height_m",
      label: "Wall height",
      value: Number(heightMatch[1]),
      unit: "m",
    });
  }

  if (includesAny(brief, ["timber framed", "timber frame"])) {
    addFact(extraction, {
      workAreaType: "internal_walls",
      key: "internal_walls.framing_type",
      label: "Framing type",
      value: "Timber",
    });
  }

  if (includesAny(brief, ["line both sides", "both sides"])) {
    addFact(extraction, {
      workAreaType: "internal_walls",
      key: "internal_walls.lining_sides",
      label: "Lining sides",
      value: "Both sides",
    });
  }

  if (includesAny(brief, ["gib", "plasterboard"])) {
    addFact(extraction, {
      workAreaType: "internal_walls",
      key: "internal_walls.wall_lining_type",
      label: "Wall lining",
      value: "Plasterboard",
    });
  }

  if (includesAny(brief, ["insulate"])) {
    addFact(extraction, {
      workAreaType: "internal_walls",
      key: "internal_walls.insulation_included",
      label: "Insulation",
      value: true,
    });
  }

  if (includesAny(brief, ["skirting"])) {
    addFact(extraction, {
      workAreaType: "internal_walls",
      key: "internal_walls.skirtings_included",
      label: "Skirtings",
      value: true,
    });
  }
}

function inferDoors(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  const doorMatch = brief.match(/(\d+)\s+(?:solid core\s+)?(?:internal\s+)?doors?/i);
  const hasDoors =
    doorMatch !== null ||
    includesAny(brief, ["solid core door", "internal door", "install 2 internal"]);

  if (!hasDoors) return;

  addWorkAreaIfMissing(
    extraction,
    "doors",
    0.84,
    "Doors mentioned in brief",
    allowedTypes
  );

  if (doorMatch) {
    addFact(extraction, {
      workAreaType: "doors",
      key: "doors.count",
      label: "Door count",
      value: Number(doorMatch[1]),
    });
  }

  if (includesAny(brief, ["solid core"])) {
    addFact(extraction, {
      workAreaType: "doors",
      key: "doors.door_type",
      label: "Door type",
      value: "Solid core",
    });
  }

  if (
    includesAny(brief, [
      "client supplying doors",
      "client supplied doors",
      "client supplying kitchen cabinets and doors",
    ])
  ) {
    addFact(extraction, {
      workAreaType: "doors",
      key: "doors.client_supplied",
      label: "Client supplied doors",
      value: true,
    });
  }
}

function inferKitchen(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  if (!includesAny(brief, ["kitchen", "cabinetry", "flatpack", "benchtop", "splashback"])) {
    return;
  }

  addWorkAreaIfMissing(
    extraction,
    "kitchen",
    0.86,
    "Kitchen mentioned in brief",
    allowedTypes
  );

  if (includesAny(brief, ["remove existing kitchen"])) {
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.demolition_required",
      label: "Demolition required",
      value: true,
    });
  }

  if (
    includesAny(brief, [
      "client supplying kitchen",
      "client supplying kitchen cabinets",
      "client supplied cabinetry",
      "client-supplied flatpack",
      "client supplying kitchen cabinets and doors",
    ])
  ) {
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.cabinetry_client_supplied",
      label: "Client supplied cabinetry",
      value: true,
    });
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.cabinetry_included",
      label: "Cabinetry included",
      value: true,
    });
  }

  if (includesAny(brief, ["flatpack"])) {
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.cabinetry_type",
      label: "Cabinetry type",
      value: "Flatpack",
    });
  }

  if (includesAny(brief, ["benchtop"])) {
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.benchtop_included",
      label: "Benchtop included",
      value: true,
    });
  }

  if (includesAny(brief, ["splashback"])) {
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.splashback_included",
      label: "Splashback included",
      value: true,
    });
  }

  if (includesAny(brief, ["rangehood"])) {
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.rangehood_included",
      label: "Rangehood included",
      value: true,
    });
  }

  if (includesAny(brief, ["plumbing and electrical by others", "by others"])) {
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.plumbing_changes",
      label: "Plumbing changes",
      value: "None",
    });
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.electrical_changes",
      label: "Electrical changes",
      value: "None",
    });
  } else if (includesAny(brief, ["minor electrical"])) {
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.electrical_changes",
      label: "Electrical changes",
      value: "Minor",
    });
  }
}

function inferBathroom(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  if (!includesAny(brief, ["bathroom"])) return;

  addWorkAreaIfMissing(
    extraction,
    "bathroom",
    0.88,
    "Bathroom mentioned in brief",
    allowedTypes
  );

  if (includesAny(brief, ["full bathroom", "strip-out", "strip out"])) {
    addFact(extraction, {
      workAreaType: "bathroom",
      key: "bathroom.demolition_required",
      label: "Demolition required",
      value: true,
    });
  }

  if (includesAny(brief, ["no tiling", "without tiling"])) {
    addFact(extraction, {
      workAreaType: "bathroom",
      key: "bathroom.tiling_included",
      label: "Tiling included",
      value: false,
    });
  } else if (includesAny(brief, ["tiling", "tiled shower", "floor tiling", "wall tiling"])) {
    addFact(extraction, {
      workAreaType: "bathroom",
      key: "bathroom.tiling_included",
      label: "Tiling included",
      value: true,
    });
  }

  if (includesAny(brief, ["client supplying", "client supplied"])) {
    addFact(extraction, {
      workAreaType: "bathroom",
      key: "bathroom.fixtures_client_supplied",
      label: "Fixtures client supplied",
      value: true,
    });
  }
}

function inferDeck(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  if (/\d+\s*-?\s*step/.test(brief) && !includesAny(brief, ["m²", "square metre", "kwila deck", "hardwood deck"])) {
    return;
  }

  const mentionsDeck = includesAny(brief, [
    "deck",
    "kwila",
    "hardwood deck",
    " decking",
  ]);

  if (!mentionsDeck) return;

  if (
    includesAny(brief, [
      "to an existing deck",
      "to existing deck",
      "existing deck,",
    ]) &&
    !includesAny(brief, ["m² deck", "deck using", "deck with", "build a", "build new"])
  ) {
    return;
  }

  const buildingDeck =
    includesAny(brief, [
      "m² deck",
      "m² kwila",
      "kwila deck",
      "hardwood deck",
      "square metre deck",
      "deck using",
      "deck with",
      "build a deck",
      "build new deck",
      "new deck",
    ]) ||
    (includesAny(brief, ["build"]) &&
      mentionsDeck &&
      !includesAny(brief, [
        "retaining wall",
        "internal wall",
        "fence",
        "pergola",
        "bathroom",
        "kitchen",
      ]));

  if (!buildingDeck) return;

  addWorkAreaIfMissing(
    extraction,
    "deck",
    0.9,
    "Deck mentioned in brief",
    allowedTypes
  );

  const area = matchAreaM2(brief);
  if (area !== null) {
    const side = Math.round(Math.sqrt(area) * 10) / 10;
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.length_m",
      label: "Deck length",
      value: side,
      unit: "m",
    });
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.width_m",
      label: "Deck width",
      value: side,
      unit: "m",
    });
  }

  if (includesAny(brief, ["kwila"])) {
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.board_material",
      label: "Board material",
      value: "Kwila",
    });
  }

  if (includesAny(brief, ["hardwood"])) {
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.board_material",
      label: "Board material",
      value: "Hardwood",
    });
  }

  if (includesAny(brief, ["140mm"])) {
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.board_width_mm",
      label: "Board width",
      value: 140,
    });
  }

  if (
    includesAny(brief, [
      "vertical face",
      "face boards",
      "fascia",
      "include fascia",
    ])
  ) {
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.vertical_face_boards_required",
      label: "Vertical face boards",
      value: true,
    });
  }

  if (
    includesAny(brief, [
      "remove existing deck",
      "remove existing timber deck",
      "replace an existing",
      "replace existing deck",
    ])
  ) {
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.existing_deck_removal",
      label: "Existing deck removal",
      value: true,
    });
  }

  // Explicit negatives / unknown must win over bare substring "balustrade".
  const balustradeExplicitNo = includesAny(brief, [
    "no balustrade",
    "without balustrade",
    "no new balustrade",
    "balustrade not required",
    "balustrade not needed",
    "balustrades not required",
    "not requiring a balustrade",
    "not requiring balustrade",
    "no railing required",
    "no railings required",
  ]);
  const balustradeUnknown = includesAny(brief, [
    "balustrade condition unknown",
    "balustrade unknown",
    "unknown if balustrade",
    "not sure about balustrade",
    "unsure about balustrade",
    "balustrade not sure",
  ]);
  if (balustradeExplicitNo) {
    upsertFact(extraction, {
      workAreaType: "deck",
      key: "deck.balustrade_required",
      label: "Balustrade required",
      value: false,
    });
  } else if (balustradeUnknown) {
    // Leave unknown — do not invent a boolean from the word "balustrade".
  } else if (
    includesAny(brief, [
      "new balustrade",
      "balustrade required",
      "include balustrade",
      "with balustrade",
      "balustrade",
      "railing required",
    ])
  ) {
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.balustrade_required",
      label: "Balustrade required",
      value: true,
    });
  }

  if (includesAny(brief, ["stairs down", "stair set", "include stairs"])) {
    if (!hasWorkAreaType(extraction, "external_stairs")) {
      addFact(extraction, {
        workAreaType: "deck",
        key: "deck.access_type",
        label: "Access type",
        value: "Stair set",
      });
    }
  } else if (includesAny(brief, ["no stairs", "without stairs"])) {
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.access_type",
      label: "Access type",
      value: "None",
    });
  }

  if (includesAny(brief, ["ground level", "ground-level"])) {
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.level",
      label: "Deck level",
      value: "Ground-level",
    });
  }
}

function inferFence(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  if (!includesAny(brief, ["fence", "boundary"])) return;

  addWorkAreaIfMissing(
    extraction,
    "fence",
    0.86,
    "Fence mentioned in brief",
    allowedTypes
  );

  if (includesAny(brief, ["remove existing fence"])) {
    addFact(extraction, {
      workAreaType: "fence",
      key: "fence.demolition_required",
      label: "Demolition required",
      value: true,
    });
    addFact(extraction, {
      workAreaType: "fence",
      key: "fence.disposal_required",
      label: "Disposal required",
      value: true,
    });
  }

  if (includesAny(brief, ["gate", "pedestrian gate"])) {
    addFact(extraction, {
      workAreaType: "fence",
      key: "fence.gate_included",
      label: "Gate included",
      value: true,
    });
  }

  const lengthMatch = brief.match(/(\d+(?:\.\d+)?)\s*lm/i);
  if (lengthMatch) {
    addFact(extraction, {
      workAreaType: "fence",
      key: "fence.length_m",
      label: "Fence length",
      value: Number(lengthMatch[1]),
      unit: "m",
    });
  }

  const heightMatch = brief.match(/(\d+(?:\.\d+)?)\s*m\s+high/i);
  if (heightMatch) {
    addFact(extraction, {
      workAreaType: "fence",
      key: "fence.height_m",
      label: "Fence height",
      value: Number(heightMatch[1]),
      unit: "m",
    });
  }
}

function inferPergola(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  if (!includesAny(brief, ["pergola"])) return;

  addWorkAreaIfMissing(
    extraction,
    "pergola",
    0.88,
    "Pergola mentioned in brief",
    allowedTypes
  );

  if (includesAny(brief, ["attached", "aluminium"])) {
    addFact(extraction, {
      workAreaType: "pergola",
      key: "pergola.attached",
      label: "Attachment",
      value: "Attached",
    });
    addFact(extraction, {
      workAreaType: "pergola",
      key: "pergola.material",
      label: "Material",
      value: "Aluminium",
    });
  }

  if (includesAny(brief, ["colorsteel", "roof", "roofing"])) {
    addFact(extraction, {
      workAreaType: "pergola",
      key: "pergola.roofing_included",
      label: "Roofing included",
      value: true,
    });
  }

  if (includesAny(brief, ["gutter"])) {
    addFact(extraction, {
      workAreaType: "pergola",
      key: "pergola.gutters_included",
      label: "Gutters included",
      value: true,
    });
  }
}

function inferRetainingWall(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  if (!includesAny(brief, ["retaining wall"])) return;

  addWorkAreaIfMissing(
    extraction,
    "retaining_wall",
    0.9,
    "Retaining wall mentioned in brief",
    allowedTypes
  );

  const lengthM = matchRetainingWallLengthM(brief);
  if (lengthM != null) {
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.length_m",
      label: "Wall length",
      value: lengthM,
      unit: "m",
    });
  }

  const raking = matchRetainingWallRakingHeightsM(brief);
  if (raking) {
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.is_raking",
      label: "Is raking",
      value: true,
    });
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.height_high_m",
      label: "High-end height",
      value: raking.highM,
      unit: "m",
    });
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.height_low_m",
      label: "Low-end height",
      value: raking.lowM,
      unit: "m",
    });
  } else if (includesAny(brief, ["raking"])) {
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.is_raking",
      label: "Is raking",
      value: true,
    });
  }

  if (includesAny(brief, ["timber retaining"])) {
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.material",
      label: "Wall material",
      value: "Timber",
    });
  }

  if (briefRequiresExcavation(brief)) {
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.excavation_required",
      label: "Excavation required",
      value: true,
    });
  }

  if (includesAny(brief, ["face fixed", "face-fixed"])) {
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.fixing_type",
      label: "Fixing type",
      value: "Face-fixed",
    });
  }

  if (includesAny(brief, ["novacoil", "drainage"])) {
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.drainage_required",
      label: "Drainage required",
      value: true,
    });
  }

  if (includesAny(brief, ["backfill"])) {
    addFact(extraction, {
      workAreaType: "retaining_wall",
      key: "retaining_wall.backfill_included",
      label: "Backfill included",
      value: true,
    });
  }
}

/** Drop invented RW logistics/spacing facts. Canonical Project Conditions own access/carry. */
function sanitizeRetainingWallExtractedFacts(
  brief: string,
  extraction: AIExtractionOutput
): void {
  extraction.facts = extraction.facts.filter((fact) => {
    if (
      fact.key === "retaining_wall.post_spacing_m" &&
      !briefHasExplicitPileSpacing(brief)
    ) {
      return false;
    }
    if (
      fact.key === "retaining_wall.carting_distance_m" &&
      !briefHasSpoilCartingLanguage(brief)
    ) {
      return false;
    }
    return true;
  });
}

function inferExternalStairs(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  const patterns = [
    "external stair",
    "outdoor stair",
    "timber stair",
    "deck stair",
    "stairs to deck",
    "stair set",
    "steps with handrail",
    "remove existing stairs",
    "remove existing stair",
    "-step ",
    " step ",
  ];
  const riserCount = matchRiserCount(brief);
  const hasStairPhrase =
    includesAny(brief, patterns) || riserCount !== null;

  if (!hasStairPhrase) return;

  addWorkAreaIfMissing(
    extraction,
    "external_stairs",
    0.9,
    "External stairs mentioned in brief",
    allowedTypes
  );

  if (riserCount !== null) {
    addFact(extraction, {
      workAreaType: "external_stairs",
      key: "external_stairs.risers_count",
      label: "Riser count",
      value: riserCount,
    });
  }

  if (includesAny(brief, ["handrail", "with handrail"])) {
    addFact(extraction, {
      workAreaType: "external_stairs",
      key: "external_stairs.handrail_included",
      label: "Handrail included",
      value: true,
    });
  }

  if (includesAny(brief, ["remove existing stair", "remove existing stairs"])) {
    addFact(extraction, {
      workAreaType: "external_stairs",
      key: "external_stairs.existing_removal",
      label: "Existing stairs removal",
      value: true,
    });
  }

  if (includesAny(brief, ["treated timber", "treated pine"])) {
    addFact(extraction, {
      workAreaType: "external_stairs",
      key: "external_stairs.material",
      label: "Stair material",
      value: "Treated timber",
    });
  }

  if (includesAny(brief, ["sloping ground", "slightly sloping"])) {
    addFact(extraction, {
      workAreaType: "external_stairs",
      key: "external_stairs.ground_condition",
      label: "Ground condition",
      value: "Sloping",
    });
  }

  const widthMatch = brief.match(/(\d+(?:\.\d+)?)\s*m\s+wide/i);
  if (widthMatch) {
    addFact(extraction, {
      workAreaType: "external_stairs",
      key: "external_stairs.width_m",
      label: "Stair width",
      value: Number(widthMatch[1]),
      unit: "m",
    });
  }
}

function inferPlastering(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  const patterns = [
    "level 4 stop",
    "level 5 skim",
    "level 4 stopping",
    "level 5 stopping",
    "stop new gib",
    "plastering",
    "stopping",
    "sand ready for paint",
    "patch repair",
    "level 4",
    "level 5",
  ];

  const gibLinedWall =
    includesAny(brief, ["lined both sides with gib", "lined with gib", "gib"]) &&
    includesAny(brief, ["internal wall", "new internal wall", "build"]);

  if (!includesAny(brief, patterns) && !gibLinedWall) return;

  addWorkAreaIfMissing(
    extraction,
    "plastering",
    0.88,
    "Plastering/stopping mentioned in brief",
    allowedTypes
  );

  const area = matchAreaM2(brief);
  if (area !== null) {
    addFact(extraction, {
      workAreaType: "plastering",
      key: "plastering.area_m2",
      label: "Plastering area",
      value: area,
      unit: "m²",
    });
  }

  if (includesAny(brief, ["level 4"])) {
    addFact(extraction, {
      workAreaType: "plastering",
      key: "plastering.level",
      label: "Plastering level",
      value: "Level 4",
    });
  } else if (includesAny(brief, ["level 5"])) {
    addFact(extraction, {
      workAreaType: "plastering",
      key: "plastering.level",
      label: "Plastering level",
      value: "Level 5",
    });
  } else if (gibLinedWall) {
    addFact(extraction, {
      workAreaType: "plastering",
      key: "plastering.level",
      label: "Plastering level",
      value: "Level 4",
    });
  }

  const wallLength = matchLinearMetres(brief);
  const heightMatch = brief.match(/(\d+(?:\.\d+)?)\s*m\s+high/i);
  if (gibLinedWall && wallLength && heightMatch) {
    const height = Number(heightMatch[1]);
    const bothSides = includesAny(brief, ["both sides"]);
    const factor = bothSides ? 2 : 1;
    if (Number.isFinite(height) && height > 0) {
      addFact(extraction, {
        workAreaType: "plastering",
        key: "plastering.area_m2",
        label: "Plastering area",
        value: Math.round(wallLength * height * factor * 100) / 100,
        unit: "m²",
      });
    }
  }

  if (includesAny(brief, ["stop new gib", "new plasterboard", "new gib", "lined with gib"])) {
    addFact(extraction, {
      workAreaType: "plastering",
      key: "plastering.surface_type",
      label: "Surface type",
      value: "New plasterboard",
    });
  }

  if (includesAny(brief, ["sand ready for paint", "sanding"])) {
    addFact(extraction, {
      workAreaType: "plastering",
      key: "plastering.sanding_included",
      label: "Sanding included",
      value: true,
    });
  }
}

function isFlooringRemovalOnly(brief: string): boolean {
  return (
    includesAny(brief, [
      "flooring removal only",
      "remove only",
      "no new flooring",
      "removal only",
    ]) ||
    (includesAny(brief, ["remove carpet", "remove vinyl", "remove flooring", "uplift flooring"]) &&
      !includesAny(brief, ["lay ", "install ", "new vinyl", "new carpet", "new flooring"]))
  );
}

function inferDemolitionAndRemoval(
  brief: string,
  extraction: AIExtractionOutput,
  allowedTypes: string[]
): void {
  const removalPhrases = [
    "remove existing kitchen",
    "remove existing flooring",
    "remove carpet",
    "remove vinyl",
    "flooring removal",
    "uplift flooring",
    "strip out",
    "strip-out",
    "soft strip",
    "rip out",
    "remove existing fence",
    "remove existing deck",
  ];

  if (!includesAny(brief, removalPhrases) && !isFlooringRemovalOnly(brief)) {
    return;
  }

  if (includesAny(brief, ["remove existing kitchen"]) && hasWorkAreaType(extraction, "kitchen")) {
    addFact(extraction, {
      workAreaType: "kitchen",
      key: "kitchen.demolition_required",
      label: "Demolition required",
      value: true,
    });
  }

  if (includesAny(brief, ["strip out bathroom", "bathroom strip-out", "strip-out"]) &&
    hasWorkAreaType(extraction, "bathroom")) {
    addFact(extraction, {
      workAreaType: "bathroom",
      key: "bathroom.demolition_required",
      label: "Demolition required",
      value: true,
    });
  }

  if (includesAny(brief, ["remove existing fence"]) && hasWorkAreaType(extraction, "fence")) {
    addFact(extraction, {
      workAreaType: "fence",
      key: "fence.demolition_required",
      label: "Demolition required",
      value: true,
    });
  }

  if (includesAny(brief, ["remove existing deck"]) && hasWorkAreaType(extraction, "deck")) {
    addFact(extraction, {
      workAreaType: "deck",
      key: "deck.existing_deck_removal",
      label: "Existing deck removal",
      value: true,
    });
  }

  const hasExplicitFlooringRemoval =
    includesAny(brief, [
      "remove carpet",
      "remove vinyl",
      "remove flooring",
      "remove 20m²",
      "remove 20m2",
      "vinyl flooring",
      "flooring removal",
    ]) && includesAny(brief, ["remove"]);

  const standaloneDemolition =
    isFlooringRemovalOnly(brief) ||
    includesAny(brief, ["soft strip", "strip out office", "office soft strip"]) ||
    hasExplicitFlooringRemoval ||
    (includesAny(brief, ["remove carpet", "remove vinyl", "remove flooring"]) &&
      !hasWorkAreaType(extraction, "flooring"));

  if (standaloneDemolition) {
    addWorkAreaIfMissing(
      extraction,
      "demolition",
      0.85,
      "Standalone removal/strip-out in brief",
      allowedTypes
    );

    const floorArea = matchAreaM2(brief);
    if (floorArea !== null) {
      addFact(extraction, {
        workAreaType: "demolition",
        key: "demolition.floor_area_m2",
        label: "Floor area",
        value: floorArea,
        unit: "m²",
      });
      addFact(extraction, {
        workAreaType: "demolition",
        key: "demolition.scope_items",
        label: "Scope items",
        value: ["Flooring"],
      });
    }

    if (includesAny(brief, ["soft strip", "strip out", "strip-out"])) {
      addFact(extraction, {
        workAreaType: "demolition",
        key: "demolition.scope_items",
        label: "Scope items",
        value: ["General strip-out"],
      });
    }

    addFact(extraction, {
      workAreaType: "demolition",
      key: "demolition.disposal_included",
      label: "Disposal included",
      value: true,
    });
  }

  if (isFlooringRemovalOnly(brief) && hasWorkAreaType(extraction, "flooring")) {
    addFact(extraction, {
      workAreaType: "flooring",
      key: "flooring.supply_scope",
      label: "Supply scope",
      value: "Removal only",
    });
    addFact(extraction, {
      workAreaType: "flooring",
      key: "flooring.existing_flooring_removal",
      label: "Existing flooring removal",
      value: true,
    });
  }
}

function inferNoTiling(brief: string, extraction: AIExtractionOutput): void {
  if (!includesAny(brief, ["no tiling", "without tiling", "not tiling"])) return;
  if (!hasWorkAreaType(extraction, "bathroom")) return;

  addFact(extraction, {
    workAreaType: "bathroom",
    key: "bathroom.tiling_included",
    label: "Tiling included",
    value: false,
  });
}

export function extractQualityFromBrief(
  briefText: string
): QualityLevelExtract | null {
  const brief = normaliseBrief(briefText);

  if (
    includesAny(brief, [
      "premium",
      "high quality",
      "architectural",
      "luxury",
      "high-quality",
    ])
  ) {
    return "premium";
  }

  if (
    includesAny(brief, [
      "standard",
      "average",
      "decent",
      "mid-range",
      "mid range",
      "midrange",
    ])
  ) {
    return "standard";
  }

  if (includesAny(brief, ["basic", "budget"])) {
    return "budget";
  }

  return null;
}

function mapAccessConstraint(brief: string): string | null {
  if (includesAny(brief, ["very poor access", "very_poor access"])) {
    return "Difficult";
  }
  if (
    includesAny(brief, [
      "poor access",
      "difficult access",
      "access is poor",
      "access is restricted",
      "site access is restricted",
      "narrow access",
      "narrow side access",
      "narrow side path",
      "restricted access",
      "restricted rear access",
      "restricted site access",
      "restricted side access",
      "difficult/restricted access",
      "difficult / restricted access",
    ]) ||
    /restricted(?:\s+\w+){0,3}\s+access/.test(brief) ||
    /access(?:\s+\w+){0,3}\s+restricted/.test(brief) ||
    /narrow(?:\s+\w+){0,2}\s+(?:access|path)/.test(brief)
  ) {
    return "Difficult";
  }
  if (includesAny(brief, ["moderate access"])) {
    return "Moderate";
  }
  if (includesAny(brief, ["easy access"])) {
    return "Easy";
  }
  return null;
}

function mapCarryDistanceConstraint(distanceM: number | null): string | null {
  if (distanceM === null) return null;
  if (distanceM < 10) return "< 10m";
  if (distanceM <= 30) return "10–30m";
  return "> 30m";
}

export function extractConstraintsFromBrief(
  briefText: string
): ExtractedConstraint[] {
  const brief = normaliseBrief(briefText);
  const constraints: ExtractedConstraint[] = [];
  const cartingM = matchCartingDistanceM(brief);

  const siteAccess = mapAccessConstraint(brief);
  if (siteAccess) {
    constraints.push({
      key: "site_access",
      label: "Site access",
      value: siteAccess,
    });
  }

  const carryDistance = mapCarryDistanceConstraint(cartingM);
  if (carryDistance) {
    constraints.push({
      key: "material_carry_distance",
      label: "Material carry distance",
      value: carryDistance,
    });
  }

  if (
    includesAny(brief, [
      "sloping ground",
      "sloping boundary",
      "slightly sloping",
      "poor ground",
    ])
  ) {
    constraints.push({
      key: "site_slope",
      label: "Site slope",
      value: "Yes",
    });
  }

  if (includesAny(brief, ["restricted hours", "restricted access hours"])) {
    constraints.push({
      key: "working_hours",
      label: "Working hours",
      value: "Yes",
    });
  }

  if (
    includesAny(brief, [
      "client supplying",
      "client supplied",
      "client-supplied",
    ])
  ) {
    constraints.push({
      key: "client_supplied_items",
      label: "Client-supplied items",
      value: "Yes",
    });
  }

  if (includesAny(brief, ["by others", "services isolated by others"])) {
    constraints.push({
      key: "by_others_trades",
      label: "By-others trades",
      value: "Yes",
    });
  }

  if (
    includesAny(brief, [
      "occupied site",
      "occupied dwelling",
      "site occupied",
      "house occupied",
      "occupied during",
      "client living on site",
    ])
  ) {
    constraints.push({
      key: "occupied_site",
      label: "Occupied site",
      value: "Yes",
    });
  }

  if (
    includesAny(brief, [
      "upper floor",
      "upper-floor",
      "first floor",
      "second floor",
      "upstairs",
      "above ground floor",
    ])
  ) {
    constraints.push({
      key: "floor_level",
      label: "Floor level",
      value: "Upper floor",
    });
  }

  return constraints;
}

function applyConstraintFactsToWorkAreas(
  brief: string,
  extraction: AIExtractionOutput
): void {
  // FOUNDATION-R1: do not dual-write project logistics onto WA Facts.
  // Constraints extracted in extractConstraintsFromBrief are the authority.
  void brief;
  extraction.facts = extraction.facts.filter(
    (fact) => !shouldDropDuplicateFactOnIngest(fact.key)
  );
}

function mergePossibleConstraints(
  extraction: AIExtractionOutput,
  constraints: ExtractedConstraint[]
): void {
  const existing = new Set(extraction.possibleConstraints.map((c) => c.toLowerCase()));
  for (const constraint of constraints) {
    const phrase = `${constraint.label}: ${constraint.value}`;
    if (!existing.has(phrase.toLowerCase())) {
      extraction.possibleConstraints.push(phrase);
    }
  }
}

export function enrichExtractionFromBrief(params: {
  briefText: string;
  extraction: AIExtractionOutput;
  allowedTypes: string[];
}): BriefEnrichmentResult {
  const brief = normaliseBrief(params.briefText);
  const extraction: AIExtractionOutput = {
    ...params.extraction,
    workAreas: [...params.extraction.workAreas],
    facts: [...params.extraction.facts],
    assumptions: [...params.extraction.assumptions],
    possibleConstraints: [...params.extraction.possibleConstraints],
    warnings: [...params.extraction.warnings],
  };

  inferDeck(brief, extraction, params.allowedTypes);
  inferBathroom(brief, extraction, params.allowedTypes);
  inferKitchen(brief, extraction, params.allowedTypes);
  inferInternalWalls(brief, extraction, params.allowedTypes);
  inferDoors(brief, extraction, params.allowedTypes);
  inferPainting(brief, extraction, params.allowedTypes);
  inferFence(brief, extraction, params.allowedTypes);
  inferPergola(brief, extraction, params.allowedTypes);
  inferRetainingWall(brief, extraction, params.allowedTypes);
  sanitizeRetainingWallExtractedFacts(brief, extraction);
  inferExternalStairs(brief, extraction, params.allowedTypes);
  inferPlastering(brief, extraction, params.allowedTypes);
  inferDemolitionAndRemoval(brief, extraction, params.allowedTypes);
  inferNoTiling(brief, extraction);
  applyConstraintFactsToWorkAreas(brief, extraction);

  const qualityLevel = extractQualityFromBrief(params.briefText);
  const constraints = extractConstraintsFromBrief(params.briefText);
  mergePossibleConstraints(extraction, constraints);

  if (extraction.workAreas.length === 0) {
    extraction.warnings.push("No work areas detected after enrichment.");
  }

  return { extraction, qualityLevel, constraints };
}

export function buildMinimalExtractionFromBrief(
  briefText: string,
  allowedTypes: string[]
): AIExtractionOutput {
  const base: AIExtractionOutput = {
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  };

  return enrichExtractionFromBrief({
    briefText,
    extraction: base,
    allowedTypes,
  }).extraction;
}

export function workAreaLabel(type: string): string {
  return CATALOGUE_LABELS.get(type) ?? type;
}
