/**
 * Stage 3C — estimate assumptions, changed conditions and explicit refresh.
 *
 * Run: npx tsx scripts/verify-estimating-v3-stage-3c.ts
 */
import { readFileSync } from "node:fs";
import type { OrganisationRate } from "../components/setup/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import {
  getCombinedLabourAccessFactor,
  getLabourAdjustmentFactor,
  parseCarryDistanceCategory,
} from "../lib/estimate/adjustments";
import type { EstimateConstraint } from "../lib/estimate/types";
import { pricingTaxBasisDecision } from "../lib/pricing/gst-source";
import {
  commercialConditionMessages,
  conditionAnswerAffectsEstimateBasis,
  conditionAnswerAffectsLabour,
  explicitAssumptionFor,
  labourBasisNote,
  listConditionDecisions,
} from "../lib/estimate/condition-basis";
import { classifyReviewNotice } from "../lib/assistant/presentation/estimate-issues";
import { extractConstraintsFromBrief } from "../lib/ai/enrich-extraction";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import {
  FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
  FLOORING_LAMINATE_INSTALL_COMPONENT,
  FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
  FLOORING_LAMINATE_MOISTURE_M2,
  FLOORING_LAMINATE_SUPPLY_COMPONENT,
  FLOORING_LAMINATE_UNDERLAY_M2,
} from "../lib/estimate/flooring-laminate";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import {
  FLOORING_PORTIONS_FACT_KEY,
  applyFlooringFactWrite,
  resolveFlooringPortions,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import type { EstimateConstraint, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { presentGstForRegistration } from "../lib/pricing/gst-presentation";
import {
  disclosedProjectConditionForNotSure,
  projectConsumesConsumedCondition,
} from "../lib/project-conditions/consumed-authority";

const ORIGINAL =
  "Supply and install 30m² of laminate flooring in an empty rectangular room measuring 6m × 5m. The existing floor is bare concrete, clean, dry and ready for installation. Include underlay and 10% waste on the laminate. No skirting, floor preparation, demolition or disposal is required. Normal weekday access at ground level.";

const OBSOLETE_WASTE =
  "10% waste is stated for the new floor covering and applies to finish supply once this area can be priced.";

const failures: string[] = [];

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`ok ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}`, detail ?? "");
}

function rate(
  row: Partial<OrganisationRate> &
    Pick<OrganisationRate, "item_key" | "rate_type" | "cost_rate" | "unit">
): OrganisationRate {
  return {
    id: row.item_key + row.rate_type,
    trade: null,
    work_area_type: "flooring",
    label: row.item_key,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...row,
  };
}

const companyRates = [
  rate({
    item_key: FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 40,
  }),
  rate({
    item_key: FLOORING_LAMINATE_UNDERLAY_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 8,
  }),
  rate({
    item_key: FLOORING_LAMINATE_MOISTURE_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 3,
  }),
  rate({
    item_key: FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
    rate_type: "productivity",
    unit: "m2",
    cost_rate: 0.2,
  }),
  rate({
    item_key: "labour.carpenter.hour",
    rate_type: "labour",
    unit: "hour",
    cost_rate: 75,
  }),
];

const extracted = extractFlooringPortionsFromBrief(ORIGINAL)[0];
let facts = [
  {
    id: "fact-1",
    project_id: "project",
    work_area_id: "flooring",
    key: FLOORING_PORTIONS_FACT_KEY,
    value: [extracted],
    source: "extracted",
  },
] as EstimateFact[];
for (const [key, value] of [
  ["flooring.portion.laminate_method", "Floating click-lock"],
  ["flooring.portion.laminate_moisture", "Separate moisture barrier"],
  ["flooring.portion.finish_pricing", "Separate finish supply and installation"],
] as const) {
  facts = applyFlooringFactWrite({
    facts,
    workAreaId: "flooring",
    key,
    value,
    nestedItemId: extracted?.id,
  });
}
const portion = resolveFlooringPortions({
  facts,
  workAreaId: "flooring",
}).portions[0] as FlooringPortion;

function price(constraints: EstimateConstraint[]) {
  const workArea = {
    id: "flooring",
    type: "flooring",
    name: "Flooring",
  } as EstimateWorkArea;
  const physical = calculateFlooringPhysical({
    facts: [
      {
        id: "fact-1",
        project_id: "project",
        work_area_id: "flooring",
        key: FLOORING_PORTIONS_FACT_KEY,
        value: [portion],
        source: "user",
      },
    ] as EstimateFact[],
    workArea,
  });
  return { physical, commercial: commercializeFlooring({
    physical,
    workArea,
    rates: companyRates,
    organisationSettings: null,
    constraints,
  }) };
}

