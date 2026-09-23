/**
 * FLOORING-06-R1 — substrate Details question sequencing.
 *
 * Run: npx --yes tsx scripts/verify-flooring-06-r1-substrate-question-flow.ts
 *
 * No paid AI. No Production. Does not change physical formulas or money.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
} from "../lib/estimate/bathroom-identities";
import { calculateFlooring } from "../lib/estimate/calculators/fitout";
import {
  listFlooringClarifyCandidates,
  flooringPortionIsInformationComplete,
  flooringWorkAreaIsReady,
} from "../lib/estimate/flooring-clarify";
import { flooringFactIsRelevant } from "../lib/estimate/flooring-information-contract";
import {
  FLOORING_SUBSTRATE_FAMILY_OPTIONS,
  FLOORING_SUBSTRATE_ITEM_OPTIONS,
  FLOORING_YES_NO_OPTIONS,
  flooringQuestionCopy,
  flooringQuestionInputType,
  flooringQuestionOptions,
  flooringSubstrateItemOptionsForFamily,
} from "../lib/estimate/flooring-question-copy";
import {
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
} from "../lib/estimate/flooring-identities";
import {
  applyFlooringFactWrite,
  createEmptyFlooringPortion,
  FLOORING_ADD_PORTION_KEY,
  FLOORING_DELETE_PORTION_KEY,
  FLOORING_DUPLICATE_PORTION_KEY,
  FLOORING_PORTIONS_FACT_KEY,
  mergePersistedFlooringPortionsOnReanalyse,
  parseFlooringPortions,
  storedFlooringPortions,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";

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

const WA: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;

const REQUIRED = "flooring.portion.substrate_required";
const FAMILY = "flooring.portion.substrate_family";
const PRODUCT = "flooring.portion.substrate_item_key";

function writeFlooring(
  facts: readonly EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId?: string | null
): EstimateFact[] {
  return applyFlooringFactWrite({
    facts,
    workAreaId: WA.id,
    key,
    value,
    nestedItemId,
  });
}

function persist(portions: readonly FlooringPortion[]): EstimateFact[] {
  return writeFlooring([], FLOORING_PORTIONS_FACT_KEY, [...portions]);
}

function ordinary(patch: Partial<FlooringPortion> = {}): FlooringPortion {
  return {
    ...createEmptyFlooringPortion({
      id: patch.id ?? "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      label: patch.label ?? "Living",
    }),
    finish_type: "carpet",
    area_input_method: "direct_m2",
    area_m2: 10,
    underlay_required: false,
    floor_preparation_required: false,
    framing_required: false,
    finish_removal_required: false,
    ...patch,
  };
}

function candidatesFor(portion: FlooringPortion) {
  return listFlooringClarifyCandidates({
    facts: persist([portion]),
    workAreaId: WA.id,
    workAreaName: "Flooring",
  }).filter((row) => row.nestedItemId === portion.id);
}

function factKeys(portion: FlooringPortion): string[] {
  return candidatesFor(portion).map((row) => row.factKey);
}

function relevant(portion: FlooringPortion, factKey: string): boolean {
  return flooringFactIsRelevant(factKey, {
    facts: persist([portion]),
    workAreaId: WA.id,
    nestedItemId: portion.id,
    portion,
  });
}

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

function extractPortions(brief: string): FlooringPortion[] {
  const extraction = enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: getAnalysisCapableWorkAreaTypes(),
  }).extraction;
  const fact = extraction.facts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY);
  return parseFlooringPortions(fact?.value);
}

function hosted(portions: readonly FlooringPortion[]) {
  return calculateFlooring(
    {
      project: { id: "p1", qualityLevel: "standard" },
      confirmedWorkAreas: [WA],
      facts: persist(portions),
      constraints: [],
      organisationSettings: {
        allow_benchmark_rates: true,
        default_margin_percent: 20,
      },
      rates: [],
    } as unknown as EstimateContext,
    WA
  );
}

console.log("=== FLOORING-06-R1 substrate Details question flow ===\n");

const unanswered = ordinary({ substrate_required: null });
const unansweredKeys = factKeys(unanswered);
check(
  "1. Substrate unanswered shows the required Yes/No question only",
  relevant(unanswered, REQUIRED) &&
    unansweredKeys.includes(REQUIRED) &&
    !unansweredKeys.includes(FAMILY) &&
    !unansweredKeys.includes(PRODUCT) &&
    !relevant(unanswered, FAMILY) &&
    !relevant(unanswered, PRODUCT)
);
check(
  "1b. Required question stays Boolean Yes/No, not a family enum",
  flooringQuestionInputType(REQUIRED) === "boolean" &&
    flooringQuestionOptions(REQUIRED)?.join("|") === FLOORING_YES_NO_OPTIONS.join("|") &&
    flooringQuestionCopy(REQUIRED) === "Is new floor substrate required?"
);

const none = ordinary({ substrate_required: false });
check(
  "2. Substrate No does not ask family or product",
  none.substrate_required === false &&
    !relevant(none, FAMILY) &&
    !relevant(none, PRODUCT) &&
    !factKeys(none).includes(FAMILY) &&
    !factKeys(none).includes(PRODUCT) &&
    flooringPortionIsInformationComplete(none)
);
check(
  "2b. Substrate No does not emit material or installation lines",
  !hosted([none]).lineItems.some(
    (row) =>
      row.componentKey === FLOORING_SUBSTRATE_MATERIAL_COMPONENT ||
      row.componentKey === FLOORING_SUBSTRATE_INSTALL_LABOUR
  )
);

const yesNoFamily = ordinary({
  substrate_required: true,
  substrate_family: null,
  substrate_item_key: null,
});
check(
  "3. Yes with no family asks the material question only",
  relevant(yesNoFamily, FAMILY) &&
    !relevant(yesNoFamily, PRODUCT) &&
    factKeys(yesNoFamily).includes(FAMILY) &&
    !factKeys(yesNoFamily).includes(PRODUCT) &&
    flooringQuestionCopy(FAMILY) === "What substrate material is required?" &&
    flooringQuestionInputType(FAMILY) === "select"
);
check(
  "3b. Family options are material enums, not Yes/No",
  flooringQuestionOptions(FAMILY)?.join("|") ===
    FLOORING_SUBSTRATE_FAMILY_OPTIONS.join("|") &&
    FLOORING_SUBSTRATE_FAMILY_OPTIONS.join("|") ===
      "Plywood|Particleboard|Fibre cement|Other / custom"
);

const yesPlywood = ordinary({
  substrate_required: true,
  substrate_family: "structural_plywood",
  substrate_item_key: null,
});
const plywoodProduct = candidatesFor(yesPlywood).find((row) => row.factKey === PRODUCT);
check(
  "4. Yes + family persisted asks the product question only",
  relevant(yesPlywood, PRODUCT) &&
    factKeys(yesPlywood).includes(PRODUCT) &&
    !factKeys(yesPlywood).includes(FAMILY) &&
    flooringQuestionCopy(PRODUCT) === "Which substrate product is required?"
);
check(
  "4b. Product question is a family-filtered select, not Yes/No",
  plywoodProduct?.inputType === "select" &&
    (plywoodProduct.options ?? []).length > 0 &&
    !(plywoodProduct.options ?? []).includes("Yes")
);

const completePlywood = ordinary({
  area_m2: 12,
  substrate_required: true,
  substrate_family: "structural_plywood",
  substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
});
check(
  "5. Exact product answered asks neither family nor product",
  !factKeys(completePlywood).includes(FAMILY) &&
    !factKeys(completePlywood).includes(PRODUCT) &&
    flooringPortionIsInformationComplete(completePlywood)
);

const plywoodOptions = flooringSubstrateItemOptionsForFamily("structural_plywood");
const fcOptions = flooringSubstrateItemOptionsForFamily("fibre_cement");
check(
  "6. Plywood product options are filtered to the plywood identity",
  plywoodOptions.length === 1 &&
    plywoodOptions[0]?.includes("plywood") &&
    !plywoodOptions.some((row) => /fibre-cement|Secura|particleboard/i.test(row))
);
check(
  "7. Fibre-cement options exclude plywood and keep exact catalogue identities",
  fcOptions.every((row) => !/plywood/i.test(row)) &&
    fcOptions.some((row) => row.includes("2700")) &&
    fcOptions.some((row) => /Secura/i.test(row)) &&
    plywoodOptions.every((row) => !fcOptions.includes(row)) &&
    FLOORING_SUBSTRATE_ITEM_OPTIONS.length > plywoodOptions.length
);

let familyChange = persist([
  ordinary({
    id: "fa_change",
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  }),
]);
familyChange = writeFlooring(
  familyChange,
  FAMILY,
  "Fibre cement",
  "fa_change"
);
const afterFamilyChange = storedFlooringPortions(familyChange, WA.id)[0]!;
check(
  "8. Changing family clears the incompatible plywood product",
  afterFamilyChange.substrate_family === "fibre_cement" &&
    afterFamilyChange.substrate_item_key == null &&
    factKeys(afterFamilyChange).includes(PRODUCT) &&
    !factKeys(afterFamilyChange).includes(FAMILY)
);
check(
  "8b. Cleared product does not price under the new family",
  !hosted([afterFamilyChange]).lineItems.some(
    (row) =>
      row.componentKey === FLOORING_SUBSTRATE_MATERIAL_COMPONENT &&
      (row.recommendedCost ?? 0) > 0
  )
);

const exactBrief = extractPortions(
  "Install new 19 mm H3.2 plywood flooring substrate and carpet to the living room."
)[0];
check(
  "9. Exact plywood brief stores required, family and catalogue product",
  exactBrief?.substrate_required === true &&
    exactBrief.substrate_family === "structural_plywood" &&
    exactBrief.substrate_item_key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY &&
    !factKeys({ ...ordinary(), ...exactBrief, id: exactBrief.id }).includes(FAMILY) &&
    !factKeys({ ...ordinary(), ...exactBrief, id: exactBrief.id }).includes(PRODUCT)
);

const familyBrief = extractPortions(
  "Install carpet with new plywood substrate in the living room."
)[0];
check(
  "10. Family-only brief answers required + plywood and leaves product unanswered",
  familyBrief?.substrate_required === true &&
    familyBrief.substrate_family === "structural_plywood" &&
    familyBrief.substrate_item_key == null &&
    factKeys({ ...ordinary(), ...familyBrief, id: familyBrief.id }).includes(PRODUCT) &&
    !factKeys({ ...ordinary(), ...familyBrief, id: familyBrief.id }).includes(FAMILY)
);

const genericBrief = extractPortions(
  "Install carpet with new floor substrate in the living room."
)[0];
check(
  "11. Generic substrate brief answers required only",
  genericBrief?.substrate_required === true &&
    genericBrief.substrate_family == null &&
    genericBrief.substrate_item_key == null &&
    factKeys({ ...ordinary(), ...genericBrief, id: genericBrief.id }).includes(FAMILY) &&
    !factKeys({ ...ordinary(), ...genericBrief, id: genericBrief.id }).includes(PRODUCT)
);
check(
  "11b. Extraction does not invent an exact product",
  genericBrief?.substrate_item_key == null &&
    familyBrief?.substrate_item_key == null
);

const userFacts = persist([
  ordinary({
    id: "fa_user",
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    substrate_family_authority: "user",
    substrate_item_authority: "user",
  }),
]);
const userPortion = storedFlooringPortions(userFacts, WA.id)[0]!;
const reanalysed = mergePersistedFlooringPortionsOnReanalyse({
  extracted: extractPortions("install carpet in the living room"),
  persisted: [userPortion],
});
check(
  "12. User-owned substrate family and product survive re-analysis",
  reanalysed[0]?.substrate_family === "structural_plywood" &&
    reanalysed[0]?.substrate_item_key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY &&
    reanalysed[0]?.substrate_family_authority === "user" &&
    reanalysed[0]?.substrate_item_authority === "user"
);

const siblingA = ordinary({
  id: "fa_a",
  label: "Bedrooms",
  substrate_required: true,
  substrate_family: "structural_plywood",
  substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
});
const siblingB = ordinary({
  id: "fa_b",
  label: "Hall",
  substrate_required: true,
  substrate_family: "fibre_cement",
  substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
});
let multi = persist([siblingA, siblingB]);
multi = writeFlooring(multi, FAMILY, "Particleboard", "fa_a");
const afterMulti = storedFlooringPortions(multi, WA.id);
check(
  "13. Changing family in one Flooring Area does not affect a sibling",
  afterMulti.find((row) => row.id === "fa_a")?.substrate_family === "particleboard" &&
    afterMulti.find((row) => row.id === "fa_a")?.substrate_item_key == null &&
    afterMulti.find((row) => row.id === "fa_b")?.substrate_family === "fibre_cement" &&
    afterMulti.find((row) => row.id === "fa_b")?.substrate_item_key ===
      BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY
);

let crud = persist([completePlywood]);
crud = writeFlooring(crud, FLOORING_ADD_PORTION_KEY, true);
const afterAdd = storedFlooringPortions(crud, WA.id);
crud = writeFlooring(crud, FLOORING_DUPLICATE_PORTION_KEY, completePlywood.id);
const afterDup = storedFlooringPortions(crud, WA.id);
const duplicate = afterDup.find(
  (row) => row.id !== completePlywood.id && row.substrate_item_key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY
);
const addedEmpty = afterAdd.find((row) => row.id !== completePlywood.id);
crud = writeFlooring(crud, FLOORING_DELETE_PORTION_KEY, afterDup[afterDup.length - 1]?.id);
check(
  "14. Add creates an empty area; duplicate copies substrate with a new ID",
  afterAdd.length === 2 &&
    addedEmpty?.substrate_required == null &&
    addedEmpty?.substrate_family == null &&
    addedEmpty?.substrate_item_key == null &&
    duplicate != null &&
    duplicate.id !== completePlywood.id &&
    duplicate.substrate_family === "structural_plywood" &&
    storedFlooringPortions(crud, WA.id).length === 2
);

check(
  "15. Re-analysis does not re-ask family or product after they are answered",
  !factKeys(reanalysed[0]!).includes(FAMILY) &&
    !factKeys(reanalysed[0]!).includes(PRODUCT)
);

check(
  "16. Readiness: No is complete; Yes without family is not; exact product is",
  flooringPortionIsInformationComplete(none) &&
    !flooringPortionIsInformationComplete(yesNoFamily) &&
    !flooringPortionIsInformationComplete(yesPlywood) &&
    flooringPortionIsInformationComplete(completePlywood) &&
    flooringWorkAreaIsReady({
      facts: persist([completePlywood]),
      workAreaId: WA.id,
      workAreaName: "Flooring",
    })
);

const plyHosted = hosted([completePlywood]);
const material = plyHosted.lineItems.find(
  (row) => row.componentKey === FLOORING_SUBSTRATE_MATERIAL_COMPONENT
);
const labour = plyHosted.lineItems.find(
  (row) => row.componentKey === FLOORING_SUBSTRATE_INSTALL_LABOUR
);
check(
  "17. Plywood 12 m² still purchases 5 sheets at $145 and 0.50 h install",
  material?.quantity === 5 &&
    Math.abs((material?.recommendedCost ?? 0) - 725) < 0.02 &&
    labour?.quantity === 5 &&
    Math.abs((labour?.recommendedCost ?? 0) - 150) < 0.02
);
check(
  "17b. Carpet finish COST is unchanged beside sequenced substrate questions",
  Math.abs(
    (hosted([ordinary({ substrate_required: false })]).lineItems.find(
      (row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2
    )?.recommendedCost ?? 0) - 750
  ) < 0.02
);

check(
  "18. Nested path still does not fall through to FITOUT $120/m²",
  !hosted([yesNoFamily]).lineItems.some((row) => (row.recommendedCost ?? 0) === 1200) &&
    !read("lib/estimate/flooring-question-copy.ts").includes("FITOUT_BENCHMARKS") &&
    !read("lib/estimate/flooring-information-contract.ts").includes("scope.flooring.m2")
);

const otherFamily = ordinary({
  substrate_required: true,
  substrate_family: "other",
});
check(
  "19. Other/custom uses a description instead of an ordinary product list",
  flooringQuestionInputType(PRODUCT, otherFamily) === "text" &&
    flooringQuestionOptions(PRODUCT, otherFamily) == null &&
    flooringSubstrateItemOptionsForFamily("other").length === 0
);

let customWrite = persist([otherFamily]);
customWrite = writeFlooring(
  customWrite,
  PRODUCT,
  "Client-specified acoustic board",
  otherFamily.id
);
check(
  "19b. Other/custom description is stored and not coerced to plywood",
  storedFlooringPortions(customWrite, WA.id)[0]?.substrate_item_key ===
    "Client-specified acoustic board" &&
    storedFlooringPortions(customWrite, WA.id)[0]?.substrate_item_key !==
      BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY
);

check(
  "20. Family and product questions are never shown together",
  [unanswered, none, yesNoFamily, yesPlywood, completePlywood, otherFamily].every(
    (portion) => {
      const keys = factKeys(portion);
      return !(keys.includes(FAMILY) && keys.includes(PRODUCT));
    }
  )
);

check(
  "21. Secura stays a catalogue product, not a simultaneous family+product ask",
  flooringSubstrateItemOptionsForFamily("secura").some((row) => /Secura/i.test(row)) &&
    !FLOORING_SUBSTRATE_FAMILY_OPTIONS.includes("Secura" as never)
);

const noThenHidden = writeFlooring(
  persist([
    ordinary({
      id: "fa_hide",
      substrate_required: true,
      substrate_family: "structural_plywood",
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
      substrate_family_authority: "user",
      substrate_item_authority: "user",
    }),
  ]),
  REQUIRED,
  false,
  "fa_hide"
);
const hidden = storedFlooringPortions(noThenHidden, WA.id)[0]!;
check(
  "22. User-owned family/product are kept when substrate is set to No",
  hidden.substrate_required === false &&
    hidden.substrate_family === "structural_plywood" &&
    hidden.substrate_item_key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY &&
    !relevant(hidden, FAMILY) &&
    !relevant(hidden, PRODUCT)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
