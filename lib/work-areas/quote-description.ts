export type WorkAreaQuoteFact = {
  key: string;
  label: string;
  value: string;
};

export type WorkAreaQuoteDraftInput = {
  type: string;
  name: string;
  facts?: WorkAreaQuoteFact[];
};

function factValue(
  facts: WorkAreaQuoteFact[] | undefined,
  key: string
): string | null {
  const match = facts?.find((fact) => fact.key === key);
  const value = match?.value?.trim();
  if (!value || value.toLowerCase() === "not sure") {
    return null;
  }
  return value;
}

function appendScopeClause(base: string, clause: string | null): string {
  if (!clause) {
    return base;
  }
  if (base.toLowerCase().includes(clause.toLowerCase().slice(0, 20))) {
    return base;
  }
  return `${base} ${clause}`.trim();
}

function buildDeckDraft(name: string, facts?: WorkAreaQuoteFact[]): string {
  const area = factValue(facts, "deck.area_m2");
  const material = factValue(facts, "deck.material");
  const materialPhrase =
    material && material !== "Not sure" ? material.toLowerCase() : "timber";

  let draft =
    "Supply and construct timber deck works to the agreed project scope, including associated framing, fixings and installation works.";

  if (area) {
    draft = `Supply and construct approximately ${area} m² of ${materialPhrase} deck works to the agreed project scope, including associated framing, fixings and installation works.`;
  } else if (material) {
    draft = `Supply and construct ${materialPhrase} deck works to the agreed project scope, including associated framing, fixings and installation works.`;
  }

  const stairs = factValue(facts, "deck.has_stairs");
  if (stairs === "Yes") {
    draft = appendScopeClause(draft, "Associated stair access is included where applicable.");
  }

  return `${draft} Final materials and site-specific conditions are subject to confirmation.`;
}

function buildBathroomDraft(facts?: WorkAreaQuoteFact[]): string {
  const area = factValue(facts, "bathroom.area_m2");
  const tiling = factValue(facts, "bathroom.tile_extent");

  let draft =
    "Carry out bathroom renovation works to the agreed scope, including selected fixtures, linings, waterproofing, tiling and associated trade coordination where applicable.";

  if (area) {
    draft = `Carry out bathroom renovation works to the agreed scope for an approximately ${area} m² bathroom, including selected fixtures, linings, waterproofing, tiling and associated trade coordination where applicable.`;
  }

  if (tiling) {
    draft = appendScopeClause(
      draft,
      `${tiling} tiling is included where applicable.`
    );
  }

  return draft;
}

function buildKitchenDraft(facts?: WorkAreaQuoteFact[]): string {
  const area = factValue(facts, "kitchen.area_m2");
  let draft =
    "Carry out kitchen renovation works to the agreed scope, including cabinetry, benchtop, appliance and associated installation works where applicable.";

  if (area) {
    draft = `Carry out kitchen renovation works to the agreed scope for an approximately ${area} m² kitchen, including cabinetry, benchtop, appliance and associated installation works where applicable.`;
  }

  return draft;
}

function buildDemolitionDraft(name: string): string {
  return `Carry out demolition and removal works for ${name.toLowerCase()} to the agreed scope, including reasonable site protection, removal of specified materials and tidy-up of affected areas.`;
}

function buildRetainingWallDraft(facts?: WorkAreaQuoteFact[]): string {
  const length = factValue(facts, "retaining_wall.length_m");
  const height =
    factValue(facts, "retaining_wall.height_m") ??
    factValue(facts, "retaining_wall.average_height_m");

  let draft =
    "Carry out retaining wall works to the agreed scope, including associated excavation, drainage and backfill allowances where applicable.";

  if (length && height) {
    draft = `Carry out retaining wall works to the agreed scope for an approximately ${length} m long by ${height} m high wall, including associated excavation, drainage and backfill allowances where applicable.`;
  } else if (length) {
    draft = `Carry out retaining wall works to the agreed scope for an approximately ${length} m long wall, including associated excavation, drainage and backfill allowances where applicable.`;
  }

  return draft;
}

function buildGenericDraft(name: string): string {
  const label = name.trim() || "work area";
  return `Carry out the agreed ${label.toLowerCase()} works in accordance with the confirmed project scope, assumptions and exclusions.`;
}

export function buildWorkAreaQuoteDescriptionDraft(
  input: WorkAreaQuoteDraftInput
): string {
  const { type, name, facts } = input;

  switch (type) {
    case "deck":
      return buildDeckDraft(name, facts);
    case "bathroom":
      return buildBathroomDraft(facts);
    case "kitchen":
      return buildKitchenDraft(facts);
    case "demolition":
      return buildDemolitionDraft(name);
    case "retaining_wall":
      return buildRetainingWallDraft(facts);
    case "fence":
      return buildGenericDraft(
        name ||
          "fence works including demolition, posts, rails and associated installation"
      );
    case "pergola":
      return buildGenericDraft(
        name ||
          "pergola works including posts, framing and associated installation"
      );
    case "external_stairs":
      return buildGenericDraft(
        name ||
          "external stair works including framing, treads, handrails and associated installation"
      );
    default:
      return buildGenericDraft(name);
  }
}

export function resolveWorkAreaQuoteDescription(
  workArea: {
    type: string;
    name: string;
    quote_description?: string | null;
  },
  facts?: WorkAreaQuoteFact[]
): string {
  const saved = workArea.quote_description?.trim();
  if (saved) {
    return saved;
  }

  return buildWorkAreaQuoteDescriptionDraft({
    type: workArea.type,
    name: workArea.name,
    facts,
  });
}

export function buildWorkAreaDescriptionsMap(
  workAreas: Array<{
    id: string;
    type: string;
    name: string;
    quote_description?: string | null;
  }>,
  factsByWorkAreaId: Map<string, WorkAreaQuoteFact[]>
): Map<string, string> {
  const result = new Map<string, string>();

  for (const workArea of workAreas) {
    result.set(
      workArea.id,
      resolveWorkAreaQuoteDescription(
        workArea,
        factsByWorkAreaId.get(workArea.id) ?? []
      )
    );
  }

  return result;
}