const open = price([]);
const install = open.commercial.lineItems.find(
  (item) => item.componentKey === FLOORING_LAMINATE_INSTALL_COMPONENT
);
check(
  "unanswered access and carry leave the 6 hour labour cost unchanged",
  install?.labourHours === 6 &&
    install.recommendedCost === 450 &&
    getLabourAdjustmentFactor([]) === 1,
  install
);
check(
  "unanswered access and carry are not treated as Easy or a short carry",
  /not a confirmed Easy answer/.test(install?.notes ?? "") &&
    /not a confirmed distance under 10 m/.test(install?.notes ?? "") &&
    /No hazardous-materials cost is included/.test(install?.notes ?? ""),
  install?.notes
);
check(
  "a new laminate estimate does not emit the obsolete unpriced-waste warning",
  !open.physical.missingInfo.some((row) =>
    /once this area can be priced/i.test(row)
  ) &&
    open.physical.assumptions.some((row) =>
      /10% waste is included in the laminate supply quantity/i.test(row)
    ),
  { missing: open.physical.missingInfo, assumptions: open.physical.assumptions }
);

const flooringTypes = ["flooring"];
const openMessages = commercialConditionMessages({
  constraints: [],
  workAreaTypes: flooringTypes,
});
check(
  "unanswered access and carry block commercial readiness",
  openMessages.some((row) => /site access still needs an answer/i.test(row)) &&
    openMessages.some((row) => /carry distance still needs an answer/i.test(row)) &&
    !openMessages.some((row) => /hazardous-materials risk still needs an answer/i.test(row)),
  openMessages
);
const openDecisions = listConditionDecisions({
  constraints: [],
  workAreaTypes: flooringTypes,
});
check(
  "the laminate job asks access, carry, hazardous materials, floor level and protection",
  openDecisions.map((row) => row.key).join(",") ===
    "site_access,material_carry_distance,hazardous_materials_risk,floor_level,protection_dust_control" &&
    openDecisions.find((row) => row.key === "hazardous_materials_risk")?.informational ===
      true &&
    openDecisions.find((row) => row.key === "floor_level")?.blocksCommercial === false &&
    openDecisions.find((row) => row.key === "protection_dust_control")?.blocksCommercial ===
      false &&
    openDecisions.every((row) => row.options.includes("Not sure") || row.key === "site_access"),
  openDecisions.map((row) => [row.key, row.state, row.blocksCommercial])
);
const consumerTypes = [
  "deck",
  "fence",
  "retaining_wall",
  "bathroom",
  "internal_walls",
  "demolition",
  "kitchen",
  "flooring",
  "ceilings",
  "painting",
  "doors",
  "plastering",
];
const consumptionAgrees = consumerTypes.every((type) => {
  const decisions = listConditionDecisions({ constraints: [], workAreaTypes: [type] });
  return (
    decisions.some((row) => row.key === "site_access") ===
      projectConsumesConsumedCondition([type], "site_access") &&
    decisions.some((row) => row.key === "material_carry_distance") ===
      projectConsumesConsumedCondition([type], "material_carry_distance")
  );
});
check("condition questions follow the labour-access consumers", consumptionAgrees);

check(
  "site access offers Not sure and the standard-access assumption",
  openDecisions.find((row) => row.key === "site_access")?.options.includes("Not sure") ===
    true && explicitAssumptionFor("site_access")?.value === "Easy"
);

const notSure = price([
  { key: "site_access", label: "Site access", value: "Not sure", source: "user" },
  {
    key: "material_carry_distance",
    label: "Carry distance",
    value: "Not sure",
    source: "user",
  },
]);
const notSureInstall = notSure.commercial.lineItems.find(
  (item) => item.componentKey === FLOORING_LAMINATE_INSTALL_COMPONENT
);
check(
  "Not sure does not become No or a carry allowance",
  notSureInstall?.labourHours === 6 &&
    notSureInstall.recommendedCost === 450 &&
    getLabourAdjustmentFactor([
      { key: "material_carry_distance", label: "Carry", value: "Not sure" },
    ]) === 1 &&
    commercialConditionMessages({
      constraints: [
        { key: "site_access", value: "Not sure" },
        { key: "material_carry_distance", value: "Not sure" },
      ],
      workAreaTypes: flooringTypes,
    }).length === 2 &&
    disclosedProjectConditionForNotSure("site_access", "Not sure") == null &&
    disclosedProjectConditionForNotSure("material_carry_distance", "Not sure") == null,
  notSureInstall
);
check(
  "occupied Not sure still uses its existing disclosed assumption",
  disclosedProjectConditionForNotSure("occupied_site", "Not sure")?.value === "No"
);

