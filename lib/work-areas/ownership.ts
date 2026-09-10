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
  ]);
}

export function briefHasIndependentDoors(briefText: string): boolean {
  const brief = normaliseBrief(briefText);
  if (includesAny(brief, ["no door", "without a door", "opening but no door"])) {
    return false;
  }
  return (
    includesAny(brief, [
      "including door",
      "include door",
      "new door",
      "door leaf",
      "door jamb",
      "door hardware",
      "solid core door",
      "install door",
      "supply and install door",
      "internal door",
    ]) &&
    !/\bopening\b/.test(brief.split("door")[0] ?? "")
  );
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
        ? "Door leaf / jamb / hardware stated"
        : "Opening formation is owned by Internal Walls",
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
