/**
 * Discovery-time Work Area ownership. Top-level WAs are created only when
 * scope is explicit or independently substantial. Embedded trades stay inside
 * the owning Work Area.
 *
 * Not a database model. Deterministic brief + proposed-type contract.
 */

export const WORK_AREA_OWNERSHIP_CLASS = {
  EXPLICIT: "EXPLICIT",
  EMBEDDED: "EMBEDDED",
  INFERRED_OPTIONAL: "INFERRED_OPTIONAL",
  NOT_REQUESTED: "NOT_REQUESTED",
} as const;

export type WorkAreaOwnershipClass =
  (typeof WORK_AREA_OWNERSHIP_CLASS)[keyof typeof WORK_AREA_OWNERSHIP_CLASS];

export type WorkAreaOwnershipRecord = {
  readonly type: string;
  readonly classification: WorkAreaOwnershipClass;
  readonly evidence: string;
  readonly topLevel: boolean;
};

export const WORK_AREA_SCOPE_OWNERS = {
  internal_walls: [
    "framing",
    "lining",
    "opening_formation",
    "wall_insulation",
    "local_trim",
    "local_stopping",
    "local_wall_painting",
    "wall_electrical_allowance",
  ],
  plastering: ["independent_plaster_scope"],
  painting: ["independent_paint_scope"],
  doors: ["door_leaf", "frame", "hardware", "install"],
  demolition: ["explicit_removal_scope"],
  bathroom: [
    "local_demolition",
    "lining",
    "waterproofing",
    "tiling",
    "fixtures",
    "local_painting",
    "local_stopping",
    "bathroom_ceiling_lining",
  ],
  ceilings: [
    "ceiling_structure",
    "ceiling_lining",
    "ceiling_insulation",
    "ceiling_bulkheads",
  ],
} as const;