const accepted = price([
  { key: "site_access", label: "Site access", value: "Easy", source: "assumption" },
  {
    key: "material_carry_distance",
    label: "Carry distance",
    value: "< 10m",
    source: "assumption",
  },
  { key: "hazardous_materials_risk", label: "Hazardous materials", value: "No", source: "user" },
]);
const acceptedInstall = accepted.commercial.lineItems.find(
  (item) => item.componentKey === FLOORING_LAMINATE_INSTALL_COMPONENT
);
check(
  "accepted standard access and carry stay at 6 hours and clear the commercial block",
  acceptedInstall?.labourHours === 6 &&
    acceptedInstall.recommendedCost === 450 &&
    /standard-access assumption is accepted/.test(acceptedInstall.notes ?? "") &&
    commercialConditionMessages({
      constraints: [
        { key: "site_access", value: "Easy", source: "assumption" },
        { key: "material_carry_distance", value: "< 10m", source: "assumption" },
        { key: "hazardous_materials_risk", value: "No" },
      ],
      workAreaTypes: flooringTypes,
    }).length === 0,
  acceptedInstall?.notes
);

const difficult = price([
  { key: "site_access", label: "Site access", value: "Difficult", source: "user" },
  {
    key: "material_carry_distance",
    label: "Carry distance",
    value: "> 30m",
    source: "user",
  },
]);
const difficultInstall = difficult.commercial.lineItems.find(
  (item) => item.componentKey === FLOORING_LAMINATE_INSTALL_COMPONENT
);
const difficultFactor = getLabourAdjustmentFactor([
  { key: "site_access", label: "Site access", value: "Difficult" },
  { key: "material_carry_distance", label: "Carry", value: "> 30m" },
]);
check(
  "difficult access and a long carry change the labour hours and cost",
  difficultInstall?.labourHours === 7.2 &&
    difficultInstall.recommendedCost === 540 &&
    /include \+10%/.test(difficultInstall.notes ?? "") &&
    Math.abs(difficultFactor - 1.2) < 0.001,
  {
    hours: difficultInstall?.labourHours,
    cost: difficultInstall?.recommendedCost,
    factor: difficultFactor,
    plus: /include \+10%/.test(difficultInstall?.notes ?? ""),
  }
);

const hazmatYes = commercialConditionMessages({
  constraints: [{ key: "hazardous_materials_risk", value: "Yes" }],
  workAreaTypes: flooringTypes,
});
check(
  "hazardous materials Yes stays unpriced and does not invent an allowance",
  hazmatYes.some((row) => /not priced/i.test(row) && /no allowance/i.test(row)) &&
    !hazmatYes.some((row) => /\$/.test(row)),
  hazmatYes
);
check(
  "hazardous materials Not sure is not stored or described as No",
  commercialConditionMessages({
    constraints: [{ key: "hazardous_materials_risk", value: "Not sure" }],
    workAreaTypes: flooringTypes,
  }).some((row) => /Not sure/.test(row) && /not treated as No/.test(row))
);
check(
  "unanswered floor level and protection do not block flooring commercial completeness",
  !openMessages.some((row) => /floor level/i.test(row)) &&
    !openMessages.some((row) => /protection/i.test(row)) &&
    explicitAssumptionFor("floor_level")?.value === "Ground" &&
    explicitAssumptionFor("protection_dust_control")?.value === "No"
);
check(
  "a hazardous-materials answer marks the disclosure basis without changing labour",
  conditionAnswerAffectsEstimateBasis("hazardous_materials_risk") &&
    !conditionAnswerAffectsLabour("hazardous_materials_risk") &&
    conditionAnswerAffectsLabour("site_access") &&
    conditionAnswerAffectsEstimateBasis("site_access")
);
check(
  "unanswered floor level and protection questions are not unresolved specifications",
  classifyReviewNotice("What floor level are works on?") == null &&
    classifyReviewNotice("What floor are the works on?") == null &&
    classifyReviewNotice("Is extra protection or dust control required?") == null &&
    classifyReviewNotice("Is protection / dust control required?") == null
);

