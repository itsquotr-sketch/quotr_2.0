/**
 * DOORS-02 — nested extraction, Details, and Ready.
 *
 * Run: npx --yes tsx scripts/verify-doors-02-extraction-details.ts
 *
 * No paid AI. No Production. No takeoff / money / productivity.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  extractDoorPortionsFromBrief,
} from "../lib/estimate/doors-brief";
import {
  doorPortionIsInformationComplete,
  doorPortionMaterialPricingRequired,
  listDoorsClarifyCandidates,
  summariseDoorPortion,
} from "../lib/estimate/doors-clarify";
import { DOORS_INFORMATION_CONTRACT } from "../lib/estimate/doors-information-contract";
import { DOORS_REPLACEMENT_FRAME_DISCLOSURE } from "../lib/estimate/doors-question-copy";
import { calculateDoors } from "../lib/estimate/calculators/fitout";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  applyDoorsFactWrite,
  DOORS_ADD_PORTION_KEY,
  DOORS_DELETE_PORTION_KEY,
  DOORS_DUPLICATE_PORTION_KEY,
  DOORS_HEIGHT_DISCLOSED_DEFAULT_MM,
  DOORS_PORTIONS_FACT_KEY,
  mergePersistedDoorsPortionsOnReanalyse,
  parseDoorsCollectionEnvelope,
  parseDoorsPortions,
  storedDoorsPortions,
  type DoorPortion,
} from "../lib/estimate/doors-portions";
import type {
  EstimateContext,
  EstimateFact,
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

function portionsOf(brief: string): DoorPortion[] {
  const extraction = extract(brief);
  const fact = extraction.facts.find((row) => row.key === DOORS_PORTIONS_FACT_KEY);
  return parseDoorsPortions(fact?.value);
}

function writeDoors(
  facts: readonly EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId?: string | null,
  factSource?: string | null
): EstimateFact[] {
  return applyDoorsFactWrite({
    facts,
    workAreaId: "d1",
    key,
    value,
    nestedItemId,
    factSource,
  });
}

function persistPortions(portions: readonly DoorPortion[]): EstimateFact[] {
  return writeDoors([], DOORS_PORTIONS_FACT_KEY, [...portions], null, "ai_extracted");
}

const WA = {
  id: "d1",
  type: "doors",
  name: "Doors",
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

function completeOrdinary(source: DoorPortion, patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    ...source,
    installation_type: "prehung_internal",
    installation_authority: "extracted",
    leaf_construction: "hollow_core",
    leaf_authority: "extracted",
    height_mm: 1980,
    height_authority: "extracted",
    width_mm: 810,
    width_authority: "extracted",
    quantity: 2,
    quantity_authority: "extracted",
    hardware_included: true,
    hardware_authority: "extracted",
    ...patch,
  };
}

console.log("=== DOORS-02 extraction ===\n");

const PREHUNG =
  "Supply and install two 1980 × 810 hollow-core prehung bedroom doors with standard hardware.";
const REPLACEMENT =
  "Replace the damaged leaf. Fit one 2200 × 910 solid-core replacement leaf into the existing frame using the existing hardware.";
const TWO_SETS =
  "Supply and install two 1980 × 810 hollow-core prehung bedroom doors with standard hardware, plus one 2200 × 910 solid-core replacement leaf in the existing frame using the existing hardware.";

const prehung = extractDoorPortionsFromBrief(PREHUNG);
check(
  "1. Simple prehung brief creates one nested portion",
  prehung.length === 1 &&
    prehung[0]?.installation_type === "prehung_internal" &&
    prehung[0]?.leaf_construction === "hollow_core" &&
    prehung[0]?.height_mm === 1980 &&
    prehung[0]?.width_mm === 810 &&
    prehung[0]?.quantity === 2 &&
    prehung[0]?.hardware_included === true
);

const replacement = extractDoorPortionsFromBrief(REPLACEMENT);
check(
  "2. Replacement-leaf brief creates one nested portion",
  replacement.length === 1 &&
    replacement[0]?.installation_type === "replacement_leaf" &&
    replacement[0]?.leaf_construction === "solid_core" &&
    replacement[0]?.height_mm === 2200 &&
    replacement[0]?.width_mm === 910 &&
    replacement[0]?.quantity === 1 &&
    replacement[0]?.hardware_included === false
);

const hyphen = extractDoorPortionsFromBrief(
  "Supply and install one hollow-core prehung door and one solid core replacement leaf into the existing frame."
);
check(
  "3. Hyphenated and unhyphenated hollow/solid terms parse correctly",
  hyphen.some((row) => row.leaf_construction === "hollow_core") &&
    hyphen.some((row) => row.leaf_construction === "solid_core")
);

const labelled = extractDoorPortionsFromBrief(
  "Supply and install one 1980mm high by 810mm wide prehung hollow-core door."
);
check(
  "4. Supported labelled dimensions parse correctly",
  labelled[0]?.height_mm === 1980 && labelled[0]?.width_mm === 810
);

const unlabelled = extractDoorPortionsFromBrief(
  "Supply and install one 1980 x 810 hollow-core prehung door."
);
const reversedUnlabelled = extractDoorPortionsFromBrief(
  "Supply and install one 810 × 1980 hollow-core prehung door."
);
check(
  "5. Supported unlabelled dimensions parse only when unambiguous",
  unlabelled[0]?.height_mm === 1980 &&
    unlabelled[0]?.width_mm === 810 &&
    reversedUnlabelled[0]?.height_mm === 1980 &&
    reversedUnlabelled[0]?.width_mm === 810
);

const reversedLabelled = extractDoorPortionsFromBrief(
  "Supply and install one 810 wide x 1980 high hollow-core prehung door."
);
check(
  "6. Reversed labelled dimension order parses correctly",
  reversedLabelled[0]?.height_mm === 1980 && reversedLabelled[0]?.width_mm === 810
);

const unsupportedDims = extractDoorPortionsFromBrief(
  "Supply and install one 2000 x 1000 hollow-core prehung door."
);
check(
  "7. Unsupported dimensions are not coerced",
  unsupportedDims[0]?.height_mm !== 1980 &&
    unsupportedDims[0]?.width_mm !== 810 &&
    unsupportedDims[0]?.height_mm !== 2200 &&
    unsupportedDims[0]?.width_mm == null
);

const qty = extractDoorPortionsFromBrief(
  "Supply and install three identical door leaves into the existing frame."
);
check(
  "8. Quantity is correctly associated with its portion",
  qty[0]?.quantity === 3 && qty[0]?.installation_type === "replacement_leaf"
);

const hwIn = extractDoorPortionsFromBrief(
  "Supply and install one prehung hollow-core door. Include standard hardware."
);
const hwOut = extractDoorPortionsFromBrief(
  "Replace the door leaf and reuse existing hardware in the existing frame."
);
check("9. Included hardware parses correctly", hwIn[0]?.hardware_included === true);
check("10. Reused/excluded hardware parses correctly", hwOut[0]?.hardware_included === false);

check(
  "11. Optional location parses only when attributable",
  prehung[0]?.label === "Bedroom doors" &&
    extractDoorPortionsFromBrief(
      "Supply and install one prehung hollow-core door."
    )[0]?.label == null
);

const two = extractDoorPortionsFromBrief(TWO_SETS);
check(
  "12. Two distinct Door Sets create two portions",
  two.length === 2 &&
    two[0]?.installation_type === "prehung_internal" &&
    two[0]?.quantity === 2 &&
    two[0]?.width_mm === 810 &&
    two[1]?.installation_type === "replacement_leaf" &&
    two[1]?.quantity === 1 &&
    two[1]?.width_mm === 910 &&
    two[1]?.hardware_included === false
);

const firstExtract = portionsOf(TWO_SETS);
const reanalyse = mergePersistedDoorsPortionsOnReanalyse({
  extracted: portionsOf(TWO_SETS),
  persisted: firstExtract,
});
check(
  "13. Re-analysis is idempotent",
  reanalyse.length === firstExtract.length &&
    reanalyse[0]?.id === firstExtract[0]?.id &&
    reanalyse[1]?.id === firstExtract[1]?.id &&
    reanalyse[0]?.quantity === 2 &&
    reanalyse[1]?.quantity === 1
);

const userOwned = firstExtract.map((row, index) =>
  index === 0
    ? { ...row, quantity: 5, quantity_authority: "user" as const }
    : row
);
const afterUser = mergePersistedDoorsPortionsOnReanalyse({
  extracted: portionsOf(TWO_SETS),
  persisted: userOwned,
});
check(
  "14. User-owned fields survive re-analysis",
  afterUser[0]?.quantity === 5 && afterUser[0]?.quantity_authority === "user"
);

let facts = persistPortions(firstExtract);
const idA = storedDoorsPortions(facts, "d1")[0]!.id;
const idB = storedDoorsPortions(facts, "d1")[1]!.id;
facts = writeDoors(facts, "doors.portion.quantity", 9, idA);
check(
  "15. Editing one portion does not affect another",
  storedDoorsPortions(facts, "d1")[0]?.quantity === 9 &&
    storedDoorsPortions(facts, "d1")[1]?.id === idB &&
    storedDoorsPortions(facts, "d1")[1]?.quantity === 1
);

const openingOnly = extract(
  "Construct an internal wall with one 810 × 1980 opening. Opening only."
);
check(
  "16. Opening-only creates no Door Set",
  !openingOnly.workAreas.some((row) => row.type === "doors") &&
    !openingOnly.facts.some((row) => row.key === DOORS_PORTIONS_FACT_KEY)
);

const combined = extract(
  "Build a new internal wall with one 810 × 1980 door opening and supply and install one 1980 × 810 hollow-core prehung door."
);
const iwKeys = combined.facts
  .filter((row) => row.key.startsWith("internal_walls."))
  .map((row) => row.key)
  .sort();
const doorsOnly = extract(
  "Supply and install one 1980 × 810 hollow-core prehung door."
);
check(
  "17. Combined wall opening plus door supply creates Doors without mutating IW",
  combined.workAreas.some((row) => row.type === "doors") &&
    combined.workAreas.some((row) => row.type === "internal_walls") &&
    combined.facts.some((row) => row.key === DOORS_PORTIONS_FACT_KEY) &&
    !combined.facts.some((row) => row.key.startsWith("internal_walls.") && row.key.includes("doors")) &&
    JSON.stringify(iwKeys) !== JSON.stringify(
      doorsOnly.facts
        .filter((row) => row.key.startsWith("internal_walls."))
        .map((row) => row.key)
        .sort()
    )
);

const silent = extractDoorPortionsFromBrief(
  "Supply and install hollow-core prehung internal doors."
);
check("18. No silent width", silent[0]?.width_mm == null);
check("19. No silent quantity", silent[0]?.quantity == null);
check("20. No silent hardware", silent[0]?.hardware_included == null);

console.log("\n=== DOORS-02 specialist safety ===\n");

const fire = extractDoorPortionsFromBrief("Supply and install one fire-rated door.");
const acoustic = extractDoorPortionsFromBrief(
  "Supply and install an acoustic-rated bedroom door."
);
check(
  "21. Fire/acoustic door remains unsupported",
  fire[0]?.installation_type === "other_unsupported" &&
    fire[0]?.specialist_kind === "fire_rated" &&
    acoustic[0]?.installation_type === "other_unsupported" &&
    acoustic[0]?.specialist_kind === "acoustic"
);

const slider = extractDoorPortionsFromBrief("Supply and install a cavity slider.");
check(
  "22. Cavity slider remains unsupported",
  slider[0]?.installation_type === "other_unsupported" &&
    slider[0]?.specialist_kind === "cavity_slider"
);

const alum = extractDoorPortionsFromBrief(
  "Supply and install an aluminium exterior door."
);
check(
  "23. Aluminium/exterior door remains unsupported",
  alum[0]?.installation_type === "other_unsupported" &&
    (alum[0]?.specialist_kind === "aluminium" ||
      alum[0]?.specialist_kind === "exterior")
);

const custom = extractDoorPortionsFromBrief(
  "Fit one custom conventional hinged internal leaf into the existing frame."
);
check(
  "24. Custom conventional replacement leaf remains replacement install plus other material",
  custom[0]?.installation_type === "replacement_leaf" &&
    custom[0]?.leaf_construction === "other" &&
    Boolean(custom[0]?.other_description)
);

check(
  "25. Specialist extraction does not receive ordinary classification",
  fire[0]?.installation_type !== "prehung_internal" &&
    fire[0]?.installation_type !== "replacement_leaf" &&
    slider[0]?.leaf_construction == null
);

const persistedSpecialist: DoorPortion[] = [
  {
    ...fire[0]!,
    installation_authority: "user",
  },
];
const ordinaryReanalysis = mergePersistedDoorsPortionsOnReanalyse({
  extracted: prehung,
  persisted: persistedSpecialist,
});
check(
  "26. User-selected specialist survives ordinary re-analysis",
  ordinaryReanalysis[0]?.installation_type === "other_unsupported" &&
    ordinaryReanalysis[0]?.installation_authority === "user"
);

console.log("\n=== DOORS-02 Details ===\n");

const ordinaryFacts = persistPortions([
  completeOrdinary(prehung[0]!, {
    leaf_construction: null,
    width_mm: null,
    quantity: null,
    hardware_included: null,
    height_mm: DOORS_HEIGHT_DISCLOSED_DEFAULT_MM,
    height_authority: "assumed_disclosed",
  }),
]);
const ordinaryQs = listDoorsClarifyCandidates({
  facts: ordinaryFacts,
  workAreaId: "d1",
  workAreaName: "Doors",
  briefText: PREHUNG,
});
const ordinaryKeys = ordinaryQs.map((row) => row.factKey);
const contractKeys = DOORS_INFORMATION_CONTRACT.map((row) => row.factKey);
check(
  "27. Question order matches the contract",
  ordinaryKeys.every((key, index, arr) => {
    if (index === 0) return true;
    const prev = contractKeys.indexOf(arr[index - 1] ?? "");
    const cur = contractKeys.indexOf(key ?? "");
    return prev <= cur;
  }) &&
    ordinaryKeys[0] === "doors.portion.leaf_construction" &&
    ordinaryKeys.includes("doors.portion.width_mm")
);

check(
  "28. Prehung does not ask a redundant frame question",
  !ordinaryQs.some(
    (row) =>
      /frame|jamb|pre-?hung\?/i.test(row.question) &&
      row.factKey !== "doors.portion.installation_type"
  )
);

const replacementFacts = persistPortions([
  {
    ...replacement[0]!,
    leaf_construction: null,
    width_mm: null,
    hardware_included: null,
    quantity: null,
  },
]);
const replacementQs = listDoorsClarifyCandidates({
  facts: replacementFacts,
  workAreaId: "d1",
  workAreaName: "Doors",
});
check(
  "29. Replacement discloses existing frame retained",
  replacementQs.some((row) =>
    (row.assumptionStatement ?? "").includes("Existing frame")
  ) &&
    read("lib/estimate/doors-question-copy.ts").includes(
      DOORS_REPLACEMENT_FRAME_DISCLOSURE
    )
);

const otherLeafFacts = persistPortions([
  completeOrdinary(prehung[0]!, {
    leaf_construction: "other",
    other_description: null,
    width_mm: 810,
    quantity: 1,
    hardware_included: true,
  }),
]);
const otherLeafQs = listDoorsClarifyCandidates({
  facts: otherLeafFacts,
  workAreaId: "d1",
  workAreaName: "Doors",
});
check(
  "30. Other leaf asks for description",
  otherLeafQs.some(
    (row) =>
      row.factKey === "doors.portion.other_description" &&
      /leaf material or type/i.test(row.question)
  )
);

const specialistFacts = persistPortions(fire);
const specialistQs = listDoorsClarifyCandidates({
  facts: specialistFacts,
  workAreaId: "d1",
  workAreaName: "Doors",
});
check(
  "31. Unsupported install does not ask ordinary leaf/hardware questions",
  !specialistQs.some(
    (row) =>
      row.factKey === "doors.portion.leaf_construction" ||
      row.factKey === "doors.portion.hardware_included"
  )
);

check(
  "32. Height 1980 is visible/disclosed",
  ordinaryQs.some(
    (row) =>
      row.factKey === "doors.portion.height_mm" &&
      row.askClass === "ASSUME_IF_SKIPPED" &&
      String(row.currentValue).includes("1980")
  )
);

check(
  "33. Width remains required",
  ordinaryQs.some(
    (row) =>
      row.factKey === "doors.portion.width_mm" && row.askClass === "HARD_MINIMUM"
  )
);
check(
  "34. Quantity remains required",
  ordinaryQs.some(
    (row) =>
      row.factKey === "doors.portion.quantity" && row.askClass === "HARD_MINIMUM"
  )
);
check(
  "35. Hardware remains required",
  ordinaryQs.some(
    (row) =>
      row.factKey === "doors.portion.hardware_included" &&
      row.askClass === "HARD_MINIMUM"
  )
);

check(
  "36. Location is non-blocking",
  ordinaryQs
    .filter((row) => row.factKey === "doors.portion.label")
    .every((row) => row.askClass === "ASSUME_IF_SKIPPED" && !row.blocksEstimate)
);

let addFacts = writeDoors([], DOORS_ADD_PORTION_KEY, true);
const added = storedDoorsPortions(addFacts, "d1")[0];
check(
  "37. Add works",
  Boolean(added?.id) &&
    added?.height_mm === DOORS_HEIGHT_DISCLOSED_DEFAULT_MM &&
    added?.width_mm == null &&
    added?.quantity == null &&
    added?.hardware_included == null
);

addFacts = writeDoors(addFacts, DOORS_DUPLICATE_PORTION_KEY, added!.id);
const afterDup = storedDoorsPortions(addFacts, "d1");
check(
  "38. Duplicate uses a new ID",
  afterDup.length === 2 && afterDup[0]!.id !== afterDup[1]!.id
);

const keepId = afterDup[0]!.id;
addFacts = writeDoors(addFacts, DOORS_DELETE_PORTION_KEY, afterDup[1]!.id);
check(
  "39. Delete affects only the selected portion",
  storedDoorsPortions(addFacts, "d1").length === 1 &&
    storedDoorsPortions(addFacts, "d1")[0]?.id === keepId
);

check(
  "40. Nested writes create no competing scalar facts",
  addFacts.every(
    (row) =>
      row.key === DOORS_PORTIONS_FACT_KEY ||
      row.key === "doors.active_portion_id"
  ) &&
    !addFacts.some((row) => row.key === "doors.count")
);

const jsonRoundTrip = parseDoorsCollectionEnvelope(
  JSON.stringify({
    v: 1,
    portions: storedDoorsPortions(ordinaryFacts, "d1"),
  })
).portions;
check(
  "41. Back-navigation/JSON refresh preserves answers",
  jsonRoundTrip[0]?.installation_type === "prehung_internal" &&
    jsonRoundTrip[0]?.height_mm === 1980
);

const userHeight = storedDoorsPortions(ordinaryFacts, "d1").map((row) => ({
  ...row,
  width_mm: 860 as const,
  width_authority: "user" as const,
}));
const preserved = mergePersistedDoorsPortionsOnReanalyse({
  extracted: prehung,
  persisted: userHeight,
});
check(
  "42. Re-analysis preserves user authority",
  preserved[0]?.width_mm === 860 && preserved[0]?.width_authority === "user"
);

console.log("\n=== DOORS-02 Ready ===\n");

const readyFacts = persistPortions([completeOrdinary(prehung[0]!)]);
const readyView = clarify(readyFacts, PREHUNG);
check(
  "43. Complete ordinary portion reaches Ready",
  doorPortionIsInformationComplete(storedDoorsPortions(readyFacts, "d1")[0]!) &&
    readyView.remainingRequiredCount === 0 &&
    !readyView.blocksEstimate
);

const missingWidth = persistPortions([
  completeOrdinary(prehung[0]!, { width_mm: null, width_authority: undefined }),
]);
check(
  "44. Missing width does not reach Ready",
  !doorPortionIsInformationComplete(storedDoorsPortions(missingWidth, "d1")[0]!) &&
    clarify(missingWidth, PREHUNG).blocksEstimate
);

const missingQty = persistPortions([
  completeOrdinary(prehung[0]!, { quantity: null, quantity_authority: undefined }),
]);
check(
  "45. Missing quantity does not reach Ready",
  !doorPortionIsInformationComplete(storedDoorsPortions(missingQty, "d1")[0]!)
);

const missingHw = persistPortions([
  completeOrdinary(prehung[0]!, {
    hardware_included: null,
    hardware_authority: undefined,
  }),
]);
check(
  "46. Missing hardware decision does not reach Ready",
  !doorPortionIsInformationComplete(storedDoorsPortions(missingHw, "d1")[0]!)
);

const otherReady = persistPortions([
  completeOrdinary(prehung[0]!, {
    leaf_construction: "other",
    other_description: "Solid timber joinery leaf",
  }),
]);
check(
  "47. Other leaf with description remains materially unresolved for the later commercial phase",
  doorPortionIsInformationComplete(storedDoorsPortions(otherReady, "d1")[0]!) &&
    doorPortionMaterialPricingRequired(storedDoorsPortions(otherReady, "d1")[0]!)
);

const fireReady = persistPortions([
  {
    ...fire[0]!,
    quantity: 1,
    quantity_authority: "extracted",
    other_description: "Fire-rated door",
    other_description_authority: "extracted",
  },
]);
const fireSummary = summariseDoorPortion(
  storedDoorsPortions(fireReady, "d1")[0]!,
  0
);
check(
  "48. Unsupported installation remains visibly specialist",
  doorPortionIsInformationComplete(storedDoorsPortions(fireReady, "d1")[0]!) &&
    fireSummary.specialistRequired &&
    /specialist|unsupported/i.test(fireSummary.summary) &&
    !/prehung internal doors/.test(fireSummary.summary)
);

const multiFacts = persistPortions([
  completeOrdinary(two[0]!),
  {
    ...two[1]!,
    hardware_included: false,
    hardware_authority: "extracted",
  },
]);
const summaries = storedDoorsPortions(multiFacts, "d1").map((row, index) =>
  summariseDoorPortion(row, index)
);
check(
  "49. Multiple portions appear independently in summary",
  summaries.length === 2 &&
    /2 × 1980 × 810 mm hollow-core prehung internal doors/.test(summaries[0]!.summary) &&
    /Standard latch\/lever hardware included/.test(summaries[0]!.summary) &&
    /1 × 2200 × 910 mm solid-core replacement leaf/.test(summaries[1]!.summary) &&
    /Existing frame retained/.test(summaries[1]!.summary)
);

const nestedCalc = calculateDoors(ctx(readyFacts), {
  id: "d1",
  type: "doors",
  name: "Doors",
  sort_order: 1,
});
const legacyFacts: EstimateFact[] = [
  { key: "doors.count", work_area_id: "d1", value: 4, source: "user" },
];
const legacyCalc = calculateDoors(ctx(legacyFacts), {
  id: "d1",
  type: "doors",
  name: "Doors",
  sort_order: 1,
});
check(
  "50. New nested portions do not use the legacy lump calculator",
  !nestedCalc.lineItems.some((row) =>
    /supply\/install allowance/i.test(row.label)
  ) &&
    nestedCalc.lineItems.every(
      (row) => row.recommendedCost !== FITOUT_BENCHMARKS.doorsEach.cost * 4
    ) &&
    legacyCalc.lineItems.length > 0 &&
    !legacyFacts.some((row) => row.key === DOORS_PORTIONS_FACT_KEY)
);

check(
  "AI prompt uses nested Door Sets rather than flat facts as primary output",
  read("lib/ai/brief-extraction-prompt.ts").includes("doors.portions") &&
    read("lib/ai/brief-extraction-prompt.ts").includes(
      "Do not flatten multiple Door Sets into doors.count"
    )
);

check(
  "inferDoors seeds nested portions and strips legacy flat facts",
  !extract(PREHUNG).facts.some((row) => row.key === "doors.count") &&
    extract(PREHUNG).facts.some((row) => row.key === DOORS_PORTIONS_FACT_KEY)
);

const iwBefore = extract(
  "Build a new internal wall 4m long."
);
check(
  "Doors extraction does not write Internal Walls opening facts",
  !extract(PREHUNG).facts.some((row) => row.key.startsWith("internal_walls.")) &&
    (iwBefore.workAreas.some((row) => row.type === "internal_walls") ||
      iwBefore.facts.some((row) => row.key.startsWith("internal_walls.")))
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
