/**
 * EF02-E — repeated same-kind Work Area acceptance.
 *
 * Run: npx --yes tsx scripts/verify-repeated-work-area-acceptance-r1.ts
 *
 * Does not apply migration 057. No Production. No paid AI.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { groupRefineCandidatesForDisplay } from "../components/assistant/refine/refine-presentation";
import {
  applyScopeDiscoveryAccept,
  evaluateAcceptEligibility,
  evaluateModifyEligibility,
  type SuggestionEligibilitySnapshot,
} from "../lib/scope-discovery/decisions/eligibility";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { bindFactToWorkAreaId } from "../lib/work-areas/instances";
import { discoverWorkAreaInstances } from "../lib/work-areas/discovery-instances";
import {
  isDuplicateWorkAreaInstance,
  shouldInsertWorkAreaInstance,
  existingWorkAreaInstanceKeys,
} from "../lib/work-areas/instances";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { PricingItem } from "../lib/pricing/types";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { internalWallsIdentityInvariantFixtures } from "./lib/internal-walls-iw-id-invariants";

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

const ORG = "org-1";
const PROJECT = "proj-1";

function baseSnap(
  overrides: Partial<SuggestionEligibilitySnapshot>
): SuggestionEligibilitySnapshot {
  return {
    suggestionId: "sug-1",
    orgId: ORG,
    projectId: PROJECT,
    runOrgId: ORG,
    runProjectId: PROJECT,
    suggestionKind: "WORK_AREA",
    proposedWorkAreaType: "bathroom",
    proposedTitle: "Master Ensuite",
    staleReason: null,
    supersededBySuggestionId: null,
    hasScopeCreatingDecision: false,
    hasAcceptDecision: false,
    hasRejectDecision: false,
    confirmedInstances: [],
    ...overrides,
  };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function composeSurfaces(params: {
  workAreas: { id: string; type: string; name: string; status: "confirmed" }[];
  facts: EstimateFact[];
  briefText: string;
}) {
  const constraints = [
    { key: "site_access", value: "Easy" },
    { key: "material_carry_distance", value: "< 10m" },
    { key: "occupied_site", value: "No" },
    { key: "working_hours", value: "No" },
  ];
  const plan = composeJobPlan({
    workAreas: params.workAreas,
    facts: params.facts,
    constraints,
    briefText: params.briefText,
  });
  const clarify = composeClarifyView({
    stage: "quality",
    briefText: params.briefText,
    qualityLevel: "standard",
    workAreas: params.workAreas,
    facts: params.facts,
    constraints,
    jobPlan: plan,
  });
  const refine = composeRefineView({
    briefText: params.briefText,
    qualityLevel: "standard",
    workAreas: params.workAreas,
    facts: params.facts,
    constraints,
    jobPlan: {
      cards: plan.cards.map((card) => ({
        workAreaId: card.workAreaId,
        workAreaType: card.workAreaType,
        name: card.name,
        notConfirmed: card.notConfirmed,
      })),
    },
  });
  return { clarify, refine, plan };
}

function pricingItem(id: string, workAreaId: string, label: string): PricingItem {
  return {
    id,
    org_id: "org",
    pricing_document_id: "pd",
    project_id: PROJECT,
    work_area_id: workAreaId,
    source_estimate_line_item_id: null,
    component_key: null,
    item_type: "labour",
    delivery_method: "in_house",
    internal_label: label,
    client_label: label,
    internal_description: null,
    client_description: null,
    quantity: 1,
    unit: "hr",
    unit_cost: 10,
    unit_sell: 12,
    total_cost: 10,
    total_sell: 12,
    gross_profit: 2,
    margin_percent: 16.67,
    markup_percent: 20,
    visible_on_quote: true,
    optional: false,
    sort_order: id === "p1" ? 1 : 2,
    notes_internal: null,
    notes_client: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    manually_edited: false,
    orphaned: false,
  } as PricingItem;
}

console.log("=== EF02-E repeated same-kind Work Area acceptance ===\n");

const mig029 = read("supabase/migrations/029_scope_discovery_acceptance_rpc.sql");
const mig057 = read("supabase/migrations/057_repeated_work_area_acceptance.sql");
check(
  "historical 029 still type-only (not edited in place)",
  mig029.includes("and w.type = v_type") &&
    !mig029.includes("scope_discovery_confirmed_instance_id")
);
check(
  "057 replaces type uniqueness with instance helper",
  mig057.includes("scope_discovery_confirmed_instance_id") &&
    mig057.includes("Do not apply") &&
    !mig057.includes("and w.status = 'confirmed'\n  limit 1")
);

const bathrooms = discoverWorkAreaInstances(
  "Renovate the master ensuite and the family bathroom."
).filter((row) => row.type === "bathroom");
check(
  "A: Master Ensuite + Family Bathroom discovered",
  bathrooms.length === 2 &&
    bathrooms.some((row) => row.name === "Master Ensuite") &&
    bathrooms.some((row) => row.name === "Family Bathroom")
);

const decks = discoverWorkAreaInstances(
  "Replace the rear deck and build a new front deck."
).filter((row) => row.type === "deck");
check(
  "B: Rear Deck + Front Deck discovered",
  decks.length === 2 &&
    decks.some((row) => row.name === "Rear Deck") &&
    decks.some((row) => row.name === "Front Deck")
);

const partitions = discoverWorkAreaInstances(
  "New ground floor partitions and upstairs partitions."
).filter((row) => row.type === "internal_walls");
check(
  "C: Ground Floor Partitions + Upstairs Partitions discovered",
  partitions.length === 2 &&
    partitions.some((row) => row.name === "Ground Floor Partitions") &&
    partitions.some((row) => row.name === "Upstairs Partitions"),
  partitions.map((row) => row.name).join(", ")
);

const accepted: Array<{
  id: string;
  type: string;
  name: string;
  suggestionId: string;
}> = [];
const acceptedIds = new Set<string>();

function acceptOne(suggestionId: string, type: string, title: string) {
  const result = applyScopeDiscoveryAccept({
    suggestionId,
    type,
    title,
    acceptedSuggestionIds: acceptedIds,
    confirmed: accepted,
  });
  if (result.ok) {
    acceptedIds.add(suggestionId);
    accepted.push({
      id: result.workAreaId,
      type,
      name: title,
      suggestionId,
    });
  }
  return result;
}

const ensuite = acceptOne("s-ensuite", "bathroom", "Master Ensuite");
const family = acceptOne("s-family", "bathroom", "Family Bathroom");
check(
  "second same-type distinct suggestion succeeds",
  ensuite.ok && family.ok && ensuite.ok && family.ok
    ? ensuite.workAreaId !== family.workAreaId
    : false
);
check(
  "Bathroom labels preserved",
  accepted.some((row) => row.name === "Master Ensuite") &&
    accepted.some((row) => row.name === "Family Bathroom") &&
    !accepted.every((row) => row.name === "Bathroom")
);

const rear = acceptOne("s-rear", "deck", "Rear Deck");
const front = acceptOne("s-front", "deck", "Front Deck");
check(
  "Deck two instances succeed",
  rear.ok && front.ok && rear.workAreaId !== front.workAreaId
);

const ground = acceptOne(
  "s-gf",
  "internal_walls",
  "Ground Floor Partitions"
);
const upstairs = acceptOne("s-up", "internal_walls", "Upstairs Partitions");
check(
  "Internal Walls two instances succeed",
  ground.ok && upstairs.ok && ground.workAreaId !== upstairs.workAreaId
);

const dup = acceptOne("s-ensuite-2", "bathroom", "Master Ensuite");
check(
  "D: exact duplicate suggestion does not double-create",
  !dup.ok && dup.reason === "DUPLICATE_WORK_AREA"
);
check(
  "still one Master Ensuite row",
  accepted.filter((row) => row.name === "Master Ensuite").length === 1
);

const sameSuggestion = acceptOne("s-ensuite", "bathroom", "Master Ensuite");
check(
  "same suggestion id remains one-time (ALREADY_ACCEPTED)",
  !sameSuggestion.ok && sameSuggestion.reason === "ALREADY_ACCEPTED"
);

const modifyOk = evaluateModifyEligibility(
  baseSnap({
    suggestionId: "s-main",
    proposedTitle: "Bathroom",
    confirmedInstances: [{ type: "bathroom", name: "Master Ensuite" }],
  }),
  ORG,
  PROJECT,
  "Main Bathroom",
  "bathroom"
);
check(
  "modify-and-accept distinct same-type name succeeds",
  modifyOk.ok
);
const modifyDup = evaluateModifyEligibility(
  baseSnap({
    suggestionId: "s-main-2",
    proposedTitle: "Bathroom",
    confirmedInstances: [{ type: "bathroom", name: "Master Ensuite" }],
  }),
  ORG,
  PROJECT,
  "Master Ensuite",
  "bathroom"
);
check(
  "modify-and-accept exact same instance is rejected",
  !modifyDup.ok && modifyDup.reason === "DUPLICATE_WORK_AREA"
);

const acceptSecond = evaluateAcceptEligibility(
  baseSnap({
    suggestionId: "s-family",
    proposedTitle: "Family Bathroom",
    confirmedInstances: [{ type: "bathroom", name: "Master Ensuite" }],
  }),
  ORG,
  PROJECT
);
check("eligibility allows second bathroom instance", acceptSecond.ok);
const acceptTypeCollision = evaluateAcceptEligibility(
  baseSnap({
    suggestionId: "s-again",
    proposedTitle: "master ensuite",
    confirmedInstances: [{ type: "bathroom", name: "Master Ensuite" }],
  }),
  ORG,
  PROJECT
);
check(
  "eligibility rejects same instance (case-insensitive name)",
  !acceptTypeCollision.ok && acceptSecond.ok
);

const existing = existingWorkAreaInstanceKeys([
  { type: "bathroom", name: "Master Ensuite" },
]);
check(
  "insert helper allows Family Bathroom",
  shouldInsertWorkAreaInstance({ type: "bathroom", name: "Family Bathroom" }, existing)
);
check(
  "insert helper blocks Master Ensuite",
  !shouldInsertWorkAreaInstance({ type: "bathroom", name: "Master Ensuite" }, existing)
);
check(
  "type-only is not a duplicate",
  !isDuplicateWorkAreaInstance({
    type: "bathroom",
    name: "Family Bathroom",
    confirmed: [{ type: "bathroom", name: "Master Ensuite" }],
  })
);

const workAreas = [
  { id: "b1", type: "bathroom", name: "Master Ensuite" },
  { id: "b2", type: "bathroom", name: "Family Bathroom" },
];
check(
  "fact isolation: ensuite area binds to b1",
  bindFactToWorkAreaId({
    fact: {
      work_area_type: "bathroom",
      work_area_name: "Master Ensuite",
      key: "bathroom.floor_area_m2",
    },
    workAreas,
  }) === "b1"
);
check(
  "fact isolation: family area binds to b2",
  bindFactToWorkAreaId({
    fact: {
      work_area_type: "bathroom",
      work_area_name: "Family Bathroom",
      key: "bathroom.floor_area_m2",
    },
    workAreas,
  }) === "b2"
);

const twoBaths = composeSurfaces({
  workAreas: [
    { id: "b1", type: "bathroom", name: "Master Ensuite", status: "confirmed" },
    { id: "b2", type: "bathroom", name: "Family Bathroom", status: "confirmed" },
  ],
  facts: [
    fact("bathroom.job_scope", "b1", "full_renovation"),
    fact("bathroom.length_m", "b1", 3.2),
    fact("bathroom.width_m", "b1", 2.4),
    fact("bathroom.job_scope", "b2", "full_renovation"),
    fact("bathroom.length_m", "b2", 2.4),
    fact("bathroom.width_m", "b2", 2.1),
  ],
  briefText: "Master ensuite and family bathroom renovations.",
});
check(
  "Details keeps two Bathroom groups",
  twoBaths.clarify.groups.filter(
    (group) =>
      group.workAreaType === "bathroom" &&
      (group.workAreaId === "b1" || group.workAreaId === "b2")
  ).length === 2 &&
    twoBaths.clarify.groups.some(
      (group) => group.workAreaId === "b1" && group.workAreaName === "Master Ensuite"
    ) &&
    twoBaths.clarify.groups.some(
      (group) => group.workAreaId === "b2" && group.workAreaName === "Family Bathroom"
    )
);
const ensuiteQs = twoBaths.clarify.groups
  .find((group) => group.workAreaId === "b1")
  ?.sections.flatMap((section) => section.candidates) ?? [];
const familyQs = twoBaths.clarify.groups
  .find((group) => group.workAreaId === "b2")
  ?.sections.flatMap((section) => section.candidates) ?? [];
check(
  "Details questions are instance-scoped",
  ensuiteQs.every((row) => row.workAreaId === "b1") &&
    familyQs.every((row) => row.workAreaId === "b2")
);

const refineGroups = groupRefineCandidatesForDisplay({
  candidates: [...twoBaths.refine.highValue, ...twoBaths.refine.advanced],
});
check(
  "Refine keeps two Bathroom groups",
  refineGroups.some(
    (group) => group.workAreaId === "b1" && group.workAreaName === "Master Ensuite"
  ) &&
    refineGroups.some(
      (group) => group.workAreaId === "b2" && group.workAreaName === "Family Bathroom"
    )
);

const b1 = { id: "b1", type: "bathroom", name: "Master Ensuite", sort_order: 1 };
const b2 = { id: "b2", type: "bathroom", name: "Family Bathroom", sort_order: 2 };
const ctx = {
  project: { id: PROJECT, qualityLevel: "standard" },
  confirmedWorkAreas: [b1, b2],
  facts: [
    fact("bathroom.job_scope", "b1", "full_renovation"),
    fact("bathroom.length_m", "b1", 3.2),
    fact("bathroom.width_m", "b1", 2.4),
    fact("bathroom.job_scope", "b2", "full_renovation"),
    fact("bathroom.length_m", "b2", 2.4),
    fact("bathroom.width_m", "b2", 2.1),
  ],
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
const ensuiteCalc = calculateBathroom(ctx, b1 as EstimateWorkArea);
const familyCalc = calculateBathroom(ctx, b2 as EstimateWorkArea);
const ensuiteIds = new Set(ensuiteCalc.lineItems.map((row) => row.workAreaId));
const familyIds = new Set(familyCalc.lineItems.map((row) => row.workAreaId));
check(
  "calculator lines stay on their instance",
  (ensuiteIds.size === 0 || (ensuiteIds.size === 1 && ensuiteIds.has("b1"))) &&
    (familyIds.size === 0 || (familyIds.size === 1 && familyIds.has("b2")))
);
check(
  "no type-merged bathroom totals",
  ensuiteCalc.lineItems.every((row) => row.workAreaId === "b1") &&
    familyCalc.lineItems.every((row) => row.workAreaId === "b2")
);

const quoteItems = mapPricingItemsToQuoteItems(
  [
    pricingItem("p1", "b1", "Ensuite labour"),
    pricingItem("p2", "b2", "Family labour"),
  ],
  new Map([
    ["b1", "Master Ensuite"],
    ["b2", "Family Bathroom"],
  ])
);
check(
  "Pricing/Quote provenance stays instance-scoped",
  quoteItems.length === 2 &&
    quoteItems[0]?.work_area_id === "b1" &&
    quoteItems[1]?.work_area_id === "b2" &&
    quoteItems[0]?.section_title === "Master Ensuite" &&
    quoteItems[1]?.section_title === "Family Bathroom"
);

const live = internalWallsIdentityInvariantFixtures();
check(
  "single-instance IW output fingerprint unchanged",
  live.A.labourHours === 12.96 &&
    live.A.commercial.recommendedCost === 1844.69 &&
    live.A.commercial.recommendedSell === 2500.26
);

check(
  "029 file was not rewritten",
  read("supabase/migrations/029_scope_discovery_acceptance_rpc.sql").includes(
    "and w.type = v_type"
  )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
