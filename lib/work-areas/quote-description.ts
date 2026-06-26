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
  const material = factValue(facts, "deck.board_material") ?? factValue(facts, "deck.material");
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

  if (isAffirmative(factValue(facts, "deck.existing_deck_removal")) || isAffirmative(factValue(facts, "deck.demolition_required"))) {
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

  const height = factValue(facts, "deck.height_m");
  if (height) {
    draft = appendScopeClause(
      draft,
      `Deck is approximately ${height} m above ground where applicable.`
    );
  }

  const accessType = factValue(facts, "deck.access_type");
  if (accessType && accessType.toLowerCase() !== "none") {
    draft = appendScopeClause(
      draft,
      `${accessType} access is included where applicable.`
    );
  } else if (isAffirmative(factValue(facts, "deck.has_stairs"))) {
    draft = appendScopeClause(
      draft,
      "Associated stair access is included where applicable."
    );
  }

  if (
    isAffirmative(factValue(facts, "deck.balustrade_required")) ||
    isAffirmative(factValue(facts, "deck.has_balustrade"))
  ) {
    draft = appendScopeClause(
      draft,
      "Balustrade works are included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "deck.vertical_face_boards_required"))) {
    draft = appendScopeClause(
      draft,
      "Vertical face/fascia boards are included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "deck.pile_or_post_replacement_required"))) {
    draft = appendScopeClause(
      draft,
      "Pile, post or substructure replacement is included where applicable."
    );
  }

  const boardWidth = factValue(facts, "deck.board_width_mm");
  if (boardWidth) {
    draft = appendScopeClause(
      draft,
      `${boardWidth} mm decking boards are allowed for within the agreed scope.`
    );
  }

  const consentStatus = factValue(facts, "deck.engineering_or_consent_status");
  if (consentStatus?.toLowerCase().includes("required")) {
    draft = appendScopeClause(
      draft,
      "Engineering and consent requirements are subject to separate confirmation."
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

  const roofingType = factValue(facts, "pergola.roofing_type");
  if (roofingType && isAffirmative(factValue(facts, "pergola.roofing_included"))) {
    draft = appendScopeClause(
      draft,
      `${roofingType} roof or covering is included where applicable.`
    );
  }

  if (isAffirmative(factValue(facts, "pergola.gutters_included"))) {
    draft = appendScopeClause(
      draft,
      "Gutter or drainage allowance is included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "pergola.footings_required"))) {
    draft = appendScopeClause(
      draft,
      "Post footings or concrete pads are included where applicable."
    );
  }

  const finishType = factValue(facts, "pergola.finish_type");
  if (isAffirmative(factValue(facts, "pergola.finish_required"))) {
    draft = appendScopeClause(
      draft,
      finishType
        ? `${finishType.replace(/_/g, " ")} finish is included where applicable.`
        : "Painting or staining finish is included where applicable."
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

  if (isAffirmative(factValue(facts, "fence.disposal_required"))) {
    draft = appendScopeClause(
      draft,
      "Disposal of removed fencing is included where applicable."
    );
  }

  const finishRequired = factValue(facts, "fence.finish_required");
  const finishType = factValue(facts, "fence.finish_type");
  if (isAffirmative(finishRequired)) {
    draft = appendScopeClause(
      draft,
      finishType
        ? `${finishType.replace(/_/g, " ")} finish is included where applicable.`
        : "Painting or staining finish is included where applicable."
    );
  } else if (
    finishRequired?.toLowerCase() === "false" ||
    finishRequired?.toLowerCase() === "no"
  ) {
    draft = appendScopeClause(
      draft,
      "Final painting or staining of the fence is excluded."
    );
  }

  const slope = factValue(facts, "fence.slope_condition");
  if (slope && !slope.toLowerCase().includes("flat")) {
    draft = appendScopeClause(
      draft,
      "Sloping or uneven ground conditions are allowed for within the agreed scope."
    );
  }

  const boundary = factValue(facts, "fence.boundary_approval_status");
  if (boundary?.toLowerCase().includes("pending")) {
    draft = appendScopeClause(
      draft,
      "Boundary/neighbour approval is pending confirmation."
    );
  } else if (boundary?.toLowerCase().includes("not sure")) {
    draft = appendScopeClause(
      draft,
      "Boundary survey and neighbour approvals are excluded unless specifically confirmed."
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
  const renovationType = factValue(facts, "bathroom.renovation_type");

  let draft =
    "Carry out bathroom renovation works to the agreed scope, including selected fixtures, linings, waterproofing, tiling and associated trade coordination where included.";

  if (renovationType) {
    draft = `Carry out ${renovationType.toLowerCase()} bathroom works to the agreed scope, including selected fixtures, linings, waterproofing, tiling and associated trade coordination where included.`;
  }

  if (area) {
    draft = `${draft.replace(/\.$/, "")} for an approximately ${area} m² bathroom.`;
  }

  if (isAffirmative(factValue(facts, "bathroom.demolition_required"))) {
    draft = appendScopeClause(
      draft,
      "Demolition/strip-out of existing bathroom works is included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "bathroom.fixtures_client_supplied"))) {
    draft = appendScopeClause(
      draft,
      "Bathroom fixtures are client supplied; contractor install and coordination included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "bathroom.underfloor_heating_included"))) {
    draft = appendScopeClause(
      draft,
      "Underfloor heating allowance is included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "bathroom.waterproofing_included")) || isAffirmative(factValue(facts, "bathroom.waterproofing_required"))) {
    draft = appendScopeClause(draft, "Waterproofing is included where applicable.");
  }

  if (tiling) {
    draft = appendScopeClause(
      draft,
      `${tiling} tiling is included where applicable.`
    );
  }

  const showerType = factValue(facts, "bathroom.shower_type");
  if (showerType) {
    draft = appendScopeClause(draft, `${showerType} shower allowance is included where applicable.`);
  }

  if (isAffirmative(factValue(facts, "bathroom.ventilation_included"))) {
    draft = appendScopeClause(draft, "Extractor fan/ventilation is included where applicable.");
  }

  draft = appendScopeClause(
    draft,
    "Unknown plumbing/electrical changes, consent, asbestos, rot and substrate repairs are excluded unless specifically included."
  );

  return finalizeDraft(
    `${draft} Final selections, consenting, hidden conditions and subcontractor pricing are subject to confirmation.`
  );
}

function buildKitchenDraft(facts?: WorkAreaQuoteFact[]): string {
  const area = factValue(facts, "kitchen.area_m2");
  const renovationType = factValue(facts, "kitchen.renovation_type");
  let draft =
    "Carry out kitchen renovation works to the agreed scope, including cabinetry, benchtop, appliance and associated installation works where included.";

  if (renovationType) {
    draft = `Carry out ${renovationType.toLowerCase()} kitchen works to the agreed scope, including cabinetry, benchtop, appliance and associated installation works where included.`;
  }

  if (area) {
    draft = `${draft.replace(/\.$/, "")} for an approximately ${area} m² kitchen.`;
  }

  if (isAffirmative(factValue(facts, "kitchen.demolition_required"))) {
    draft = appendScopeClause(draft, "Removal of the existing kitchen is included where applicable.");
  }

  if (isAffirmative(factValue(facts, "kitchen.cabinetry_client_supplied"))) {
    draft = appendScopeClause(
      draft,
      "Cabinetry is client supplied; contractor install and coordination included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "kitchen.splashback_included"))) {
    draft = appendScopeClause(draft, "Splashback allowance is included where applicable.");
  }

  if (isAffirmative(factValue(facts, "kitchen.rangehood_included"))) {
    draft = appendScopeClause(draft, "Rangehood/venting allowance is included where applicable.");
  }

  const plumbing = factValue(facts, "kitchen.plumbing_changes");
  const electrical = factValue(facts, "kitchen.electrical_changes");
  if (plumbing?.toLowerCase() === "none") {
    draft = appendScopeClause(draft, "Plumbing changes are excluded unless specifically confirmed.");
  }
  if (electrical?.toLowerCase() === "none") {
    draft = appendScopeClause(draft, "Electrical changes are excluded unless specifically confirmed.");
  }

  if (isAffirmative(factValue(facts, "kitchen.flooring_included"))) {
    const flooringType = factValue(facts, "kitchen.flooring_type");
    draft = appendScopeClause(
      draft,
      flooringType
        ? `${flooringType} kitchen flooring is included where applicable.`
        : "Kitchen flooring is included where applicable."
    );
  }

  return finalizeDraft(
    `${draft} Design, engineering, consent and final selections are subject to confirmation unless specifically included.`
  );
}

function buildInternalWallsDraft(facts?: WorkAreaQuoteFact[]): string {
  const length = factValue(facts, "internal_walls.length_lm");
  const height = factValue(facts, "internal_walls.height_m");
  const lining = factValue(facts, "internal_walls.wall_lining_type");
  const sides = factValue(facts, "internal_walls.lining_sides");

  let draft =
    "Construct internal wall works to the agreed scope, including framing, lining and associated finishing where included.";

  if (length && height) {
    draft = `Construct approximately ${length} lm of ${height} m high internal wall to the agreed scope, including framing, lining and associated finishing where included.`;
  }

  if (lining) {
    draft = appendScopeClause(draft, `${lining} lining is included where applicable.`);
  }
  if (sides) {
    draft = appendScopeClause(draft, `Lining on ${sides.toLowerCase()} is included where applicable.`);
  }
  if (isAffirmative(factValue(facts, "internal_walls.insulation_included"))) {
    draft = appendScopeClause(draft, "Wall insulation is included where applicable.");
  }
  if (isAffirmative(factValue(facts, "internal_walls.skirtings_included"))) {
    draft = appendScopeClause(draft, "Skirting is included where applicable.");
  }

  draft = appendScopeClause(
    draft,
    "Services relocation and fire/acoustic certification are excluded unless specifically included."
  );

  return finalizeDraft(draft);
}

function buildCeilingsDraft(facts?: WorkAreaQuoteFact[]): string {
  const area = factValue(facts, "ceilings.area_m2");
  const ceilingType = factValue(facts, "ceilings.ceiling_type");

  let draft =
    "Carry out ceiling works to the agreed scope, including lining, stopping and finishing where included.";

  if (area && ceilingType) {
    draft = `Install approximately ${area} m² of ${ceilingType.toLowerCase()} ceiling to the agreed scope, including lining, stopping and finishing where included.`;
  } else if (area) {
    draft = `Carry out ceiling works to the agreed scope for approximately ${area} m², including lining, stopping and finishing where included.`;
  }

  if (isAffirmative(factValue(facts, "ceilings.battens_included"))) {
    draft = appendScopeClause(draft, "Ceiling battens/framing are included where applicable.");
  }
  if (isAffirmative(factValue(facts, "ceilings.insulation_included"))) {
    draft = appendScopeClause(draft, "Ceiling insulation is included where applicable.");
  }
  if (isAffirmative(factValue(facts, "ceilings.stopping_included"))) {
    draft = appendScopeClause(draft, "Stopping/plastering is included where applicable.");
  }
  if (isAffirmative(factValue(facts, "ceilings.painting_included"))) {
    draft = appendScopeClause(draft, "Ceiling painting is included where applicable.");
  }

  draft = appendScopeClause(
    draft,
    "Electrical/light relocation is excluded unless specifically included."
  );

  return finalizeDraft(draft);
}

function buildDoorsDraft(facts?: WorkAreaQuoteFact[]): string {
  const count = factValue(facts, "doors.count");
  const doorType = factValue(facts, "doors.door_type");
  const supplyScope = factValue(facts, "doors.supply_scope");

  let draft = "Supply and install internal door works to the agreed scope, including frames, hardware and associated finishing where included.";

  if (count && doorType) {
    draft = `${supplyScope?.toLowerCase().includes("install only") ? "Install" : "Supply and install"} ${count} ${doorType.toLowerCase()} internal door(s) to the agreed scope, including frames, hardware and associated finishing where included.`;
  } else if (count) {
    draft = `Supply and install ${count} internal door(s) to the agreed scope, including frames, hardware and associated finishing where included.`;
  }

  if (isAffirmative(factValue(facts, "doors.architraves_included"))) {
    draft = appendScopeClause(draft, "Architraves are included where applicable.");
  }

  draft = appendScopeClause(
    draft,
    "Specialist hardware and fire certification are excluded unless specifically included."
  );

  return finalizeDraft(draft);
}

function buildDemolitionDraft(name: string, facts?: WorkAreaQuoteFact[]): string {
  const label = name.trim() || "demolition";
  let draft = `Carry out demolition and strip-out works for ${label.toLowerCase()} to the agreed scope, including removal of specified materials and tidy-up of affected areas.`;

  const scopeItems = facts?.find((fact) => fact.key === "demolition.scope_items")?.value;
  if (scopeItems) {
    draft = appendScopeClause(
      draft,
      `Scope includes: ${scopeItems}.`
    );
  }

  if (isAffirmative(factValue(facts, "demolition.disposal_included"))) {
    draft = appendScopeClause(draft, "Disposal and waste removal are included where applicable.");
  }

  if (isAffirmative(factValue(facts, "demolition.skip_bin_included"))) {
    draft = appendScopeClause(draft, "Skip bin allowance is included where applicable.");
  }

  const carting = factValue(facts, "demolition.carting_distance_m");
  if (carting) {
    draft = appendScopeClause(
      draft,
      `Carting/disposal access allowance included for approximately ${carting} m carry distance.`
    );
  }

  const floorLevel = factValue(facts, "demolition.floor_level");
  if (floorLevel?.toLowerCase().includes("upper")) {
    draft = appendScopeClause(
      draft,
      "Upper-floor strip-out and carting allowances are included where applicable."
    );
  }

  const services = factValue(facts, "demolition.services_isolated");
  if (services?.toLowerCase().includes("by others")) {
    draft = appendScopeClause(
      draft,
      "Services isolation is by others and excluded from this scope."
    );
  }

  const hazardous =
    factValue(facts, "demolition.hazardous_materials_risk") ??
    factValue(facts, "demolition.hazardous_materials_suspected");
  if (hazardous && !hazardous.toLowerCase().includes("none")) {
    draft = appendScopeClause(
      draft,
      "Hazardous materials testing/removal is excluded unless specifically confirmed and included."
    );
  }

  return finalizeDraft(
    `${draft} Structural demolition, consent, services isolation (unless included), hidden conditions and hazardous materials are subject to confirmation unless specifically included.`
  );
}

function buildExternalStairsDraft(facts?: WorkAreaQuoteFact[]): string {
  const risers =
    factValue(facts, "external_stairs.risers_count") ??
    factValue(facts, "external_stairs.approximate_riser_count");
  const totalRise = factValue(facts, "external_stairs.total_rise_m");
  const material = factValue(facts, "external_stairs.material");
  const width = factValue(facts, "external_stairs.width_m");

  let draft =
    "Supply and install external stair works to the agreed project scope, including framing, treads and associated installation where included.";

  if (risers && material) {
    draft = `Supply and install approximately ${risers} riser ${material.toLowerCase()} external stair works to the agreed project scope, including treads, stringers and associated installation where included.`;
  } else if (risers) {
    draft = `Supply and install approximately ${risers} riser external stair works to the agreed project scope, including treads, stringers and associated installation where included.`;
  } else if (totalRise) {
    draft = `Supply and install external stair works for approximately ${totalRise} m total rise to the agreed project scope, including treads, stringers and associated installation where included.`;
  }

  if (width) {
    draft = appendScopeClause(
      draft,
      `Stair width allowance of approximately ${width} m is included.`
    );
  }

  if (isAffirmative(factValue(facts, "external_stairs.landing_included"))) {
    draft = appendScopeClause(draft, "Landing allowance is included where applicable.");
  }

  if (isAffirmative(factValue(facts, "external_stairs.handrail_included"))) {
    draft = appendScopeClause(draft, "Handrail is included where applicable.");
  }

  if (isAffirmative(factValue(facts, "external_stairs.balustrade_included"))) {
    draft = appendScopeClause(draft, "Balustrade is included where applicable.");
  }

  if (isAffirmative(factValue(facts, "external_stairs.existing_removal"))) {
    draft = appendScopeClause(
      draft,
      "Removal of existing stairs is included where applicable."
    );
  }

  const finishType = factValue(facts, "external_stairs.finish_type");
  if (
    isAffirmative(factValue(facts, "external_stairs.finish_required")) ||
    (finishType && !finishType.toLowerCase().includes("none"))
  ) {
    draft = appendScopeClause(
      draft,
      `${finishType ?? "Finish"} allowance is included where applicable.`
    );
  }

  draft = appendScopeClause(
    draft,
    "Consent, engineering, ground remediation and hidden conditions are excluded unless specifically included."
  );

  return finalizeDraft(draft);
}

function buildRetainingWallDraft(facts?: WorkAreaQuoteFact[]): string {
  const length = factValue(facts, "retaining_wall.length_m");
  const height =
    factValue(facts, "retaining_wall.height_m") ??
    factValue(facts, "retaining_wall.average_height_m");
  const material = factValue(facts, "retaining_wall.material");

  let draft =
    "Construct retaining wall works to the agreed project scope, including wall materials, installation, drainage and backfill allowance where included and associated site works.";

  if (length && height) {
    draft = `Construct retaining wall works to the agreed project scope for an approximately ${length} m long by ${height} m high wall, including wall materials, installation, drainage and backfill allowance where included and associated site works.`;
  } else if (length) {
    draft = `Construct retaining wall works to the agreed project scope for an approximately ${length} m long wall, including wall materials, installation, drainage and backfill allowance where included and associated site works.`;
  }

  if (material) {
    draft = appendScopeClause(
      draft,
      `${material.toLowerCase()} retaining wall construction is allowed for within the agreed scope.`
    );
  }

  if (isAffirmative(factValue(facts, "retaining_wall.is_raking"))) {
    const high = factValue(facts, "retaining_wall.height_high_m");
    const low = factValue(facts, "retaining_wall.height_low_m");
    if (high && low) {
      draft = appendScopeClause(
        draft,
        `Raking wall from approximately ${high} m down to ${low} m is included where applicable.`
      );
    } else {
      draft = appendScopeClause(
        draft,
        "Raking/pitched retaining wall construction is included where applicable."
      );
    }
  }

  const fixingType = factValue(facts, "retaining_wall.fixing_type");
  if (fixingType?.toLowerCase().includes("face")) {
    draft = appendScopeClause(draft, "Face-fixed wall construction is included.");
  }

  if (isAffirmative(factValue(facts, "retaining_wall.drainage_required"))) {
    draft = appendScopeClause(
      draft,
      "Drainage allowance including novacoil with sleeve/sock is included where applicable."
    );
  }

  if (isAffirmative(factValue(facts, "retaining_wall.backfill_included"))) {
    draft = appendScopeClause(
      draft,
      "Backfill allowance is included where applicable."
    );
  }

  const drainConnection = factValue(facts, "retaining_wall.drain_connection_required");
  if (
    drainConnection &&
    !drainConnection.toLowerCase().startsWith("no")
  ) {
    draft = appendScopeClause(
      draft,
      "Drainage connection or cesspit allowance is included where applicable."
    );
  } else if (drainConnection?.toLowerCase().includes("not sure")) {
    draft = appendScopeClause(
      draft,
      "Unknown drainage connections are excluded unless specifically confirmed."
    );
  }

  const carting = factValue(facts, "retaining_wall.carting_distance_m");
  if (carting) {
    draft = appendScopeClause(
      draft,
      `Carting/material handling for approximately ${carting} m is allowed for within the agreed scope.`
    );
  }

  if (isAffirmative(factValue(facts, "retaining_wall.disposal_included"))) {
    draft = appendScopeClause(
      draft,
      "Spoil disposal and cartage is included where applicable."
    );
  } else {
    const disposal = factValue(facts, "retaining_wall.disposal_included");
    if (disposal?.toLowerCase() === "false" || disposal?.toLowerCase() === "no") {
      draft = appendScopeClause(
        draft,
        "Spoil disposal and cartage is excluded unless specifically confirmed."
      );
    }
  }

  return finalizeDraft(
    `${draft} Final ground conditions, engineering, drainage requirements, council approvals and access constraints are subject to confirmation.`
  );
}

function buildFlooringDraft(name: string, facts?: WorkAreaQuoteFact[]): string {
  const label = name.trim() || "flooring";
  const flooringType = factValue(facts, "flooring.type");
  const area = factValue(facts, "flooring.area_m2");
  const supplyScope = factValue(facts, "flooring.supply_scope");
  let draft = `Carry out ${label.toLowerCase()} works to the agreed scope, including surface preparation, installation and associated finishing where included.`;
  if (flooringType && area) {
    draft = `Carry out ${flooringType.toLowerCase()} ${label.toLowerCase()} works for approximately ${area} m² to the agreed scope, including surface preparation, installation and associated finishing where included.`;
  } else if (flooringType) {
    draft = `Carry out ${flooringType.toLowerCase()} ${label.toLowerCase()} works to the agreed scope, including surface preparation, installation and associated finishing where included.`;
  }
  if (supplyScope?.toLowerCase().includes("install only")) {
    draft = appendScopeClause(draft, "Flooring is client supplied; install labour only.");
  }
  if (isAffirmative(factValue(facts, "flooring.existing_flooring_removal"))) {
    draft = appendScopeClause(draft, "Removal of existing flooring is included where applicable.");
  }
  const prep = factValue(facts, "flooring.floor_prep_level");
  if (prep && !prep.toLowerCase().includes("none")) {
    draft = appendScopeClause(draft, `${prep} floor preparation is included where applicable.`);
  }
  if (isAffirmative(factValue(facts, "flooring.scotia_included"))) {
    draft = appendScopeClause(draft, "Scotia/skirting is included where applicable.");
  }
  return finalizeDraft(
    `${draft} Final floor selections, substrate conditions and moisture requirements are subject to confirmation.`
  );
}

function buildPaintingDraft(name: string, facts?: WorkAreaQuoteFact[]): string {
  const label = name.trim() || "painting";
  const location = factValue(facts, "painting.location");
  const coats = factValue(facts, "painting.coats_required");
  const prep = factValue(facts, "painting.prep_level");
  const area =
    factValue(facts, "painting.internal_area_m2") ??
    factValue(facts, "painting.external_area_m2");
  let draft = `Carry out ${label.toLowerCase()} works to the agreed scope, including surface preparation, priming and finishing coats where included.`;
  if (location) {
    draft = `Carry out ${location.toLowerCase()} ${label.toLowerCase()} works to the agreed scope, including surface preparation, priming and finishing coats where included.`;
  }
  if (area) {
    draft = appendScopeClause(draft, `Approximately ${area} m² total painting area allowed for within the agreed scope.`);
  }
  if (coats) {
    draft = appendScopeClause(draft, `${coats} coat(s) are included where applicable.`);
  }
  if (prep) {
    draft = appendScopeClause(draft, `${prep} surface preparation is included where applicable.`);
  }
  if (isAffirmative(factValue(facts, "painting.paint_client_supplied"))) {
    draft = appendScopeClause(draft, "Paint is client supplied; labour only.");
  }
  draft = appendScopeClause(
    draft,
    "Major repairs and scaffold/high access are excluded unless specifically included."
  );
  return finalizeDraft(
    `${draft} Final paint selections, substrate condition and access requirements are subject to confirmation.`
  );
}

function buildPlasteringDraft(
  facts: WorkAreaQuoteFact[] | undefined,
  name: string
): string {
  const label = name.trim() || "plastering";
  const level = factValue(facts, "plastering.level");
  const area = factValue(facts, "plastering.area_m2");
  const surface = factValue(facts, "plastering.surface_type");
  let draft = `Carry out ${label.toLowerCase()} works to the agreed scope, including stopping, sanding and finishing where included.`;
  if (level && area) {
    draft = `Carry out ${level.toLowerCase()} ${label.toLowerCase()} to approximately ${area} m² to the agreed scope, including stopping, sanding and finishing where included.`;
  } else if (level) {
    draft = `Carry out ${level.toLowerCase()} ${label.toLowerCase()} works to the agreed scope, including stopping, sanding and finishing where included.`;
  }
  if (surface) {
    draft = appendScopeClause(draft, `${surface} surface type is allowed for within the agreed scope.`);
  }
  if (isAffirmative(factValue(facts, "plastering.sanding_included"))) {
    draft = appendScopeClause(draft, "Sanding ready for paint is included where applicable.");
  }
  draft = appendScopeClause(draft, "Painting is excluded unless specifically included.");
  return finalizeDraft(
    `${draft} Final substrate condition and finish requirements are subject to confirmation.`
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
      return buildDemolitionDraft(name, facts);
    case "retaining_wall":
      return buildRetainingWallDraft(facts);
    case "flooring":
      return buildFlooringDraft(name, facts);
    case "painting":
      return buildPaintingDraft(name, facts);
    case "plastering":
      return buildPlasteringDraft(facts, name);
    case "internal_walls":
      return buildInternalWallsDraft(facts);
    case "ceilings":
      return buildCeilingsDraft(facts);
    case "doors":
      return buildDoorsDraft(facts);
    case "external_stairs":
      return buildExternalStairsDraft(facts);
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