const historical = composeBuilderReview({
  estimate: {
    recommendedCost: 2100,
    recommendedSell: 2625,
    marginPercent: 20,
    confidence: 0.7,
    assumptions: [],
    missingInfo: [OBSOLETE_WASTE],
    lineItems: [
      {
        id: "supply",
        category: "MATERIALS",
        label: "Click-lock laminate supply",
        workAreaName: "Flooring",
        recommendedCost: 1320,
        recommendedSell: 1650,
        componentKey: FLOORING_LAMINATE_SUPPLY_COMPONENT,
        includedInTotal: true,
        quantity: 33,
        unit: "m2",
        rateSource: "Company rate",
      } as never,
    ],
  },
  workAreas: [
    { id: "flooring", name: "Flooring", type: "flooring", status: "confirmed" },
  ],
});
check(
  "a saved waste sentence stays visible and is not a missing price",
  historical.assumptions.some((row) => row.label === OBSOLETE_WASTE) &&
    historical.assumptions.some((row) => /not a missing price/i.test(row.detail ?? "")) &&
    !historical.checks.some((row) => row.label === OBSOLETE_WASTE),
  { assumptions: historical.assumptions, checks: historical.checks }
);

const unknownGst = presentGstForRegistration({
  gstRegistered: null,
  gstRate: 15,
  gstAmount: 393.75,
  subtotalExGst: 2625,
  totalInclGst: 3018.75,
});
const registeredGst = presentGstForRegistration({
  gstRegistered: true,
  gstRate: 15,
  gstAmount: 393.75,
  subtotalExGst: 2625,
  totalInclGst: 3018.75,
});
const notRegisteredGst = presentGstForRegistration({
  gstRegistered: false,
  gstRate: 15,
  gstAmount: 393.75,
  subtotalExGst: 2625,
  totalInclGst: 3018.75,
});
check(
  "unknown, registered and non-registered GST keep the accepted rules",
  unknownGst.registration === "unset" &&
    unknownGst.showGst === false &&
    unknownGst.gstAmount === 0 &&
    unknownGst.inclGst === 2625 &&
    registeredGst.registration === "registered" &&
    registeredGst.showGst === true &&
    registeredGst.gstRate === 15 &&
    registeredGst.gstAmount === 393.75 &&
    notRegisteredGst.registration === "not_registered" &&
    notRegisteredGst.gstAmount === 0 &&
    notRegisteredGst.inclGst === 2625
);

function labourConstraint(key: string, value: string): EstimateConstraint {
  return { key, label: key, value };
}

const difficultLong = getCombinedLabourAccessFactor({
  constraints: [
    labourConstraint("site_access", "Difficult"),
    labourConstraint("material_carry_distance", "> 30m"),
  ],
});
const easyLong = getCombinedLabourAccessFactor({
  constraints: [
    labourConstraint("site_access", "Easy"),
    labourConstraint("material_carry_distance", "> 30m"),
  ],
});
check(
  "access and carry add, and unknown carry is not a confirmed short answer",
  parseCarryDistanceCategory(null) === "short" &&
    parseCarryDistanceCategory("Not sure") === "unknown" &&
    parseCarryDistanceCategory("< 10m") === "short" &&
    Math.round(difficultLong * 100) / 100 === 1.2 &&
    Math.round(easyLong * 100) / 100 === 1.1 &&
    Math.round(30 * 0.2 * difficultLong * 100) / 100 === 7.2 &&
    Math.round(30 * 0.2 * easyLong * 100) / 100 === 6.6
);

const staleRegistered = pricingTaxBasisDecision({
  gstRegistered: true,
  defaultGstRate: 15,
  documentGstRate: 0,
  taxBasis: null,
  status: "draft",
});
const keptZero = pricingTaxBasisDecision({
  gstRegistered: true,
  defaultGstRate: 15,
  documentGstRate: 0,
  taxBasis: staleRegistered.overrideMarker,
  status: "reviewed",
});
const alignedUnregistered = pricingTaxBasisDecision({
  gstRegistered: false,
  defaultGstRate: 15,
  documentGstRate: 0,
  taxBasis: null,
  status: "draft",
});
const unknownTax = pricingTaxBasisDecision({
  gstRegistered: null,
  defaultGstRate: 15,
  documentGstRate: 15,
  taxBasis: null,
  status: "reviewed",
});
const issuedTax = pricingTaxBasisDecision({
  gstRegistered: true,
  defaultGstRate: 15,
  documentGstRate: 0,
  taxBasis: null,
  status: "converted_to_quote",
});
check(
  "a registration change leaves a different draft rate unfinalisable until review",
  staleRegistered.mismatch &&
    staleRegistered.actionable &&
    staleRegistered.quoteBlock != null &&
    !staleRegistered.useDocumentRate &&
    keptZero.override &&
    !keptZero.mismatch &&
    keptZero.quoteBlock == null &&
    keptZero.useDocumentRate &&
    keptZero.detail?.includes("Document tax override") === true &&
    !alignedUnregistered.mismatch &&
    alignedUnregistered.quoteBlock == null &&
    unknownTax.registration === "unset" &&
    unknownTax.quoteBlock != null &&
    !unknownTax.actionable &&
    issuedTax.mismatch &&
    !issuedTax.actionable
);

