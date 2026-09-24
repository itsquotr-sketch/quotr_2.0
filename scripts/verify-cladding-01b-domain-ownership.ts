/**
 * CLADDING-01B — nested Cladding Section domain and ownership.
 *
 * Run: npx --yes tsx scripts/verify-cladding-01b-domain-ownership.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateCladding } from "../lib/estimate/calculators/cladding";
import {
  CLADDING_APPROVED_PROFILES,
  claddingApprovedProfileById,
} from "../lib/estimate/cladding-profiles";
import {
  CLADDING_ACTIVE_PORTION_ID_FACT_KEY,
  CLADDING_ADD_PORTION_KEY,
  CLADDING_CALCULATOR_CONSUMED_FACTS,
  CLADDING_DELETE_PORTION_KEY,
  CLADDING_DUPLICATE_PORTION_KEY,
  CLADDING_PORTION_FIELD_KEYS,
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_STAGED_NOT_CALCULATED_MESSAGE,
  CLADDING_SUPPORT_NOTES,
  CLADDING_V1_HUMAN_QA_FROZEN,
  applyCladdingFactWrite,
  claddingPortionProfileConsistent,
  claddingPortionsFactSourceForWrite,
  createEmptyCladdingPortion,
  isCladdingPortionWriteKey,
  mergePersistedCladdingPortionsOnReanalyse,
  nextCladdingCollectionEnvelope,
  parseCladdingPortion,
  rejectStaleCladdingCas,
  storedCladdingPortions,
} from "../lib/estimate/cladding-portions";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import {
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import { workAreaMayCloseAtL5 } from "../lib/estimate/benchmark-coverage";
import { isCalculatorConsumedFact } from "../lib/estimate/consumed-facts";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { getFactDisplayLabel } from "../lib/scopes/fact-labels";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import {
  CLADDING_JOINERY_INSTALL_BOUNDARY,
  classifyCladdingOwnership,
} from "../lib/work-areas/cladding-ownership";
import {
  getWorkAreaCapabilityLabel,
  getWorkAreaSupportEntry,
  isUnsupportedWorkAreaType,
} from "../lib/work-areas/support-contract";
import { isFirstRunPrimaryWorkAreaType } from "../lib/setup/first-run-work-areas";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function portionsOf(facts: readonly EstimateFact[]): ReturnType<typeof storedCladdingPortions> {
  return storedCladdingPortions(facts, "c1");
}

function write(facts: EstimateFact[], key: string, value: unknown, nestedItemId?: string): EstimateFact[] {
  return applyCladdingFactWrite({
    facts,
    workAreaId: "c1",
    key,
    value,
    nestedItemId,
  });
}

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: {
    sheet_material: 10,
    flooring: 10,
    paint: 10,
    default: 5,
  },
  rates: [],
} as unknown as EstimateContext;

function main(): void {
  console.log("=== CLADDING-01B domain and ownership ===\n");

  const support = getWorkAreaSupportEntry("cladding");
  check("1. cladding.portions is the canonical key", CLADDING_PORTIONS_FACT_KEY === "cladding.portions");
  check(
    "2. catalogue lists Cladding as a creatable Work Area",
    SCOPE_CATALOGUE.some((row) => row.type === "cladding" && row.label === "Cladding")
  );
  check(
    "3. support notes state domain-only and unwired commercial path",
    support?.notes === CLADDING_SUPPORT_NOTES &&
      support.band === "staged" &&
      support.estimatableAsWorkArea === false &&
      getWorkAreaCapabilityLabel("cladding") === "Domain only"
  );
  check("4. Cladding is not human-QA frozen", CLADDING_V1_HUMAN_QA_FROZEN === false);
  check(
    "5. Cladding is not L5-closeable",
    workAreaMayCloseAtL5(verifyRegisteredWorkAreaBenchmarkCoverage("cladding")) === false
  );
  check(
    "6. Cladding is not a first-run primary and roofing stays unsupported",
    !isFirstRunPrimaryWorkAreaType("cladding") &&
      isUnsupportedWorkAreaType("roofing") &&
      !isUnsupportedWorkAreaType("cladding")
  );
  check(
    "7. logical field keys are registered and labelled",
    CLADDING_PORTION_FIELD_KEYS.every(
      (key) => isCladdingPortionWriteKey(key) && getFactDisplayLabel(key) !== key
    ) &&
      isCladdingPortionWriteKey(CLADDING_ADD_PORTION_KEY) &&
      isCladdingPortionWriteKey(CLADDING_DUPLICATE_PORTION_KEY) &&
      isCladdingPortionWriteKey(CLADDING_DELETE_PORTION_KEY) &&
      isCladdingPortionWriteKey(CLADDING_ACTIVE_PORTION_ID_FACT_KEY)
  );
  check(
    "8. consumed contract is the collection only",
    CLADDING_CALCULATOR_CONSUMED_FACTS.length === 1 &&
      CLADDING_CALCULATOR_CONSUMED_FACTS[0] === "cladding.portions" &&
      isCalculatorConsumedFact("cladding", "cladding.portions") &&
      !isCalculatorConsumedFact("cladding", "cladding.portion.effective_cover_mm")
  );

  const bevel = claddingApprovedProfileById("timber_bevelback_142x18");
  const rust = claddingApprovedProfileById("timber_rusticated_230x18");
  const ship = claddingApprovedProfileById("timber_vertical_shiplap_90x21");
  const fc = claddingApprovedProfileById("fibre_cement_horizontal_weatherboard_180");
  const sheet = claddingApprovedProfileById("timber_sheet_board_and_batten");
  check(
    "9. approved bevelback, rusticated, shiplap and fibre-cement covers match the owner table",
    bevel?.effective_cover_mm === 110 &&
      bevel.nominal_width_mm === 142 &&
      claddingApprovedProfileById("timber_bevelback_187x18")?.effective_cover_mm === 155 &&
      claddingApprovedProfileById("timber_bevelback_215x18")?.effective_cover_mm === 183 &&
      claddingApprovedProfileById("timber_bevelback_230x18")?.effective_cover_mm === 198 &&
      claddingApprovedProfileById("timber_rusticated_135x18")?.effective_cover_mm === 110 &&
      claddingApprovedProfileById("timber_rusticated_180x18")?.effective_cover_mm === 155 &&
      claddingApprovedProfileById("timber_rusticated_215x18")?.effective_cover_mm === 190 &&
      rust?.effective_cover_mm === 205 &&
      ship?.effective_cover_mm === 65 &&
      ship.orientation === "vertical" &&
      claddingApprovedProfileById("timber_vertical_shiplap_135x21")?.effective_cover_mm === 110 &&
      claddingApprovedProfileById("fibre_cement_horizontal_weatherboard_150")?.effective_cover_mm === 120 &&
      fc?.effective_cover_mm === 150 &&
      fc.nominal_width_mm === 180
  );
  check(
    "10. board-and-batten profile is 2400 x 1200 with an 8 mm gap",
    sheet?.board_sheet_length_mm === 2400 &&
      sheet.board_sheet_width_mm === 1200 &&
      sheet.board_gap_mm === 8 &&
      sheet.system === "timber_sheet_board_and_batten"
  );
  check(
    "11. fibre-cement cover is not a generic 10 mm overlap",
    CLADDING_APPROVED_PROFILES.filter(
      (row) => row.system === "fibre_cement_horizontal_weatherboard"
    ).every(
      (row) =>
        row.nominal_width_mm != null &&
        row.effective_cover_mm !== row.nominal_width_mm - 10
    )
  );

  const valid = parseCladdingPortion({
    id: "cs-1",
    scope_intent: "install",
    cladding_family: "timber",
    cladding_system: "timber_bevelback",
    orientation: "horizontal",
    area_method: "direct_m2",
    direct_area_m2: 12.5,
    nominal_width_mm: 142,
  });
  check(
    "12. valid enums and positive measurements are retained",
    valid?.scope_intent === "install" &&
      valid.cladding_system === "timber_bevelback" &&
      valid.direct_area_m2 === 12.5 &&
      valid.nominal_width_mm === 142
  );
  const invalid = parseCladdingPortion({
    id: "cs-2",
    scope_intent: "maybe",
    cladding_family: "steel",
    cladding_system: "linea",
    orientation: "diagonal",
    area_method: "guess",
    direct_area_m2: 0,
    length_m: -3,
    height_m: Number.NaN,
    opening_area_m2: Number.POSITIVE_INFINITY,
    nominal_width_mm: -1,
  });
  check(
    "13. invalid enums and non-positive measurements are rejected",
    invalid?.scope_intent == null &&
      invalid?.cladding_family == null &&
      invalid?.cladding_system == null &&
      invalid?.orientation == null &&
      invalid?.area_method == null &&
      invalid?.direct_area_m2 == null &&
      invalid?.length_m == null &&
      invalid?.height_m == null &&
      invalid?.opening_area_m2 == null &&
      invalid?.nominal_width_mm == null
  );
  const derived = parseCladdingPortion({
    id: "cs-3",
    net_area_m2: 40,
    lineal_m: 12,
    sheet_count: 4,
    hours: 3,
    cost: 85,
  } as never);
  check(
    "14. derived physical and money fields are not stored",
    derived != null &&
      !("net_area_m2" in derived) &&
      !("lineal_m" in derived) &&
      !("sheet_count" in derived) &&
      !("hours" in derived) &&
      !("cost" in derived)
  );

  let facts = write([], CLADDING_ADD_PORTION_KEY, true);
  facts = write(facts, CLADDING_ADD_PORTION_KEY, true);
  const added = portionsOf(facts);
  check(
    "15. Add creates an empty section with a new stable id and no invented specification",
    added.length === 2 &&
      added[0]?.id !== added[1]?.id &&
      added[0]?.cladding_family == null &&
      added[0]?.cladding_system == null &&
      added[0]?.orientation == null &&
      added[0]?.direct_area_m2 == null &&
      added[0]?.effective_cover_mm == null &&
      added[0]?.cavity_included == null
  );
  facts = write(facts, "cladding.portion.approved_profile", "timber_bevelback_142x18", added[0]?.id);
  const profiled = portionsOf(facts)[0];
  check(
    "16. approved profile metadata is internally consistent",
    profiled != null &&
      claddingPortionProfileConsistent(profiled) &&
      profiled.effective_cover_mm === 110 &&
      profiled.nominal_width_mm === 142 &&
      profiled.nominal_thickness_mm === 18 &&
      profiled.nominal_width_authority == null &&
      profiled.effective_cover_authority == null &&
      profiled.approved_profile_authority === "user"
  );
  facts = write(facts, "cladding.portion.effective_cover_mm", 111, added[0]?.id);
  const custom = portionsOf(facts)[0];
  check(
    "17. a competing cover becomes custom and is not coerced back to bevelback",
    custom?.approved_profile_id == null &&
      custom?.cladding_family === "other" &&
      custom?.cladding_system === "specialist_unresolved" &&
      custom?.specialist_kind === "custom_profile" &&
      custom?.effective_cover_mm === 111
  );

  let sheetFacts = write([], CLADDING_ADD_PORTION_KEY, true);
  const sheetId = portionsOf(sheetFacts)[0]?.id ?? "";
  sheetFacts = write(sheetFacts, "cladding.portion.approved_profile", "timber_sheet_board_and_batten", sheetId);
  sheetFacts = write(sheetFacts, "cladding.portion.batten_width_mm", 65, sheetId);
  sheetFacts = write(sheetFacts, "cladding.portion.batten_thickness_mm", 19, sheetId);
  const sheetPortion = portionsOf(sheetFacts)[0];
  check(
    "18. ordinary batten options stay on the sheet profile",
    sheetPortion?.board_sheet_length_mm === 2400 &&
      sheetPortion.board_gap_mm === 8 &&
      sheetPortion.batten_width_mm === 65 &&
      sheetPortion.batten_thickness_mm === 19 &&
      sheetPortion.approved_profile_id === "timber_sheet_board_and_batten"
  );
  sheetFacts = write(sheetFacts, "cladding.portion.batten_width_mm", 50, sheetId);
  check(
    "19. a non-option batten does not stay on the ordinary sheet identity",
    portionsOf(sheetFacts)[0]?.approved_profile_id == null &&
      portionsOf(sheetFacts)[0]?.batten_width_mm === 50 &&
      portionsOf(sheetFacts)[0]?.specialist_kind === "custom_profile"
  );

  const siblingBefore = portionsOf(facts)[1];
  facts = write(facts, "cladding.portion.label", "North elevation", added[1]?.id);
  check(
    "20. a field edit changes only the targeted section",
    portionsOf(facts)[1]?.label === "North elevation" &&
      portionsOf(facts)[1]?.label_authority === "user" &&
      portionsOf(facts)[0]?.label == null &&
      portionsOf(facts)[1]?.id === siblingBefore?.id
  );
  facts = write(facts, "cladding.portion.cladding_system", "not-a-system", added[1]?.id);
  check(
    "21. an unknown system write does not coerce or wipe the section",
    portionsOf(facts)[1]?.cladding_system == null &&
      portionsOf(facts)[1]?.label === "North elevation"
  );
  facts = write(facts, "cladding.portion.direct_area_m2", 0, added[1]?.id);
  facts = write(facts, "cladding.portion.length_m", Number.POSITIVE_INFINITY, added[1]?.id);
  check(
    "22. zero and non-finite measurements do not become quantities",
    portionsOf(facts)[1]?.direct_area_m2 == null &&
      portionsOf(facts)[1]?.length_m == null
  );
  facts = write(facts, "cladding.portion.length_m", 8.2, added[1]?.id);
  check("23. a positive custom measurement is retained", portionsOf(facts)[1]?.length_m === 8.2);

  const sourceFacts: EstimateFact[] = facts.map((row) =>
    row.key === CLADDING_PORTIONS_FACT_KEY ? { ...row, source: "ai_extracted" } : row
  );
  const edited = applyCladdingFactWrite({
    facts: sourceFacts,
    workAreaId: "c1",
    key: "cladding.portion.height_m",
    value: 2.4,
    nestedItemId: added[1]?.id,
  });
  check(
    "24. a nested edit preserves the prior collection source",
    edited.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.source === "ai_extracted" &&
      claddingPortionsFactSourceForWrite({ previousSource: "ai_extracted" }) === "ai_extracted"
  );
  check(
    "25. sibling authority is unchanged by that edit",
    storedCladdingPortions(edited, "c1")[0]?.effective_cover_mm === 111 &&
      storedCladdingPortions(edited, "c1")[0]?.height_m == null &&
      storedCladdingPortions(edited, "c1")[1]?.height_authority === "user" &&
      storedCladdingPortions(edited, "c1")[1]?.height_m === 2.4
  );

  const active = edited.find((row) => row.key === CLADDING_ACTIVE_PORTION_ID_FACT_KEY)?.value;
  const duplicated = write(edited, CLADDING_DUPLICATE_PORTION_KEY, added[1]?.id);
  const copies = portionsOf(duplicated);
  check(
    "26. Duplicate copies specification under a new id",
    copies.length === 3 &&
      copies.filter((row) => row.label === "North elevation").length === 2 &&
      new Set(copies.map((row) => row.id)).size === 3 &&
      copies.some((row) => row.id !== added[1]?.id && row.length_m === 8.2 && row.height_m === 2.4)
  );
  const deleted = write(duplicated, CLADDING_DELETE_PORTION_KEY, String(active));
  check(
    "27. Delete removes only the targeted section and keeps a sibling active",
    portionsOf(deleted).length === 2 &&
      !portionsOf(deleted).some((row) => row.id === active) &&
      deleted.some((row) => row.key === CLADDING_ACTIVE_PORTION_ID_FACT_KEY) &&
      deleted.every((row) => row.key === CLADDING_PORTIONS_FACT_KEY || row.key === CLADDING_ACTIVE_PORTION_ID_FACT_KEY)
  );

  const envelope = nextCladdingCollectionEnvelope({ v: 4, portions: [] }, portionsOf(deleted));
  check("28. collection version increments", envelope.v === 5 && envelope.portions.length === 2);
  check(
    "29. a stale CAS version is rejected",
    rejectStaleCladdingCas({ v: 4, portions: [] }, 3) &&
      !rejectStaleCladdingCas({ v: 4, portions: [] }, 4)
  );
  check(
    "30. persistence writes the envelope and the version filter",
    read("lib/assistant/scope-persistence.ts").includes("nextCladdingCollectionEnvelope") &&
      read("lib/assistant/scope-persistence.ts").includes("\"value->>v\"") &&
      read("lib/assistant/scope-persistence.ts").includes("Cladding sections")
  );

  const persistedUser = [
    {
      ...createEmptyCladdingPortion({ id: "keep-me" }),
      label: "User north",
      label_authority: "user" as const,
      clause_ordinal: 0,
      cladding_system: "timber_rusticated" as const,
      system_authority: "extracted" as const,
    },
  ];
  const extractedUpdate = [
    {
      ...createEmptyCladdingPortion({ id: "keep-me" }),
      label: "Machine north",
      cladding_system: "timber_bevelback" as const,
      clause_ordinal: 0,
    },
  ];
  const mergedUser = mergePersistedCladdingPortionsOnReanalyse({
    extracted: extractedUpdate,
    persisted: persistedUser,
  });
  check(
    "31. user-owned fields survive re-analysis and machine fields can update",
    mergedUser.length === 1 &&
      mergedUser[0]?.label === "User north" &&
      mergedUser[0]?.label_authority === "user" &&
      mergedUser[0]?.cladding_system === "timber_bevelback"
  );
  const again = mergePersistedCladdingPortionsOnReanalyse({
    extracted: extractedUpdate,
    persisted: mergedUser,
  });
  check(
    "32. re-analysis is idempotent",
    JSON.stringify(again) === JSON.stringify(mergedUser)
  );

  const twoExtracted = [
    { ...createEmptyCladdingPortion({ id: "e1" }), label: "North", clause_ordinal: 0, cladding_system: "timber_bevelback" as const },
    { ...createEmptyCladdingPortion({ id: "e2" }), label: "South", clause_ordinal: 1, cladding_system: "timber_rusticated" as const },
  ];
  const deletedOne = [twoExtracted[0]];
  const preserved = mergePersistedCladdingPortionsOnReanalyse({
    extracted: twoExtracted,
    persisted: deletedOne,
  });
  check(
    "33. an intentional deletion is not recreated",
    preserved.length === 1 && preserved[0]?.label === "North"
  );
  const identicalPersisted = [
    { ...createEmptyCladdingPortion({ id: "a" }), label: "Same", cladding_system: "timber_bevelback" as const, clause_ordinal: 0 },
    { ...createEmptyCladdingPortion({ id: "b" }), label: "Same", cladding_system: "timber_bevelback" as const, clause_ordinal: 1 },
  ];
  const identicalExtracted = [
    { ...createEmptyCladdingPortion({ id: "x" }), label: "Same", cladding_system: "timber_bevelback" as const, clause_ordinal: 0 },
    { ...createEmptyCladdingPortion({ id: "y" }), label: "Same", cladding_system: "timber_bevelback" as const, clause_ordinal: 1 },
  ];
  const distinct = mergePersistedCladdingPortionsOnReanalyse({
    extracted: identicalExtracted,
    persisted: identicalPersisted,
  });
  check(
    "34. identical sections stay distinct and match by clause ordinal",
    distinct.length === 2 && distinct[0]?.id === "a" && distinct[1]?.id === "b"
  );
  const hybridPersisted = [
    {
      ...createEmptyCladdingPortion({ id: "hybrid" }),
      label: "South",
      cladding_system: "timber_bevelback" as const,
    },
  ];
  const hybridExtracted = [
    { ...createEmptyCladdingPortion({ id: "n1" }), label: "North", cladding_system: "timber_bevelback" as const },
    { ...createEmptyCladdingPortion({ id: "n2" }), label: "South", cladding_system: "timber_rusticated" as const },
  ];
  const repaired = mergePersistedCladdingPortionsOnReanalyse({
    extracted: hybridExtracted,
    persisted: hybridPersisted,
  });
  check(
    "35. a machine-owned incompatible hybrid is replaced and keeps the leading id",
    repaired.length === 2 && repaired[0]?.id === "hybrid" && repaired[0]?.label === "North"
  );
  const userHybrid = [
    {
      ...hybridPersisted[0],
      label_authority: "user" as const,
      system_authority: "user" as const,
    },
  ];
  const notSplit = mergePersistedCladdingPortionsOnReanalyse({
    extracted: hybridExtracted,
    persisted: userHybrid,
  });
  check(
    "36. a user-owned hybrid is not auto-split",
    notSplit.length === 1 && notSplit[0]?.label === "South" && notSplit[0]?.cladding_system === "timber_bevelback"
  );

  const positives = [
    "install timber cladding",
    "replace weatherboards",
    "reclad the north elevation",
    "install fibre-cement weatherboards",
    "install Linea weatherboard",
    "brick veneer cladding",
    "masonry veneer",
    "exterior timber feature cladding",
  ];
  check(
    "37. positive cladding phrases are owned by Cladding and create no portions",
    positives.every((phrase) => {
      const decision = classifyCladdingOwnership(phrase);
      return decision.claddingPresent && decision.portions.length === 0 && decision.unrelatedWorkAreas.length === 0;
    })
  );
  check(
    "38. Linea is fibre-cement recognition and brick/masonry stay specialist families",
    classifyCladdingOwnership("install Linea weatherboard").recognisedFamily === "fibre_cement" &&
      classifyCladdingOwnership("brick veneer cladding").recognisedFamily === "brick_veneer" &&
      classifyCladdingOwnership("masonry veneer").recognisedFamily === "masonry"
  );
  const negatives = [
    "cladding by others",
    "existing cladding retained",
    "no cladding work",
    "exclude cladding",
    "cladding not included",
  ];
  check(
    "39. explicit negative phrases suppress Cladding",
    negatives.every((phrase) => {
      const decision = classifyCladdingOwnership(phrase);
      return !decision.claddingPresent && decision.suppressed && decision.recommendedScopeIntent === "suppressed";
    })
  );
  check(
    "40. replace/reclad exposes connected removal and removal-only stays Cladding",
    classifyCladdingOwnership("replace weatherboards").connectedRemoval &&
      classifyCladdingOwnership("reclad the north elevation").connectedRemoval &&
      classifyCladdingOwnership("remove existing cladding only").removalOnly &&
      classifyCladdingOwnership("remove existing cladding only").claddingPresent
  );
  check(
    "41. wider demolition owns the package unless new cladding is independent",
    classifyCladdingOwnership("strip out the house including cladding removal").widerDemolitionOwnsPackage &&
      !classifyCladdingOwnership("strip out the house including cladding removal").claddingPresent &&
      classifyCladdingOwnership("strip out and install new weatherboards").claddingPresent
  );
  const painted = classifyCladdingOwnership("paint new weatherboards and install cladding");
  check(
    "42. painting coexists with Cladding",
    painted.claddingPresent && painted.paintingCoexists
  );
  const windows = classifyCladdingOwnership("replace windows while recladding");
  check(
    "43. window replacement stays outside Doors and does not create Joinery",
    windows.claddingPresent &&
      windows.routeWindowsToDoors === false &&
      windows.createsJoineryCalculator === false &&
      CLADDING_JOINERY_INSTALL_BOUNDARY.includes("does not route windows into Doors")
  );
  const opening = classifyCladdingOwnership("form an external opening and install cladding");
  check(
    "44. external opening language does not mutate Internal Walls or Doors",
    opening.claddingPresent &&
      opening.mutatesInternalWalls === false &&
      opening.mutatesDoors === false
  );
  check(
    "45. a north elevation does not create Bathroom, Kitchen or Flooring",
    classifyCladdingOwnership("reclad the north elevation").unrelatedWorkAreas.length === 0 &&
      classifyCladdingOwnership("install timber cladding in the bathroom").unrelatedWorkAreas.length === 0
  );

  const staged = calculateCladding(
    { ...baseContext, facts: [], confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }] },
    { id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }
  );
  check(
    "46. staged calculator emits no line items and no default area",
    staged.lineItems.length === 0 &&
      staged.missingInfo.includes(CLADDING_STAGED_NOT_CALCULATED_MESSAGE) &&
      staged.assumptions.length === 0
  );
  const mixed = calculateEstimate({
    ...baseContext,
    confirmedWorkAreas: [
      { id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1 },
      { id: "c1", type: "cladding", name: "Cladding", sort_order: 2 },
    ] as EstimateWorkArea[],
    facts: [{ key: "bathroom.floor_area_m2", work_area_id: "b1", value: 8, source: "user" } as EstimateFact],
  });
  check(
    "47. Bathroom still calculates and Cladding adds no priced row",
    mixed.lineItems.some((row) => row.workAreaId === "b1") &&
      !mixed.lineItems.some((row) => row.workAreaId === "c1") &&
      mixed.missingInfo.includes(CLADDING_STAGED_NOT_CALCULATED_MESSAGE)
  );
  const quote = buildWorkAreaQuoteDescriptionDraft({
    type: "cladding",
    name: "Cladding",
    facts: [
      {
        key: "cladding.portions",
        label: "Cladding sections",
        value: "[{\"cladding_system\":\"timber_bevelback\"}]",
      },
    ],
  });
  check(
    "48. Quote serialisation does not emit cladding scope or raw JSON",
    quote === "" &&
      !quote.includes("timber_bevelback") &&
      !quote.includes("{")
  );

  const domainSource = [
    "lib/estimate/cladding-portions.ts",
    "lib/estimate/cladding-profiles.ts",
    "lib/estimate/calculators/cladding.ts",
    "lib/work-areas/cladding-ownership.ts",
  ]
    .map(read)
    .join("\n");
  const forbidden = [
    "painting.material.m2",
    "painting.labour_hours_per_m2",
    "paint.litre",
    "painting.door.each",
    "painting.trim.lm",
    "demolition.labour_hours_per_m2",
    "demolition.wall.lm",
    "demolition.disposal.allowance",
    "deck.decking.install.hours_per_lm",
    "fence.board.vertical.hours_per_lm",
    "timber.lining.profile.lm",
    "sheet.fibre_cement.18mm.2400x1200.each",
    "retaining_wall.masonry",
    "scope.cladding.m2",
    "CCS-035",
    "CCS-047",
  ];
  check(
    "49. domain modules do not alias cross-work-area money",
    forbidden.every((token) => !domainSource.includes(token))
  );
  check(
    "50. there is no generic cladding square-metre lump",
    !domainSource.includes("scope.cladding.m2") &&
      !read("lib/estimate/calculate-estimate.ts").includes("scope.cladding.m2")
  );
  check(
    "51. Flooring and Doors remain human-QA frozen and L5-closeable",
    FLOORING_V1_HUMAN_QA_FROZEN === true &&
      DOORS_V1_HUMAN_QA_FROZEN === true &&
      workAreaMayCloseAtL5(verifyRegisteredWorkAreaBenchmarkCoverage("flooring")) &&
      workAreaMayCloseAtL5(verifyRegisteredWorkAreaBenchmarkCoverage("doors"))
  );
  check(
    "52. duplicate stored ids collapse to the first row",
    storedCladdingPortions(
      [
        {
          key: CLADDING_PORTIONS_FACT_KEY,
          work_area_id: "c1",
          value: [
            { id: "dup", label: "First" },
            { id: "dup", label: "Second" },
          ],
        },
      ],
      "c1"
    ).length === 1 &&
      storedCladdingPortions(
        [
          {
            key: CLADDING_PORTIONS_FACT_KEY,
            work_area_id: "c1",
            value: [
              { id: "dup", label: "First" },
              { id: "dup", label: "Second" },
            ],
          },
        ],
        "c1"
      )[0]?.label === "First"
  );
  check(
    "53. scalar sibling keys are not portion writes",
    !isCladdingPortionWriteKey("cladding.area_m2") &&
      !isCladdingPortionWriteKey("scope.cladding.m2")
  );
  check(
    "54. job-plan overlay routes cladding logical keys onto the collection",
    read("lib/assistant/job-plan/facts.ts").includes("isCladdingPortionWriteKey") &&
      read("lib/assistant/refine/compose.ts").includes("isCladdingPortionWriteKey")
  );
  check(
    "55. brick family clears an ordinary profile binding",
    (() => {
      const seeded = write([], CLADDING_ADD_PORTION_KEY, true);
      const id = portionsOf(seeded)[0]?.id ?? "";
      const profiled = write(
        seeded,
        "cladding.portion.approved_profile",
        "timber_bevelback_187x18",
        id
      );
      const brick = portionsOf(
        write(profiled, "cladding.portion.cladding_family", "brick_veneer", id)
      )[0];
      return (
        portionsOf(profiled)[0]?.approved_profile_id === "timber_bevelback_187x18" &&
        brick?.cladding_family === "brick_veneer" &&
        brick.cladding_system === "specialist_unresolved" &&
        brick.approved_profile_id == null
      );
    })()
  );
  check(
    "56. active pointer follows the newest added section",
    facts.length >= 0 &&
      duplicated.find((row) => row.key === CLADDING_ACTIVE_PORTION_ID_FACT_KEY)?.value ===
        copies[copies.length - 1]?.id
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
