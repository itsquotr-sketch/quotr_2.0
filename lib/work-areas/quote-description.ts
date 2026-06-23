export type WorkAreaQuoteFact = {
  key: string;
  label: string;
  value: string;
};

export type WorkAreaQuotePricingItem = {
  label: string;
};

export type WorkAreaQuoteDraftInput = {
  type: string;
  name: string;
  facts?: WorkAreaQuoteFact[];
  pricingItems?: WorkAreaQuotePricingItem[];
};

const CONFIRMATION_CLAUSE =
  "Final selections, site conditions and any required approvals are subject to confirmation.";

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

function isAffirmative(value: string | null): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower === "yes" || lower === "true" || lower === "included";
}

function appendScopeClause(base: string, clause: string | null): string {
  if (!clause) {
    return base;
  }
  const snippet = clause.toLowerCase().slice(0, 24);
  if (snippet && base.toLowerCase().includes(snippet)) {
    return base;
  }
  return `${base} ${clause}`.trim();
}

function joinLabels(items: WorkAreaQuotePricingItem[] | undefined): string {
  return (items ?? [])
    .map((item) => item.label.trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function enrichFromPricingItems(
  draft: string,
  items: WorkAreaQuotePricingItem[] | undefined
): string {
  const labels = joinLabels(items);
  if (!labels) {
    return draft;
  }

  let result = draft;

  const keywordClauses: Array<{ pattern: RegExp; clause: string }> = [
    {
      pattern: /\b(removal|demolition|demolish|strip[- ]?out)\b/i,
      clause: "Removal of existing works is included where applicable.",
    },
    {
      pattern: /\bstair/i,
      clause: "Associated stair access is included where applicable.",
    },
    {
      pattern: /\b(balustrade|handrail|rail)\b/i,
      clause: "Balustrade or handrail works are included where applicable.",
    },
    {
      pattern: /\b(roof|roofing|covering|polycarb|shade sail)\b/i,
      clause: "Roof or covering allowance is included where applicable.",
    },
    {
      pattern: /\bgate\b/i,
      clause: "Gate allowance is included where applicable.",
    },
    {
      pattern: /\bdrainage\b/i,
      clause: "Drainage allowance is included where applicable.",
    },
    {
      pattern: /\bbackfill\b/i,
      clause: "Backfill allowance is included where applicable.",
    },
    {
      pattern: /\b(framing|subframe|substructure|pile|posts?)\b/i,
      clause:
        "Associated framing, substructure or post works are included where applicable.",
    },
    {
      pattern: /\b(decking board|deck board|decking)\b/i,
      clause: "Decking boards, fixings and installation are included where applicable.",
    },
  ];

  for (const { pattern, clause } of keywordClauses) {
    if (pattern.test(labels)) {
      result = appendScopeClause(result, clause);
    }
  }

  return result;
}

function finalizeDraft(draft: string): string {
  const trimmed = draft.trim();
  if (trimmed.toLowerCase().includes("subject to confirmation")) {
    return trimmed;
  }
  return `${trimmed} ${CONFIRMATION_CLAUSE}`;
}

function buildDeckDraft(
  facts: WorkAreaQuoteFact[] | undefined,
  pricingItems?: WorkAreaQuotePricingItem[]
): string {
  const area = factValue(facts, "deck.area_m2");
  const material = factValue(facts, "deck.material");
  const materialPhrase =
    material && material.toLowerCase() !== "not sure"
      ? material.toLowerCase()
      : "timber";

  let draft =
    "Supply and construct timber deck works to the agreed project scope, including associated framing, decking boards, fixings and installation works.";

  if (area) {
    draft = `Supply and construct approximately ${area} m² of ${materialPhrase} deck works to the agreed project scope, including associated framing, decking boards, fixings and installation works.`;
  } else if (material) {
    draft = `Supply and construct ${materialPhrase} deck works to the agreed project scope, including associated framing, decking boards, fixings and installation works.`;
  }

  if (isAffirmative(factValue(facts, "deck.demolition_required"))) {
    draft = appendScopeClause(
      draft,
      "Removal of the existing deck is included where applicable."
    );
  }

  const level = factValue(facts, "deck.level");
  if (level && level.toLowerCase() !== "not sure") {
    draft = appendScopeClause(
      draft,
      `${level} deck construction is allowed for within the agreed scope.`
    );
  }

  if (isAffirmative(factValue(facts, "deck.has_stairs"))) {
    draft = appendScopeClause(
      draft,
      "Associated stair access is included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "deck.has_balustrade"))) {
    draft = appendScopeClause(
      draft,
      "Balustrade works are included where applicable."
    );
  }

  draft = enrichFromPricingItems(draft, pricingItems);

  return finalizeDraft(
    `${draft} Final materials, levels, access and site-specific conditions are subject to confirmation.`
  );
}

function buildPergolaDraft(
  facts: WorkAreaQuoteFact[] | undefined,
  pricingItems?: WorkAreaQuotePricingItem[]
): string {
  const area = factValue(facts, "pergola.area_m2");
  const material = factValue(facts, "pergola.material");

  let draft =
    "Supply and install pergola works to the agreed project scope, including frame and material allowance, fixings and associated installation works.";

  if (area) {
    draft = `Supply and install approximately ${area} m² of pergola works to the agreed project scope, including frame and material allowance, fixings and associated installation works.`;
  } else if (material) {
    draft = `Supply and install ${material.toLowerCase()} pergola works to the agreed project scope, including frame and material allowance, fixings and associated installation works.`;
  }

  if (isAffirmative(factValue(facts, "pergola.roofing_included"))) {
    draft = appendScopeClause(
      draft,
      "Roof or covering allowance is included where applicable."
    );
  }

  const attachment = factValue(facts, "pergola.attached");
  if (attachment && attachment.toLowerCase() !== "not sure") {
    draft = appendScopeClause(
      draft,
      `Pergola is intended as ${attachment.toLowerCase()} construction within the agreed scope.`
    );
  }

  draft = enrichFromPricingItems(draft, pricingItems);

  return finalizeDraft(
    `${draft} Final material selections, fixing details, drainage, access and any required consenting or engineering requirements are subject to confirmation.`
  );
}

function buildFenceDraft(
  facts: WorkAreaQuoteFact[] | undefined,
  pricingItems?: WorkAreaQuotePricingItem[]
): string {
  const length = factValue(facts, "fence.length_m");
  const height = factValue(facts, "fence.height_m");
  const material = factValue(facts, "fence.material");
  const materialPhrase = material ? material.toLowerCase() : "fence";

  let draft =
    "Supply and install fencing works to the agreed lineal metre scope, including fence materials, fixings, installation labour and removal of existing fencing where included.";

  if (length && height) {
    draft = `Supply and install approximately ${length} lm of ${height} m high ${materialPhrase} fencing to the agreed scope, including materials, fixings, installation labour and removal of existing fencing where included.`;
  } else if (length) {
    draft = `Supply and install approximately ${length} lm of ${materialPhrase} fencing to the agreed scope, including materials, fixings, installation labour and removal of existing fencing where included.`;
  } else if (material) {
    draft = `Supply and install ${materialPhrase} fencing works to the agreed lineal metre scope, including materials, fixings, installation labour and removal of existing fencing where included.`;
  }

  if (isAffirmative(factValue(facts, "fence.demolition_required"))) {
    draft = appendScopeClause(
      draft,
      "Removal of existing fencing is included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "fence.gate_included"))) {
    draft = appendScopeClause(
      draft,
      "Gate allowance is included where applicable."
    );
  }

  draft = enrichFromPricingItems(draft, pricingItems);

  return finalizeDraft(
    `${draft} Final fence height, material selection, ground conditions, boundary set-out and any required neighbour, consent or services checks are subject to confirmation.`
  );
}

function buildBathroomDraft(facts?: WorkAreaQuoteFact[]): string {
  const area = factValue(facts, "bathroom.area_m2");
  const tiling = factValue(facts, "bathroom.tile_extent");

  let draft =
    "Carry out bathroom renovation works to the agreed scope, including selected fixtures, linings, waterproofing, tiling and associated trade coordination where included.";

  if (area) {
    draft = `Carry out bathroom renovation works to the agreed scope for an approximately ${area} m² bathroom, including selected fixtures, linings, waterproofing, tiling and associated trade coordination where included.`;
  }

  if (tiling) {
    draft = appendScopeClause(
      draft,
      `${tiling} tiling is included where applicable.`
    );
  }

  return finalizeDraft(
    `${draft} Final selections, consenting, hidden conditions and subcontractor pricing are subject to confirmation.`
  );
}

function buildKitchenDraft(facts?: WorkAreaQuoteFact[]): string {
  const area = factValue(facts, "kitchen.area_m2");
  let draft =
    "Carry out kitchen renovation works to the agreed scope, including cabinetry, benchtop, appliance and associated installation works where included.";

  if (area) {
    draft = `Carry out kitchen renovation works to the agreed scope for an approximately ${area} m² kitchen, including cabinetry, benchtop, appliance and associated installation works where included.`;
  }

  return finalizeDraft(
    `${draft} Final selections, services changes, hidden conditions and subcontractor pricing are subject to confirmation.`
  );
}

function buildDemolitionDraft(name: string): string {
  const label = name.trim() || "demolition";
  return finalizeDraft(
    `Carry out demolition and removal works for ${label.toLowerCase()} to the agreed scope, including reasonable site protection, removal of specified materials and tidy-up of affected areas. Disposal, access, hidden conditions and hazardous materials are subject to confirmation unless specifically included.`
  );
}

function buildRetainingWallDraft(facts?: WorkAreaQuoteFact[]): string {
  const length = factValue(facts, "retaining_wall.length_m");
  const height =
    factValue(facts, "retaining_wall.height_m") ??
    factValue(facts, "retaining_wall.average_height_m");

  let draft =
    "Construct retaining wall works to the agreed project scope, including wall materials, installation, drainage and backfill allowance where included and associated site works.";

  if (length && height) {
    draft = `Construct retaining wall works to the agreed project scope for an approximately ${length} m long by ${height} m high wall, including wall materials, installation, drainage and backfill allowance where included and associated site works.`;
  } else if (length) {
    draft = `Construct retaining wall works to the agreed project scope for an approximately ${length} m long wall, including wall materials, installation, drainage and backfill allowance where included and associated site works.`;
  }

  return finalizeDraft(
    `${draft} Final ground conditions, engineering, drainage requirements, council approvals and access constraints are subject to confirmation.`
  );
}

function buildFlooringDraft(name: string): string {
  const label = name.trim() || "flooring";
  return finalizeDraft(
    `Carry out ${label.toLowerCase()} works to the agreed scope, including surface preparation, installation and associated finishing where included. Final floor selections, substrate conditions and moisture requirements are subject to confirmation.`
  );
}

function buildPaintingDraft(name: string): string {
  const label = name.trim() || "painting";
  return finalizeDraft(
    `Carry out ${label.toLowerCase()} works to the agreed scope, including surface preparation, priming and finishing coats where included. Final paint selections, substrate condition and access requirements are subject to confirmation.`
  );
}

function buildGenericDraft(name: string): string {
  const label = name.trim() || "work area";
  return finalizeDraft(
    `Carry out the agreed ${label.toLowerCase()} works in accordance with the confirmed project scope, assumptions and exclusions.`
  );
}

export function buildWorkAreaQuoteDescriptionDraft(
  input: WorkAreaQuoteDraftInput
): string {
  const { type, name, facts, pricingItems } = input;

  switch (type) {
    case "deck":
      return buildDeckDraft(facts, pricingItems);
    case "pergola":
      return buildPergolaDraft(facts, pricingItems);
    case "fence":
      return buildFenceDraft(facts, pricingItems);
    case "bathroom":
      return buildBathroomDraft(facts);
    case "kitchen":
      return buildKitchenDraft(facts);
    case "demolition":
      return buildDemolitionDraft(name);
    case "retaining_wall":
      return buildRetainingWallDraft(facts);
    case "flooring":
      return buildFlooringDraft(name);
    case "painting":
      return buildPaintingDraft(name);
    case "external_stairs":
      return finalizeDraft(
        enrichFromPricingItems(
          "Supply and install external stair works to the agreed project scope, including framing, treads, handrails and associated installation works where included.",
          pricingItems
        )
      );
    default:
      return enrichFromPricingItems(buildGenericDraft(name), pricingItems);
  }
}

export function resolveWorkAreaQuoteDescription(
  workArea: {
    type: string;
    name: string;
    quote_description?: string | null;
  },
  facts?: WorkAreaQuoteFact[],
  pricingItems?: WorkAreaQuotePricingItem[]
): string {
  const saved = workArea.quote_description?.trim();
  if (saved) {
    return saved;
  }

  return buildWorkAreaQuoteDescriptionDraft({
    type: workArea.type,
    name: workArea.name,
    facts,
    pricingItems,
  });
}

export function buildWorkAreaDescriptionsMap(
  workAreas: Array<{
    id: string;
    type: string;
    name: string;
    quote_description?: string | null;
  }>,
  factsByWorkAreaId: Map<string, WorkAreaQuoteFact[]>,
  pricingItemsByWorkAreaId: Map<string, WorkAreaQuotePricingItem[]> = new Map()
): Map<string, string> {
  const result = new Map<string, string>();

  for (const workArea of workAreas) {
    result.set(
      workArea.id,
      resolveWorkAreaQuoteDescription(
        workArea,
        factsByWorkAreaId.get(workArea.id) ?? [],
        pricingItemsByWorkAreaId.get(workArea.id)
      )
    );
  }

  return result;
}