const shell = readFileSync("components/assistant/AssistantShell.tsx", "utf8");
const flooringEditor = readFileSync(
  "components/assistant/job-plan/FlooringQuickSpecEditor.tsx",
  "utf8"
);
const quickSpecEditors = readFileSync(
  "components/assistant/job-plan/quick-spec-editors.ts",
  "utf8"
);
const quote = readFileSync("lib/quotes/build-from-pricing.ts", "utf8");
const review = readFileSync("lib/pricing/actions.ts", "utf8");
const gate = readFileSync("lib/estimate/condition-commercial-gate.ts", "utf8");
const setup = readFileSync("lib/setup/actions.ts", "utf8");
const saveGst = setup.slice(setup.indexOf("export async function saveGstRegistration"));
check(
  "regenerate stays tied to a stale estimate and a labour or disclosure-basis answer",
  shell.includes("canRunEstimates && displayEstimateStale ? handleRegenerateEstimate") &&
    shell.includes("conditionAnswerAffectsEstimateBasis(input.key)") &&
    shell.includes("setLocalEstimateStale(true)") &&
    shell.includes("ConditionDecisions")
);
check(
  "registration does not rewrite drafts, and review blocks a stale tax basis",
  saveGst.includes("organisation_settings") &&
    !saveGst.includes("pricing_documents") &&
    review.includes("pricingTaxBasisDecision") &&
    review.includes("applyRegistrationGstToPricing") &&
    review.includes("keepPricingDocumentGstRate") &&
    review.includes("Issued pricing keeps its tax snapshot.")
);
check(
  "pricing review and quote creation read conditions and do not write them",
  review.includes("materialConditionQuoteBlock") &&
    quote.indexOf("GST_REGISTRATION_UNSET_QUOTE_BLOCK") <
      quote.indexOf("materialConditionQuoteBlock") &&
    !gate.includes(".insert(") &&
    !gate.includes(".update(")
);
check(
  "the labour note explains the basis used for an unanswered job",
  /Access and carry adjustment on this line is 1.00/.test(labourBasisNote([]))
);
check(
  "flooring measurements stay editable after estimate without adding a portion",
  quickSpecEditors.includes("flooring: FlooringQuickSpecEditor") &&
    flooringEditor.includes("data-flooring-width") &&
    flooringEditor.includes("Save room size") &&
    flooringEditor.includes("nestedItemId: portion.id") &&
    shell.includes("nestedItemId: input.nestedItemId ?? undefined") &&
    !flooringEditor.includes("Add flooring area")
);

const ASSEMBLY_LAMINATE =
  "Supply and install floating click-lock laminate in one meeting room. Room size: 4.0 m long by 5.0 m wide. Net floor area 20.00 m². The contractor supplies the laminate and prices the finish as separate supply and separate installation. Allow 10% waste once on the laminate supply only. The existing substrate is ready concrete. No floor preparation. No removal of an existing finish. No disposal. No transition strips. Underlay is required. Moisture control is a separate moisture barrier. Site conditions: easy access, materials carried under 10 m, the site is not occupied, working hours are unrestricted.";
const assemblyPortion = extractFlooringPortionsFromBrief(ASSEMBLY_LAMINATE)[0];
const assemblyConstraints = extractConstraintsFromBrief(ASSEMBLY_LAMINATE);
check(
  "a stated underlay is kept and a negated transition is not requested",
  assemblyPortion?.underlay_required === true &&
    assemblyPortion.transitions_required === false &&
    assemblyPortion.waste_percent === 10 &&
    assemblyPortion.floor_preparation_required === false,
  assemblyPortion
);
check(
  "an included transition strip stays requested",
  extractFlooringPortionsFromBrief(
    "Bedroom 1 is 3.6m × 3.2m and gets carpet. Include underlay where appropriate, transition strips and 10% waste."
  ).every((row) => row.transitions_required === true)
);
check(
  "carried under 10 m stays the short band, with occupancy and hours answered no",
  assemblyConstraints.find((row) => row.key === "site_access")?.value === "Easy" &&
    assemblyConstraints.find((row) => row.key === "material_carry_distance")?.value ===
      "< 10m" &&
    assemblyConstraints.find((row) => row.key === "occupied_site")?.value === "No" &&
    assemblyConstraints.find((row) => row.key === "working_hours")?.value === "No" &&
    parseCarryDistanceCategory("< 10m") === "short",
  assemblyConstraints
);

if (failures.length > 0) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log("\nStage 3C checks passed");
