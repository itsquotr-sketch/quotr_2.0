/**
 * FLOORING-02 — nested extraction, ownership, Details, and Ready.
 *
 * Run: npx --yes tsx scripts/verify-flooring-02-extraction-details.ts
 *
 * No paid AI. No Production. No takeoff / money / productivity.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { flooringPortionQuestionIdentity } from "../lib/assistant/question-identity";
import { BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY } from "../lib/estimate/bathroom-identities";
import {
  mergeFlooringPortionsPreferringDeterministic,
} from "../lib/estimate/flooring-brief";
import {
  flooringPortionIsInformationComplete,
  flooringWorkAreaIsReady,
  listFlooringClarifyCandidates,
  summariseFlooringPortion,
} from "../lib/estimate/flooring-clarify";
import { FLOORING_INFORMATION_CONTRACT } from "../lib/estimate/flooring-information-contract";
import {
  calculateDoors,
  calculateFlooring,
} from "../lib/estimate/calculators/fitout";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import {
  applyFlooringFactWrite,
  createEmptyFlooringPortion,
  FLOORING_ADD_PORTION_KEY,
  FLOORING_DELETE_PORTION_KEY,
  FLOORING_DUPLICATE_PORTION_KEY,
  FLOORING_NESTED_NOT_CALCULATED_MESSAGE,
  FLOORING_PORTIONS_FACT_KEY,
  mergePersistedFlooringPortionsOnReanalyse,
  parseFlooringPortions,
  storedFlooringPortions,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import { applyDoorsFactWrite, DOORS_PORTIONS_FACT_KEY } from "../lib/estimate/doors-portions";
import type { EstimateContext, EstimateFact } from "../lib/estimate/types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

const allowed = getAnalysisCapableWorkAreaTypes();

function extract(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: allowed,
  }).extraction;
}

function typesOf(brief: string): string[] {
  return extract(brief).workAreas.map((row) => row.type);
}

function portionsOf(brief: string): FlooringPortion[] {
  const extraction = extract(brief);
  const fact = extraction.facts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY);
  return parseFlooringPortions(fact?.value);
}

function writeFlooring(
  facts: readonly EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId?: string | null,
  factSource?: string | null
): EstimateFact[] {
  return applyFlooringFactWrite({
    facts,
    workAreaId: "f1",
    key,
    value,
    nestedItemId,
    factSource,
  });
}

function persistPortions(portions: readonly FlooringPortion[]): EstimateFact[] {
  return writeFlooring([], FLOORING_PORTIONS_FACT_KEY, [...portions], null, "ai_extracted");
}

const WA = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  status: "confirmed" as const,
  sort_order: 1,
};

function clarify(facts: EstimateFact[], brief = "") {
  const plan = composeJobPlan({
    workAreas: [WA],
    facts,
    qualityLevel: "standard",
    briefText: brief,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: brief,
    qualityLevel: "standard",
    workAreas: [WA],
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [WA],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

const TWO_AREA =
  "Supply and install 24 m² of carpet with new underlay to the bedrooms. Also install 20 m² of vinyl plank flooring to the living room with floor preparation. Existing substrates and framing are to remain, and no flooring removal is required.";

function completeOrdinary(
  source: FlooringPortion,
  patch: Partial<FlooringPortion> = {}
): FlooringPortion {
  return {
    ...source,
    finish_type: source.finish_type ?? "carpet",
    area_input_method: source.area_input_method ?? "direct_m2",
    area_m2: source.area_m2 ?? 12,
    underlay_required:
      (source.finish_type ?? "carpet") === "carpet"
        ? (source.underlay_required ?? true)
        : source.underlay_required,
    floor_preparation_required:
      source.finish_type === "vinyl_plank" || source.finish_type === "tile"
        ? (source.floor_preparation_required ?? false)
        : source.floor_preparation_required,
    tile_width_mm: source.finish_type === "tile" ? (source.tile_width_mm ?? 600) : source.tile_width_mm,
    tile_length_mm: source.finish_type === "tile" ? (source.tile_length_mm ?? 600) : source.tile_length_mm,
    hardwood_board_width_mm:
      source.finish_type === "hardwood"
        ? (source.hardwood_board_width_mm ?? 186)
        : source.hardwood_board_width_mm,
    other_description:
      source.finish_type === "other"
        ? (source.other_description ?? "Custom cork-look vinyl")
        : source.other_description,
    substrate_required: source.substrate_required ?? false,
    framing_required: source.framing_required ?? false,
    finish_removal_required: source.finish_removal_required ?? false,
    ...patch,
  };
}

console.log("\n=== A. Ownership ===\n");
check("1. carpet in bedrooms → Flooring only", (() => {
  const types = typesOf("carpet in the bedrooms");
  return types.includes("flooring") && !types.includes("bathroom") && !types.includes("kitchen") && !types.includes("demolition");
})());
check("2. vinyl flooring in bathroom → Flooring only", (() => {
  const types = typesOf("vinyl flooring in the bathroom");
  return types.includes("flooring") && !types.includes("bathroom");
})());
check("3. tile the ensuite floor → Flooring only", (() => {
  const types = typesOf("tile the ensuite floor");
  return types.includes("flooring") && !types.includes("bathroom");
})());
check("4. timber flooring in kitchen → Flooring only", (() => {
  const types = typesOf("timber flooring in the kitchen");
  return types.includes("flooring") && !types.includes("kitchen");
})());
check("5. Bathroom reno including floor → Bathroom, no Flooring", (() => {
  const types = typesOf("renovate the bathroom, including tiled floor");
  return types.includes("bathroom") && !types.includes("flooring");
})());
check("6. independent Bathroom + Flooring elsewhere", (() => {
  const types = typesOf(
    "renovate the bathroom. Also install 20 m² of vinyl plank flooring to the living room"
  );
  return types.includes("bathroom") && types.includes("flooring");
})());
check("7. Kitchen reno including floor → Kitchen, no Flooring", (() => {
  const types = typesOf("renovate the kitchen including new flooring");
  return types.includes("kitchen") && !types.includes("flooring");
})());
check("8. Kitchen + separate bedroom carpet", (() => {
  const types = typesOf("install kitchen cabinetry and lay carpet in the bedrooms");
  return types.includes("kitchen") && types.includes("flooring");
})());
check("9. connected removal + new Flooring → Flooring accessory", (() => {
  const types = typesOf("remove existing carpet and install 24 m² of vinyl plank");
  return types.includes("flooring") && !types.includes("demolition");
})());
check("10. standalone wider strip-out → Demolition, no Flooring", (() => {
  const types = typesOf("demolition of house internal walls and flooring");
  return types.includes("demolition") && !types.includes("flooring");
})());

console.log("\n=== B. Extraction synonyms ===\n");
check("11. carpet", portionsOf("install carpet in the bedrooms")[0]?.finish_type === "carpet");
check("12. vinyl plank", portionsOf("install vinyl plank flooring")[0]?.finish_type === "vinyl_plank");
check("13. LVT", portionsOf("lay LVT in the living room")[0]?.finish_type === "vinyl_plank");
check("14. luxury vinyl tile", portionsOf("install luxury vinyl tile")[0]?.finish_type === "vinyl_plank");
check("15. slat vinyl", portionsOf("lay slat vinyl")[0]?.finish_type === "vinyl_plank");
check("16. floor tile", portionsOf("install floor tiles to the entry")[0]?.finish_type === "tile");
check("17. hardwood flooring", portionsOf("install hardwood flooring")[0]?.finish_type === "hardwood");
check("18. timber floorboards", portionsOf("lay timber floorboards")[0]?.finish_type === "hardwood");
check("19. sheet vinyl not coerced", (() => {
  const row = portionsOf("install sheet vinyl flooring")[0];
  return row?.finish_type === "other" && row.specialist_kind === "sheet_vinyl";
})());
check("20. laminate not coerced", (() => {
  const row = portionsOf("install laminate flooring")[0];
  return row?.finish_type === "other" && row.specialist_kind === "laminate";
})());
check("21. specialist pattern not coerced", (() => {
  const row = portionsOf("install herringbone flooring")[0];
  return row?.finish_type === "other" && row.specialist_kind === "other_unsupported";
})());

console.log("\n=== C. Area parsing ===\n");
check("22. direct m²", (() => {
  const row = portionsOf("install 24 m² of carpet")[0];
  return row?.area_m2 === 24 && row.area_input_method === "direct_m2";
})());
check("23. length × width", (() => {
  const row = portionsOf("install carpet 5m × 4m")[0];
  return row?.length_m === 5 && row.width_m === 4 && row.area_input_method === "length_width";
})());
check("24. dimensions do not overwrite direct area", (() => {
  const row = portionsOf("install 24 m² of carpet 5 m by 4 m")[0];
  return row?.area_m2 === 24 && row.area_input_method === "direct_m2";
})());
check("25. tile dimensions are not room dimensions", (() => {
  const row = portionsOf("install 600 × 600 mm floor tiles to the entry")[0];
  return row?.length_m == null && row?.width_m == null && row?.tile_width_mm === 600;
})());
check("26. board width is not room width", (() => {
  const row = portionsOf("install 186 mm wide hardwood flooring")[0];
  return row?.width_m == null && row?.hardwood_board_width_mm === 186;
})());
check("27. substrate sheet dimensions are not room dimensions", (() => {
  const row = portionsOf("replace the floor substrate with 19 mm H3.2 plywood 2400 × 1200 and install carpet")[0];
  return row?.length_m == null && row?.width_m == null && row?.area_m2 == null;
})());
check("28. omitted area remains unanswered", portionsOf("install carpet in the bedrooms")[0]?.area_m2 == null);

console.log("\n=== D. Multiple areas ===\n");
const two = portionsOf(TWO_AREA);
check("29. exact two-area fixture produces two portions", two.length === 2, String(two.length));
check("30. clause-local labels", two[0]?.label === "Bedrooms" && two[1]?.label === "Living room");
check("31. clause-local quantities", two[0]?.area_m2 === 24 && two[1]?.area_m2 === 20);
const hybridAi: FlooringPortion = {
  ...createEmptyFlooringPortion({ label: "Whole house" }),
  finish_type: "carpet",
  area_m2: 44,
  area_input_method: "direct_m2",
};
const mergedDet = mergeFlooringPortionsPreferringDeterministic([hybridAi], two);
check("32. no hybrid AI collapse", mergedDet.length === 2 && mergedDet[0]?.label === "Bedrooms" && mergedDet[1]?.label === "Living room");
const persistedTwo = persistPortions(two);
const again = mergePersistedFlooringPortionsOnReanalyse({
  extracted: portionsOf(TWO_AREA),
  persisted: storedFlooringPortions(persistedTwo, "f1"),
});
check("33. stable IDs through re-analysis", again.length === 2 && again[0]?.id === storedFlooringPortions(persistedTwo, "f1")[0]?.id && again[1]?.id === storedFlooringPortions(persistedTwo, "f1")[1]?.id);
check("34. idempotent extraction", JSON.stringify(two.map((row) => [row.label, row.finish_type, row.area_m2])) === JSON.stringify(portionsOf(TWO_AREA).map((row) => [row.label, row.finish_type, row.area_m2])));
check("35. identical independent areas remain distinct", portionsOf("install 10 m² of carpet. Also install 10 m² of carpet").length === 2);

console.log("\n=== E. Finish branches ===\n");
check("36. carpet underlay Yes", portionsOf("install carpet with new underlay")[0]?.underlay_required === true);
check("37. carpet underlay No", portionsOf("install carpet without underlay")[0]?.underlay_required === false);
check("38. carpet omitted remains null", portionsOf("install carpet in the bedrooms")[0]?.underlay_required == null);
check("39. vinyl preparation Yes/No/null", (() => {
  const yes = portionsOf("install vinyl plank with floor preparation")[0]?.floor_preparation_required;
  const no = portionsOf("install vinyl plank with no floor preparation")[0]?.floor_preparation_required;
  const omitted = portionsOf("install vinyl plank flooring")[0]?.floor_preparation_required;
  return yes === true && no === false && omitted == null;
})());
check("40. tile dimensions and prep", (() => {
  const row = portionsOf("install 600 × 600 mm floor tiles including floor preparation")[0];
  return row?.tile_width_mm === 600 && row.tile_length_mm === 600 && row.floor_preparation_required === true;
})());
check("41. custom positive tile dimensions", (() => {
  const row = portionsOf("install 450 × 900 mm floor tiles")[0];
  return row?.tile_width_mm === 450 && row.tile_length_mm === 900;
})());
check("42. hardwood standard width", portionsOf("install 186 mm wide hardwood flooring")[0]?.hardwood_board_width_mm === 186);
check("43. hardwood custom positive width", portionsOf("install 210 mm wide hardwood flooring")[0]?.hardwood_board_width_mm === 210);
check("44. other/custom description", (() => {
  const row = portionsOf("install cork flooring to the study")[0];
  return row?.finish_type === "other" && Boolean(row.other_description?.trim());
})());
let machineFinish = persistPortions(portionsOf("install carpet with new underlay"));
const machineId = storedFlooringPortions(machineFinish, "f1")[0]!.id;
machineFinish = writeFlooring(machineFinish, "flooring.portion.finish_type", "tile", machineId);
check("45. incompatible machine-owned fields safely clear", storedFlooringPortions(machineFinish, "f1")[0]?.underlay_required == null);
let userFinish = persistPortions(portionsOf("install carpet"));
const userId = storedFlooringPortions(userFinish, "f1")[0]!.id;
userFinish = writeFlooring(userFinish, "flooring.portion.underlay_required", "Yes", userId);
const userUnderlay = storedFlooringPortions(userFinish, "f1")[0];
const reUser = mergePersistedFlooringPortionsOnReanalyse({
  extracted: portionsOf("install vinyl plank flooring"),
  persisted: [userUnderlay!],
});
check("46. user-owned fields survive finish change/re-analysis", reUser[0]?.underlay_required === true && reUser[0]?.underlay_authority === "user");

console.log("\n=== F. Substrate/framing/removal ===\n");
check("47. substrate explicit No", two[0]?.substrate_required === false && two[1]?.substrate_required === false);
check("48. substrate family without exact product", (() => {
  const row = portionsOf("install carpet with new particleboard flooring")[0];
  return row?.substrate_family === "particleboard" && row.substrate_item_key == null && row.substrate_required === true;
})());
check("49. exact existing substrate identity retained", (() => {
  const row = portionsOf("replace the floor substrate with 19 mm H3.2 plywood and install carpet")[0];
  return row?.substrate_item_key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY;
})());
check("50. no invented product key", (() => {
  const row = portionsOf("install carpet with new 22 mm particleboard flooring")[0];
  return row?.substrate_family === "particleboard" && row.substrate_item_key == null;
})());
check("51. framing No", two[0]?.framing_required === false);
check("52. framing Yes + level", (() => {
  const row = portionsOf("install carpet including standard subfloor framing allowance")[0];
  return row?.framing_required === true && row.framing_allowance_level === "standard";
})());
check("53. framing Yes without level remains unanswered", (() => {
  const row = portionsOf("install carpet with new subfloor framing")[0];
  return row?.framing_required === true && row.framing_allowance_level == null;
})());
check("54. finish removal Yes + type", (() => {
  const row = portionsOf("remove existing carpet and install vinyl plank")[0];
  return row?.finish_removal_required === true && row.existing_finish_type === "carpet";
})());
check("55. finish removal Yes without type remains unanswered", (() => {
  const row = portionsOf("remove existing floor finish and install carpet")[0];
  return row?.finish_removal_required === true && row.existing_finish_type == null;
})());
check("56. substrate removal conditional", (() => {
  const row = portionsOf("remove existing carpet and remove existing floor substrate then install vinyl plank")[0];
  return row?.finish_removal_required === true && row.substrate_removal_required === true;
})());
check("57. replacement does not silently imply priced removal", (() => {
  const row = portionsOf("replace the floor substrate with new plywood flooring and install carpet")[0];
  return row?.substrate_required === true && row.finish_removal_required !== true && row.substrate_removal_required !== true;
})());
check("58. disposal not introduced", !JSON.stringify(two).includes("disposal") && !extract(TWO_AREA).facts.some((row) => row.key.includes("disposal")));

console.log("\n=== G. Details/readiness ===\n");
const incompleteFacts = persistPortions(two);
const order = listFlooringClarifyCandidates({
  facts: incompleteFacts,
  workAreaId: "f1",
  workAreaName: "Flooring",
}).filter((row) => row.nestedItemId === storedFlooringPortions(incompleteFacts, "f1")[0]?.id);
const expectedOrder = FLOORING_INFORMATION_CONTRACT.map((row) => row.factKey).filter((key) =>
  order.some((row) => row.factKey === key)
);
check("59. exact question order", order.map((row) => row.factKey).join("|") === expectedOrder.join("|"), order.map((row) => row.factKey).join("|"));
check("60. conditional questions only", !order.some((row) => row.factKey === "flooring.portion.tile_width_mm") && !order.some((row) => row.factKey === "flooring.portion.substrate_family"));
const unlabeledIncomplete = persistPortions(portionsOf("install carpet"));
const unlabeledView = clarify(unlabeledIncomplete, "install carpet");
const unlabeledReady = flooringWorkAreaIsReady({
  facts: unlabeledIncomplete,
  workAreaId: "f1",
  workAreaName: "Flooring",
});
const unlabeledComplete = completeOrdinary(storedFlooringPortions(unlabeledIncomplete, "f1")[0]!, { label: null });
check(
  "61. optional location does not block",
  unlabeledView.candidates
    .filter((row) => row.factKey === "flooring.portion.label")
    .every((row) => !row.blocksEstimate) &&
    !unlabeledReady &&
    flooringPortionIsInformationComplete(unlabeledComplete)
);
check("62. area absence blocks", !flooringPortionIsInformationComplete(portionsOf("install carpet in the bedrooms")[0]!));
const carpetComplete = completeOrdinary(two[0]!, { finish_type: "carpet", underlay_required: true });
check("63. carpet completeness", flooringPortionIsInformationComplete(carpetComplete));
const vinylComplete = completeOrdinary(two[1]!, { finish_type: "vinyl_plank", floor_preparation_required: true });
check("64. vinyl completeness", flooringPortionIsInformationComplete(vinylComplete));
check("65. tile completeness", flooringPortionIsInformationComplete(completeOrdinary(createEmptyFlooringPortion({ label: "Entry" }), { finish_type: "tile", tile_width_mm: 600, tile_length_mm: 600, floor_preparation_required: false })));
check("66. hardwood completeness", flooringPortionIsInformationComplete(completeOrdinary(createEmptyFlooringPortion({ label: "Hallway" }), { finish_type: "hardwood", hardwood_board_width_mm: 186 })));
check("67. substrate conditional completeness", !flooringPortionIsInformationComplete(completeOrdinary(createEmptyFlooringPortion(), { substrate_required: true, substrate_family: "particleboard", substrate_item_key: null })) && flooringPortionIsInformationComplete(completeOrdinary(createEmptyFlooringPortion(), { substrate_required: true, substrate_family: "structural_plywood", substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY })));
check("68. framing conditional completeness", !flooringPortionIsInformationComplete(completeOrdinary(createEmptyFlooringPortion(), { framing_required: true, framing_allowance_level: null })) && flooringPortionIsInformationComplete(completeOrdinary(createEmptyFlooringPortion(), { framing_required: true, framing_allowance_level: "minor" })));
check("69. removal conditional completeness", !flooringPortionIsInformationComplete(completeOrdinary(createEmptyFlooringPortion(), { finish_removal_required: true, existing_finish_type: null })) && flooringPortionIsInformationComplete(completeOrdinary(createEmptyFlooringPortion(), { finish_removal_required: true, existing_finish_type: "carpet", substrate_removal_required: false })));
const mixedFacts = persistPortions([carpetComplete, createEmptyFlooringPortion({ label: "Spare" })]);
const mixedCandidates = listFlooringClarifyCandidates({ facts: mixedFacts, workAreaId: "f1", workAreaName: "Flooring" });
const completeId = storedFlooringPortions(mixedFacts, "f1")[0]!.id;
check("70. incomplete sibling does not suppress complete sibling", mixedCandidates.some((row) => row.nestedItemId !== completeId) && summariseFlooringPortion(storedFlooringPortions(mixedFacts, "f1")[0]!, 0).complete);
let crud = persistPortions([createEmptyFlooringPortion({ label: "One" })]);
crud = writeFlooring(crud, FLOORING_ADD_PORTION_KEY, true);
const afterAdd = storedFlooringPortions(crud, "f1");
crud = writeFlooring(crud, FLOORING_DUPLICATE_PORTION_KEY, afterAdd[0]?.id);
const afterDup = storedFlooringPortions(crud, "f1");
crud = writeFlooring(
  crud,
  FLOORING_DELETE_PORTION_KEY,
  afterDup[afterDup.length - 1]?.id
);
check("71. Add/Duplicate/Delete", afterAdd.length === 2 && afterDup.length === 3 && storedFlooringPortions(crud, "f1").length === 2);
const identity = flooringPortionQuestionIdentity({ workAreaId: "f1", factKey: "flooring.portion.finish_type", nestedItemId: completeId });
check("72. nested identities include portion ID", identity.nestedItemId === completeId);
check("73. no scalar sibling facts", !mixedFacts.some((row) => row.key === "flooring.area_m2" || row.key === "flooring.type"));
check("74. no defaults invented", createEmptyFlooringPortion().underlay_required == null && createEmptyFlooringPortion().area_m2 == null && createEmptyFlooringPortion().finish_type == null);

console.log("\n=== H. Re-analysis/deletion ===\n");
let userPreserve = persistPortions(two);
userPreserve = writeFlooring(userPreserve, "flooring.portion.label", "Kids rooms", storedFlooringPortions(userPreserve, "f1")[0]?.id);
const preserved = mergePersistedFlooringPortionsOnReanalyse({
  extracted: portionsOf(TWO_AREA),
  persisted: storedFlooringPortions(userPreserve, "f1"),
});
check("75. user-owned fields preserved", preserved[0]?.label === "Kids rooms" && preserved[0]?.label_authority === "user");
const machineUpdate = mergePersistedFlooringPortionsOnReanalyse({
  extracted: portionsOf(TWO_AREA.replace("24 m²", "26 m²")),
  persisted: storedFlooringPortions(persistedTwo, "f1"),
});
check("76. machine fields may update", machineUpdate[0]?.area_m2 === 26);
const hybridMachine = persistPortions([{
  ...createEmptyFlooringPortion({ label: "Whole house" }),
  finish_type: "carpet",
  area_m2: 44,
  area_input_method: "direct_m2",
}]);
const repaired = mergePersistedFlooringPortionsOnReanalyse({
  extracted: two,
  persisted: storedFlooringPortions(hybridMachine, "f1"),
});
check("77. stale machine hybrid safely repairs", repaired.length === 2 && repaired[0]?.label === "Bedrooms");
const userHybrid = storedFlooringPortions(hybridMachine, "f1")[0]!;
userHybrid.label_authority = "user";
userHybrid.finish_authority = "user";
const noSplit = mergePersistedFlooringPortionsOnReanalyse({
  extracted: two,
  persisted: [userHybrid],
});
check("78. user-owned hybrid does not auto-split", noSplit.length === 1 && noSplit[0]?.label === "Whole house");
const deleted = storedFlooringPortions(persistedTwo, "f1").slice(0, 1);
const notRecreated = mergePersistedFlooringPortionsOnReanalyse({
  extracted: two,
  persisted: deleted,
});
check("79. intentional deletion is not recreated", notRecreated.length === 1 && notRecreated[0]?.label === "Bedrooms");
const userKept = storedFlooringPortions(userPreserve, "f1")[0]!;
const livingOnly = two.slice(1);
const keepUser = mergePersistedFlooringPortionsOnReanalyse({
  extracted: livingOnly,
  persisted: [userKept],
});
check("80. user-confirmed area is not machine-deleted", keepUser.some((row) => row.id === userKept.id));
const repeat = mergePersistedFlooringPortionsOnReanalyse({
  extracted: two,
  persisted: again,
});
check("81. no duplicates after repeated re-analysis", repeat.length === 2 && new Set(repeat.map((row) => row.id)).size === 2);

console.log("\n=== I. Legacy and cross-area safety ===\n");
const completeFacts = persistPortions([carpetComplete, vinylComplete]);
const nestedMoney = calculateFlooring(ctx(completeFacts), WA as never);
check("82. nested complete remains no-money staged path", nestedMoney.lineItems.length === 0 && nestedMoney.missingInfo.includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE));
check("83. nested incomplete does not use legacy", calculateFlooring(ctx(unlabeledIncomplete), WA as never).lineItems.length === 0);
const specialist = persistPortions([{
  ...createEmptyFlooringPortion({ label: "Entry" }),
  finish_type: "other",
  specialist_kind: "laminate",
  other_description: "Laminate flooring",
  area_m2: 12,
  area_input_method: "direct_m2",
}]);
check("84. nested specialist does not use legacy", calculateFlooring(ctx(specialist), WA as never).lineItems.length === 0);
const legacy = calculateFlooring(ctx([{ key: "flooring.area_m2", work_area_id: "f1", value: 20 }]), WA as never);
check("85. flat legacy control unchanged", legacy.lineItems.length > 0 && !legacy.missingInfo.includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE));

const bathroomFacts: EstimateFact[] = [{ key: "bathroom.area_m2", work_area_id: "b1", value: 6 }];
const bathroomBefore = calculateBathroom({ ...ctx(bathroomFacts), confirmedWorkAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1, status: "confirmed" }] } as EstimateContext, { id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1, status: "confirmed" } as never);
const bathroomMixed = applyFlooringFactWrite({ facts: [...bathroomFacts, ...completeFacts], workAreaId: "f1", key: FLOORING_ADD_PORTION_KEY, value: true });
check("86. Bathroom facts not mutated", JSON.stringify(bathroomMixed.filter((row) => row.key.startsWith("bathroom."))) === JSON.stringify(bathroomFacts) && calculateBathroom({ ...ctx(bathroomMixed), confirmedWorkAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1, status: "confirmed" }] } as EstimateContext, { id: "b1", type: "bathroom", name: "Bathroom", sort_order: 1, status: "confirmed" } as never).lineItems.length === bathroomBefore.lineItems.length);

const kitchenFacts: EstimateFact[] = [{ key: "kitchen.area_m2", work_area_id: "k1", value: 12 }];
const kitchenMixed = applyFlooringFactWrite({ facts: [...kitchenFacts, ...completeFacts], workAreaId: "f1", key: FLOORING_ADD_PORTION_KEY, value: true });
check("87. Kitchen facts not mutated", JSON.stringify(kitchenMixed.filter((row) => row.key.startsWith("kitchen."))) === JSON.stringify(kitchenFacts));
void calculateKitchen;

const demoFacts: EstimateFact[] = [{ key: "demolition.floor_area_m2", work_area_id: "dm1", value: 30 }];
const demoMixed = applyFlooringFactWrite({ facts: [...demoFacts, ...completeFacts], workAreaId: "f1", key: FLOORING_ADD_PORTION_KEY, value: true });
check("88. Demolition facts not mutated", JSON.stringify(demoMixed.filter((row) => row.key.startsWith("demolition."))) === JSON.stringify(demoFacts));
void calculateDemolition;

const doorFacts = applyDoorsFactWrite({
  facts: [],
  workAreaId: "d1",
  key: DOORS_PORTIONS_FACT_KEY,
  value: [{
    id: "do_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
    label: "Hall",
    installation_type: "prehung_internal",
    leaf_construction: "hollow_core",
    height_mm: 1980,
    width_mm: 810,
    quantity: 1,
    hardware_included: true,
    other_description: null,
    specialist_kind: null,
  }],
});
const doorAfter = applyFlooringFactWrite({ facts: [...doorFacts, ...completeFacts], workAreaId: "f1", key: FLOORING_ADD_PORTION_KEY, value: true });
check("89. Doors frozen fixture unchanged", JSON.stringify(doorAfter.filter((row) => row.key.startsWith("doors."))) === JSON.stringify(doorFacts));
void calculateDoors;

check("90. Internal Walls ownership unchanged", read("lib/work-areas/ownership.ts").includes("briefHasIndependentInternalWalls") || read("lib/work-areas/ownership.ts").includes("briefHasExplicitInternalWalls"));
check("91. Ceiling ownership unchanged", read("lib/work-areas/ownership.ts").includes("briefHasIndependentCeilings"));
const quote = buildWorkAreaQuoteDescriptionDraft({
  type: "flooring",
  name: "Flooring",
  facts: completeFacts.map((row) => ({ key: row.key, value: row.value })),
});
check("92. collection JSON does not leak to Quote", !quote.includes("finish_type") && !quote.includes("vinyl_plank") && !quote.includes(JSON.stringify(storedFlooringPortions(completeFacts, "f1"))));

check("two-area underlay/prep/removal", two[0]?.underlay_required === true && two[1]?.floor_preparation_required === true && two[0]?.finish_removal_required === false);
check("job-plan uses nested summaries", composeJobPlan({ workAreas: [WA], facts: completeFacts, qualityLevel: "standard", briefText: TWO_AREA }).cards[0]?.summary.includes("2 flooring areas") === true);
check("prompt uses flooring.portions", read("lib/ai/brief-extraction-prompt.ts").includes("flooring.portions") && read("lib/ai/brief-extraction-prompt.ts").includes("legacy-only"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