function normaliseBrief(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function briefHasIndependentPlastering(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  return includesAny(brief, [
    "skim coat",
    "skim-coat",
    "repair and plaster",
    "plaster the existing",
    "plaster existing",
    "stop all existing",
    "stopping throughout",
    "plaster ceilings",
    "ceiling plaster",
    "level 4 stop",
    "level 5 skim",
    "level 4 stopping",
    "level 5 stopping",
    "stop new gib",
    "stop new ceiling",
    "stop the ceiling",
    "stop ceiling",
    "independent plaster",
  ]);
}

export function briefHasIndependentPainting(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  return includesAny(brief, [
    "paint the whole house",
    "paint the house",
    "repaint all",
    "repaint the house",
    "paint existing",
    "paint all walls",
    "paint all bedrooms",
    "paint walls and ceilings",
    "paint walls and ceiling",
    "repaint walls and ceilings",
    "repaint walls and trims",
    "paint the interior",
    "interior painting",
    "paint the ceiling",
    "paint ceiling",
    "paint ceilings",
  ]);
}

function briefHasPaintOrStopCeilingOnly(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  const paintOrStop =
    /\bpaint(?:ing)?(?:\s+the)?\s+ceilings?\b/.test(brief) ||
    /\bstop(?:ping)?(?:\s+the)?\s+(?:new\s+)?ceilings?\b/.test(brief) ||
    /\bstop new ceiling\b/.test(brief);
  if (!paintOrStop) return false;
  return !briefHasCeilingConstructionLanguage(brief);
}

function briefHasCeilingConstructionLanguage(brief: string): boolean {
  return includesAny(brief, [
    "replace ceiling",
    "replace the ceiling",
    "replace ceilings",
    "new ceiling",
    "new ceilings",
    "gib ceiling",
    "plasterboard ceiling",
    "fyreline ceiling",
    "aqualine ceiling",
    "drop ceiling",
    "suspended ceiling",
    "ceiling tiles",
    "t-bar",
    "t bar",
    "tile and grid",
    "ceiling framing",
    "ceiling battens",
    "reline the ceiling",
    "reline ceilings",
    "line the ceiling",
    "line ceilings",
    "line existing ceiling",
    "ceiling lining",
    "ceilings throughout",
    "ceilings through",
    "ground floor ceiling",
    "garage ceiling",
    "detached garage ceiling",
    "upstairs ceiling",
    "downstairs ceiling",
  ]);
}

export function briefHasExplicitCeilings(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (briefHasPaintOrStopCeilingOnly(briefText)) return false;
  if (briefHasCeilingConstructionLanguage(brief)) return true;
  if (/\bline\b.{0,80}\bceilings?\b/.test(brief) && !/\bpaint|\bstop/.test(brief)) {
    return true;
  }
  const roomPackage =
    /\b(main room|lounge|hallway|hall|living room)\b/.test(brief) &&
    /\b(gib|fyreline|plasterboard|existing framing|timber framing)\b/.test(brief);
  if (roomPackage && !briefHasExplicitInternalWalls(briefText)) return true;
  return false;
}

export function briefHasBathroomEmbeddedCeiling(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (!/\bbathroom|\bensuite/.test(brief)) return false;
  if (!/\bceiling/.test(brief)) return false;
  const independentRooms =
    /\blounge|\bhallway|\bhall\b|\bbedroom|\bliving room|\bthroughout the house|\bthrough lounge|\bground floor ceiling|\bgarage ceiling/.test(
      brief
    );
  if (independentRooms && briefHasCeilingConstructionLanguage(brief)) {
    return false;
  }
  return (
    /\bbathroom.{0,80}ceiling|\bceiling.{0,80}bathroom|\bensuite.{0,80}ceiling|\bceiling lining/.test(
      brief
    ) && !/\bplus replace ceilings|\bplus new ceilings|\bthroughout/.test(brief)
  );
}

export function briefHasIndependentCeilings(briefText: string): boolean {
  if (!briefHasExplicitCeilings(briefText)) return false;
  if (briefHasBathroomEmbeddedCeiling(briefText) && !/\bplus /.test(normaliseBrief(briefText))) {
    return false;
  }
  return true;
}

const DOOR_SUPPLY_EXCLUDE_PHRASES = [
  "no door supply",
  "without a door",
  "without door",
  "no door required",
  "no doors required",
  "door by others",
  "doors by others",
  "exclude door",
  "exclude doors",
  "opening but no door",
  "but no door",
] as const;

const DOOR_OPENING_ONLY_PHRASES = [
  "opening only",
  "door opening only",
  "openings only",
] as const;

const DOOR_SPECIALIST_PHRASES = [
  "fire rated",
  "fire-rated",
  "fire door",
  "acoustic door",
  "acoustic-rated",
  "cavity slider",
  "cavity sliding",
  "aluminium door",
  "aluminum door",
  "aluminium entrance",
  "aluminum entrance",
  "automatic door",
  "access control",
  "security door",
  "barn door",
  "bifold",
  "exterior door",
  "external door",
  "entrance door",
  "glazed door",
] as const;

function hasDoorToken(brief: string): boolean {
  return (
    /\bdoors?\b/.test(brief) ||
    /\bprehung\b/.test(brief) ||
    /\bpre-hung\b/.test(brief) ||
    includesAny(brief, DOOR_SPECIALIST_PHRASES)
  );
}

export function briefHasSpecialistDoorLanguage(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  return includesAny(brief, DOOR_SPECIALIST_PHRASES);
}

/**
 * Positive supply/install/replace/leaf/hardware language. Word order of
 * “opening” vs “door” must not suppress this.
 */
export function briefRequestsDoorWork(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (!hasDoorToken(brief)) return false;
  if (/\bsupply(?:\s+and|\s*&\s*)\s*install\b/.test(brief)) return true;
  if (
    /\breplace\b[\s\S]{0,80}\bdoors?\b|\bdoors?\b[\s\S]{0,80}\breplace\b/.test(
      brief
    )
  ) {
    return true;
  }
  if (/\bdoor leaves?\b/.test(brief) || /\bdoor leaf\b/.test(brief)) return true;
  if (/\bprehung\b|\bpre-hung\b/.test(brief)) return true;
  if (/\bhollow[-\s]?core\b/.test(brief) || /\bsolid[-\s]?core\b/.test(brief)) {
    return true;
  }
  if (/\bdoor jamb\b|\bdoor hardware\b|\bjamb and hardware\b/.test(brief)) {
    return true;
  }
  if (/\binstall\b[\s\S]{0,48}\bdoors?\b/.test(brief)) return true;
  if (includesAny(brief, ["client supplying door", "client supplied door"])) {
    return true;
  }
  if (/\bincluding (?:a |one |the )?doors?\b(?!\s+opening)/.test(brief)) {
    return true;
  }
  if (/\binclude doors?\b(?!\s+opening)/.test(brief)) return true;
  if (/\bnew doors?\b(?!\s+opening)/.test(brief)) return true;
  if (/\binternal doors?\b(?!\s+opening)/.test(brief)) return true;
  if (briefHasSpecialistDoorLanguage(briefText)) return true;
  return false;
}

/**
 * Explicit language that excludes door supply/install. Wins over a bare
 * opening reference. Hard exclude phrases also win over leftover “door”
 * tokens that are not supply/install work.
 */
export function briefExcludesDoorSupply(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (includesAny(brief, DOOR_SUPPLY_EXCLUDE_PHRASES)) return true;
  if (/\bno doors?\b/.test(brief) && !briefRequestsDoorWork(briefText)) {
    return true;
  }
  if (
    includesAny(brief, DOOR_OPENING_ONLY_PHRASES) &&
    !briefRequestsDoorWork(briefText)
  ) {
    return true;
  }
  if (
    /\bexisting doors? retained\b/.test(brief) &&
    !briefRequestsDoorWork(briefText)
  ) {
    return true;
  }
  return false;
}

export function briefHasIndependentDoors(briefText: string): boolean {
  if (includesAny(normaliseBrief(briefText), DOOR_SUPPLY_EXCLUDE_PHRASES)) {
    return false;
  }
  if (briefExcludesDoorSupply(briefText)) return false;
  return briefRequestsDoorWork(briefText);
}

const DOOR_LOCATION_ROOM =
  "(?:master\\s+|main\\s+|guest\\s+|family\\s+|downstairs\\s+|upstairs\\s+)?(?:ensuite|bathroom|bedrooms?|kitchen|laundry)";

function ownershipClauses(brief: string): string[] {
  return brief
    .split(/(?:[.!?;]|\balso\b|\bplus\b)+/i)
    .map((row) => row.trim())
    .filter(Boolean);
}

function clauseHasDoorOperation(clause: string): boolean {
  return (
    /\bdoors?\b/.test(clause) ||
    /\bleaf\b|\bleaves\b/.test(clause) ||
    /\bprehung\b|\bpre-hung\b/.test(clause)
  );
}

function bathroomTokenIsDoorLocation(clause: string): boolean {
  if (!/\b(?:ensuite|bathroom)\b/.test(clause)) return false;
  if (!clauseHasDoorOperation(clause)) return false;
  if (/\b(?:ensuite|bathroom) doors?\b/.test(clause)) return true;
  if (
    new RegExp(`\\bto(?:\\s+the)?\\s+${DOOR_LOCATION_ROOM}\\b`, "i").test(
      clause
    )
  ) {
    return true;
  }
  return false;
}

function kitchenTokenIsDoorLocation(clause: string): boolean {
  if (!/\bkitchen\b/.test(clause)) return false;
  if (!clauseHasDoorOperation(clause)) return false;
  if (/\bkitchen doors?\b/.test(clause)) return true;
  if (/\bto(?:\s+the)?\s+kitchen\b/.test(clause)) return true;
  return false;
}

const FLOORING_FINISH_TOKEN =
  "(?:carpet|vinyl(?:\\s+plank|\\s+planks)?|lvt|luxury\\s+vinyl|slat\\s+vinyl|vinyl\\s+slats|floor\\s+tiles?|tiled?\\s+floor|tile\\s+flooring|hardwood|timber\\s+floor(?:ing|boards?)?|flooring)";

export function clauseHasFlooringOperation(clause: string): boolean {
  const raw = clause.toLowerCase();
  if (/\bsheet\s+vinyl\b/.test(raw) && !/\b(?:vinyl\s+plank|lvt|slat\s+vinyl)\b/.test(raw)) {
    return true;
  }
  if (
    /\b(?:install|lay|replace|supply and install|carpet|tile)\b/.test(raw) &&
    new RegExp(`\\b${FLOORING_FINISH_TOKEN}\\b`).test(raw)
  ) {
    return true;
  }
  if (new RegExp(`\\b${FLOORING_FINISH_TOKEN}\\b`).test(raw)) return true;
  if (/\b(?:floor tiles?|tile the (?:ensuite |bathroom )?floor)\b/.test(raw)) {
    return true;
  }
  if (
    /\breplace (?:the )?floor substrate\b/.test(raw) ||
    /\bnew flooring substrate\b/.test(raw)
  ) {
    return true;
  }
  if (
    /\b(?:flooring removal only|remove existing floor finish|uplift existing (?:carpet|vinyl|tiles?|hardwood))\b/.test(
      raw
    )
  ) {
    return true;
  }
  return false;
}

function clauseHasIndependentBathroomSignal(clause: string): boolean {
  return includesAny(clause, INDEPENDENT_BATHROOM_SIGNALS);
}

function clauseHasIndependentKitchenSignal(clause: string): boolean {
  return includesAny(clause, INDEPENDENT_KITCHEN_SIGNALS);
}

export function bathroomTokenIsFlooringLocation(clause: string): boolean {
  if (!/\b(?:ensuite|bathroom)\b/.test(clause)) return false;
  if (!clauseHasFlooringOperation(clause)) return false;
  if (clauseHasIndependentBathroomSignal(clause)) return false;
  return true;
}

export function kitchenTokenIsFlooringLocation(clause: string): boolean {
  if (!/\bkitchen\b/.test(clause)) return false;
  if (!clauseHasFlooringOperation(clause)) return false;
  if (clauseHasIndependentKitchenSignal(clause)) return false;
  return true;
}

export function clauseIsBathroomOwnedFloor(clause: string): boolean {
  if (!/\b(?:ensuite|bathroom)\b/.test(clause) && !clauseHasIndependentBathroomSignal(clause)) {
    return false;
  }
  if (
    /\b(?:bedrooms?|living rooms?|lounge|kitchen|hallway|laundry|entry)\b/.test(
      clause
    ) &&
    !/\b(?:ensuite|bathroom)\s+floor/.test(clause.toLowerCase())
  ) {
    return false;
  }
  return (
    clauseHasIndependentBathroomSignal(clause) &&
    (clauseHasFlooringOperation(clause) ||
      /\bfloor(?:ing)?\b/.test(clause.toLowerCase()) ||
      /\btiles?\b/.test(clause.toLowerCase()))
  );
}

export function clauseIsKitchenOwnedFloor(clause: string): boolean {
  if (!/\bkitchen\b/.test(clause)) return false;
  if (
    /\b(?:bedrooms?|living rooms?|lounge|ensuite|bathroom|hallway|laundry|entry)\b/.test(
      clause
    ) &&
    !/\bkitchen\s+floor/.test(clause.toLowerCase()) &&
    !/\bflooring in the kitchen\b/.test(clause.toLowerCase())
  ) {
    return false;
  }
  return (
    clauseHasIndependentKitchenSignal(clause) &&
    (clauseHasFlooringOperation(clause) || /\bfloor(?:ing)?\b/.test(clause.toLowerCase()))
  );
}

/**
 * Standalone Flooring operations. Room nouns (bathroom, kitchen, ensuite)
 * are locations unless an independent Bathroom/Kitchen renovation is stated
 * in the same clause.
 */
function clauseIsDemolitionMentionOfFlooring(clause: string): boolean {
  const raw = clause.toLowerCase();
  if (
    !/\b(?:demolition|demolish|strip[-\s]?out|rip out|soft strip)\b/.test(raw)
  ) {
    return false;
  }
  if (!/\bflooring\b/.test(raw) && !/\bfloor finish\b/.test(raw)) return false;
  return !/\b(?:install|lay|supply and install|carpet the|tile the|replace flooring|new (?:carpet|vinyl|hardwood|timber)|flooring removal only|no new flooring)\b/.test(
    raw
  );
}

export function briefHasIndependentFlooring(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (
    briefHasStandaloneDemolitionPackage(briefText) &&
    !/\b(?:install|lay|supply and install|carpet the|tile the|replace flooring|new (?:carpet|vinyl|hardwood|timber)|flooring removal only|no new flooring)\b/.test(
      brief
    )
  ) {
    return false;
  }
  const clauses = ownershipClauses(brief);
  for (const clause of clauses) {
    if (!clauseHasFlooringOperation(clause)) continue;
    if (clauseIsBathroomOwnedFloor(clause)) continue;
    if (clauseIsKitchenOwnedFloor(clause)) continue;
    if (clauseIsDemolitionMentionOfFlooring(clause)) continue;
    return true;
  }
  if (
    includesAny(brief, [
      "flooring removal only",
      "remove existing floor finish",
      "no new flooring",
    ]) &&
    !briefHasStandaloneDemolitionPackage(briefText)
  ) {
    return true;
  }
  return false;
}

/**
 * Wider demolition / strip-out package. Floor-finish removal connected to
 * a new Flooring Area is not this — that stays a Flooring accessory.
 */
export function briefHasStandaloneDemolitionPackage(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  return includesAny(brief, [
    "soft strip",
    "strip out office",
    "office soft strip",
    "house internal demolition",
    "demolition of house",
    "demolish",
    "internal demolition",
    "rip out",
    "removing internal wall",
    "remove internal wall",
    "removing 3 internal",
  ]);
}

/**
 * Floor-finish removal that belongs to a nested Flooring Area (connected
 * replace/install, or an explicit Flooring removal-only scope). Never both
 * Flooring and Demolition.
 */
export function briefFlooringOwnsConnectedRemoval(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (briefHasStandaloneDemolitionPackage(briefText) && !briefHasIndependentFlooring(briefText)) {
    return false;
  }
  if (briefHasIndependentFlooring(briefText)) {
    return (
      includesAny(brief, [
        "remove existing",
        "remove the existing",
        "uplift",
        "uplift existing",
        "strip out existing floor",
        "existing flooring removal",
        "flooring removal",
        "remove carpet",
        "remove vinyl",
        "remove tiles",
        "remove existing floor",
      ]) ||
      includesAny(brief, ["flooring removal only", "no new flooring", "removal only"])
    );
  }
  return (
    includesAny(brief, ["flooring removal only", "no new flooring"]) &&
    !briefHasStandaloneDemolitionPackage(briefText)
  );
}

const INDEPENDENT_BATHROOM_SIGNALS = [
  "renovate",
  "renovation",
  "reno",
  "retile",
  "retiling",
  "waterproof",
  "waterproofing",
  "vanity",
  "bathroom lining",
  "bathroom linings",
  "ensuite lining",
  "ensuite linings",
  "full bathroom",
  "bathroom reno",
  "ensuite reno",
  "tiled shower",
  "ensuite shower",
  "bathroom shower",
  "strip-out",
  "strip out",
  "bathroom works",
  "ensuite works",
] as const;

/**
 * Bathroom / ensuite mentioned as a Door Set location (to the ensuite,
 * bathroom door) is not independent Bathroom Renovation scope.
 */
export function briefHasIndependentBathroom(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  for (const clause of ownershipClauses(brief)) {
    const hasRoom =
      /\b(?:ensuite|bathroom)\b/.test(clause) ||
      includesAny(clause, ["vanity", "tiled shower"]);
    const hasSignal = includesAny(clause, INDEPENDENT_BATHROOM_SIGNALS);
    if (
      hasSignal &&
      includesAny(clause, [
        "vanity",
        "waterproof",
        "waterproofing",
        "retile",
        "retiling",
        "renovate",
        "renovation",
        "full bathroom",
        "bathroom lining",
        "bathroom linings",
      ])
    ) {
      return true;
    }
    if (
      hasSignal &&
      hasRoom &&
      !bathroomTokenIsDoorLocation(clause) &&
      !bathroomTokenIsFlooringLocation(clause)
    ) {
      return true;
    }
    if (
      /\b(?:ensuite|bathroom)\b/.test(clause) &&
      !bathroomTokenIsDoorLocation(clause) &&
      !bathroomTokenIsFlooringLocation(clause)
    ) {
      return true;
    }
  }
  return false;
}

const INDEPENDENT_KITCHEN_SIGNALS = [
  "cabinetry",
  "flatpack",
  "benchtop",
  "splashback",
  "rangehood",
  "kitchen renovation",
  "renovate the kitchen",
  "renovate kitchen",
  "remove existing kitchen",
  "install flatpack",
] as const;

/**
 * “kitchen door” / “to the kitchen” as a Door Set location is not Kitchen
 * renovation scope. Cabinetry / benchtop / splashback remain independent.
 */
export function briefHasIndependentKitchen(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (includesAny(brief, INDEPENDENT_KITCHEN_SIGNALS)) return true;
  if (!/\bkitchen\b/.test(brief)) return false;
  for (const clause of ownershipClauses(brief)) {
    if (!/\bkitchen\b/.test(clause)) continue;
    if (kitchenTokenIsDoorLocation(clause)) continue;
    if (kitchenTokenIsFlooringLocation(clause)) continue;
    return true;
  }
  return false;
}

/**
 * Suggested (machine-owned) Bathroom / Kitchen rows that extraction no
 * longer proposes. Confirmed / user-kept rows are never returned.
 */
export function staleSuggestedOwnedWorkAreasToDrop(params: {
  readonly existing: readonly {
    readonly id: string;
    readonly type: string;
    readonly status?: string | null;
  }[];
  readonly extractedTypes: readonly string[];
}): string[] {
  const extracted = new Set(params.extractedTypes);
  return params.existing
    .filter((row) => {
      if (row.status !== "suggested") return false;
      if (row.type !== "bathroom" && row.type !== "kitchen") return false;
      return !extracted.has(row.type);
    })
    .map((row) => row.id);
}

export function briefHasExplicitDemolition(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  return includesAny(brief, [
    "removing internal wall",
    "removing 3 internal",
    "remove internal wall",
    "remove the walls",
    "removing 3 internal walls",
    "strip out",
    "strip-out",
    "soft strip",
    "rip out",
    "demolish",
    "demolition",
  ]);
}

export function briefHasExplicitInternalWalls(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  return includesAny(brief, [
    "internal wall",
    "internal partition",
    "new partition",
    "build a partition",
    "build a new internal",
    "build a wall",
    "rebuild the walls",
    "rebuild walls",
    "timber framed wall",
    "framed timber",
  ]);
}

function bathroomOwnsEmbeddedTrades(briefText: string, proposedTypes: readonly string[]): boolean {
  return proposedTypes.includes("bathroom") && !briefHasIndependentPainting(briefText);
}

export function classifyProposedWorkArea(params: {
  readonly type: string;
  readonly briefText: string;
  readonly proposedTypes: readonly string[];
}): WorkAreaOwnershipRecord {
  const brief = params.briefText;
  const types = params.proposedTypes;
  const hasInternalWalls =
    types.includes("internal_walls") || briefHasExplicitInternalWalls(brief);
  const hasBathroom = types.includes("bathroom");

  if (params.type === "internal_walls") {
    const explicit = briefHasExplicitInternalWalls(brief);
    return {
      type: params.type,
      classification: explicit
        ? WORK_AREA_OWNERSHIP_CLASS.EXPLICIT
        : WORK_AREA_OWNERSHIP_CLASS.INFERRED_OPTIONAL,
      evidence: explicit
        ? "Internal walls / partitions stated in the brief"
        : "Inferred internal walls without explicit partition language",
      topLevel: explicit,
    };
  }

  if (params.type === "demolition") {
    const explicit = briefHasExplicitDemolition(brief);
    const bathroomEmbedded =
      hasBathroom &&
      !includesAny(normaliseBrief(brief), [
        "strip out office",
        "house internal demolition",
        "removing internal wall",
        "remove internal wall",
      ]);
    if (bathroomEmbedded && hasBathroom) {
      return {
        type: params.type,
        classification: WORK_AREA_OWNERSHIP_CLASS.EMBEDDED,
        evidence: "Bathroom owns local demolition unless independent strip-out is stated",
        topLevel: false,
      };
    }
    if (
      briefFlooringOwnsConnectedRemoval(brief) &&
      !briefHasStandaloneDemolitionPackage(brief)
    ) {
      return {
        type: params.type,
        classification: WORK_AREA_OWNERSHIP_CLASS.EMBEDDED,
        evidence:
          "Floor-finish removal is an accessory of nested Flooring, not a separate Demolition Work Area",
        topLevel: false,
      };
    }
    return {
      type: params.type,
      classification: explicit
        ? WORK_AREA_OWNERSHIP_CLASS.EXPLICIT
        : WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
      evidence: explicit
        ? "Removal / strip-out stated in the brief"
        : "No standalone demolition language",
      topLevel: explicit,
    };
  }

  if (params.type === "ceilings") {
    if (briefHasPaintOrStopCeilingOnly(brief)) {
      return {
        type: params.type,
        classification: WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
        evidence: "Paint / stopping language does not create a Ceilings Work Area",
        topLevel: false,
      };
    }
    const independent = briefHasIndependentCeilings(brief);
    if (independent) {
      return {
        type: params.type,
        classification: WORK_AREA_OWNERSHIP_CLASS.EXPLICIT,
        evidence: "Independent ceiling construction / lining stated",
        topLevel: true,
      };
    }
    if (hasBathroom && briefHasBathroomEmbeddedCeiling(brief)) {
      return {
        type: params.type,
        classification: WORK_AREA_OWNERSHIP_CLASS.EMBEDDED,
        evidence: "Bathroom owns embedded ceiling lining unless independent ceiling packages are stated",
        topLevel: false,
      };
    }
    const explicit = briefHasExplicitCeilings(brief);
    return {
      type: params.type,
      classification: explicit
        ? WORK_AREA_OWNERSHIP_CLASS.EXPLICIT
        : WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
      evidence: explicit
        ? "Ceiling construction stated in the brief"
        : "No standalone ceiling construction language",
      topLevel: explicit,
    };
  }

  if (params.type === "plastering") {
    const independent = briefHasIndependentPlastering(brief);
    if (independent) {
      return {
        type: params.type,
        classification: WORK_AREA_OWNERSHIP_CLASS.EXPLICIT,
        evidence: "Independent plastering / stopping scope stated",
        topLevel: true,
      };
    }
    if (hasInternalWalls || hasBathroom) {
      return {
        type: params.type,
        classification: WORK_AREA_OWNERSHIP_CLASS.EMBEDDED,
        evidence: hasInternalWalls
          ? "GIB / lining is owned by Internal Walls local stopping"
          : "Bathroom owns local stopping",
        topLevel: false,
      };
    }
    return {
      type: params.type,
      classification: WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
      evidence: "No independent plastering scope",
      topLevel: false,
    };
  }

  if (params.type === "painting") {
    const independent = briefHasIndependentPainting(brief);
    if (independent) {
      return {
        type: params.type,
        classification: WORK_AREA_OWNERSHIP_CLASS.EXPLICIT,
        evidence: "Independent painting scope stated",
        topLevel: true,
      };
    }
    if (hasInternalWalls || hasBathroom || bathroomOwnsEmbeddedTrades(brief, types)) {
      return {
        type: params.type,
        classification: WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
        evidence: "Wall construction does not create a Painting Work Area",
        topLevel: false,
      };
    }
    return {
      type: params.type,
      classification: WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
      evidence: "No painting language",
      topLevel: false,
    };
  }

  if (params.type === "doors") {
    const independent = briefHasIndependentDoors(brief);
    return {
      type: params.type,
      classification: independent
        ? WORK_AREA_OWNERSHIP_CLASS.EXPLICIT
        : WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
      evidence: independent
        ? briefHasSpecialistDoorLanguage(brief)
          ? "Specialist door supply/install stated"
          : "Door leaf / jamb / hardware stated"
        : "Opening formation is owned by Internal Walls",
      topLevel: independent,
    };
  }

  if (params.type === "bathroom") {
    const independent = briefHasIndependentBathroom(brief);
    return {
      type: params.type,
      classification: independent
        ? WORK_AREA_OWNERSHIP_CLASS.EXPLICIT
        : WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
      evidence: independent
        ? "Independent bathroom / ensuite renovation stated"
        : "Ensuite / bathroom is a location label for another operation",
      topLevel: independent,
    };
  }

  if (params.type === "kitchen") {
    const independent = briefHasIndependentKitchen(brief);
    return {
      type: params.type,
      classification: independent
        ? WORK_AREA_OWNERSHIP_CLASS.EXPLICIT
        : WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
      evidence: independent
        ? "Independent kitchen renovation stated"
        : "Kitchen is a location label for another operation",
      topLevel: independent,
    };
  }

  if (params.type === "flooring") {
    const independent = briefHasIndependentFlooring(brief);
    return {
      type: params.type,
      classification: independent
        ? WORK_AREA_OWNERSHIP_CLASS.EXPLICIT
        : WORK_AREA_OWNERSHIP_CLASS.NOT_REQUESTED,
      evidence: independent
        ? "Independent Flooring Area stated"
        : "Flooring is owned by Bathroom/Kitchen package or is not independently scoped",
      topLevel: independent,
    };
  }

  return {
    type: params.type,
    classification: WORK_AREA_OWNERSHIP_CLASS.EXPLICIT,
    evidence: "Proposed Work Area retained",
    topLevel: true,
  };
}

export function classifyProposedWorkAreas(params: {
  readonly briefText: string;
  readonly types: readonly string[];
}): WorkAreaOwnershipRecord[] {
  const proposedTypes = [...params.types];
  return proposedTypes.map((type) =>
    classifyProposedWorkArea({
      type,
      briefText: params.briefText,
      proposedTypes,
    })
  );
}

export function filterTopLevelWorkAreas<T extends { type: string }>(params: {
  readonly briefText: string;
  readonly workAreas: readonly T[];
}): { readonly workAreas: T[]; readonly records: WorkAreaOwnershipRecord[] } {
  const types = params.workAreas.map((row) => row.type);
  const records = classifyProposedWorkAreas({
    briefText: params.briefText,
    types,
  });
  const allowed = new Set(
    records.filter((row) => row.topLevel).map((row) => row.type)
  );
  return {
    workAreas: params.workAreas.filter((row) => allowed.has(row.type)),
    records,
  };
}
