/**
 * Stage 3.1B.7F-R4 — Explicit scope negatives & site constraint remediation.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  enrichExtractionFromBrief,
  extractConstraintsFromBrief,
} from "../lib/ai/enrich-extraction";
import { composeCurrentWorkAreaScopeState } from "../lib/assistant/current-work-area-scope-state";
import type { ScopeReview } from "../lib/assistant/types";
import {
  classifyFactScopeImpact,
  explicitScopeDecisionFromFactValue,
  explicitScopeDecisionFromFacts,
  isExplicitNoFact,
  isExplicitYesFact,
} from "../lib/scope-discovery/scope-impact";
import { defaultBatchSelection } from "../lib/scope-discovery/ui/scope-review-completion";
import type { SafeSuggestionView } from "../lib/scope-discovery/application/types";
import { isQuestionSuppressedByScopeItemExclusion } from "../lib/scope-discovery/ui/scope-item-question-gates";
import { shouldHideConditionalQuestion } from "../lib/scopes/conditional-rules";
import type { ScopeQuestionTemplate } from "../lib/scopes/types";
import { buildFactLookup } from "../lib/scopes/fact-values";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const OWNER_DECK_BRIEF = [
  "Replace an existing elevated timber deck, approximately 5.2m × 3.1m and around 1.2m above ground.",
  "Remove the existing deck. New hardwood decking and new substructure where required.",
  "Include fascia and one step. No balustrade required.",
  "Restricted rear access with approximately 25–30m manual carry for materials and waste.",
].join(" ");

function emptyExtraction() {
  return {
    workAreas: [] as { type: string; confidence: number; rationale: string }[],
    facts: [] as {
      work_area_type: string | null;
      key: string;
      label: string;
      value: string | number | boolean | string[];
      unit?: string;
      confidence?: number;
    }[],
    assumptions: [] as string[],
    possibleConstraints: [] as string[],
    warnings: [] as string[],
  };
}

function balustradeSuggestion(
  overrides: Partial<SafeSuggestionView> = {}
): SafeSuggestionView {
  return {
    suggestionId: "sug-bal",
    proposalClass: "SCOPE_ITEM",
    suggestionKind: "MISSING_SCOPE",
    proposedTitle: "Balustrade",
    proposedWorkAreaType: "balustrade",
    relatedWorkAreaId: "wa-deck",
    decisionState: "PROPOSED",
    confidenceBand: "MEDIUM",
    rationaleCode: "deck.height.balustrade",
    latestReasonCode: null,
    ...overrides,
  } as SafeSuggestionView;
}

console.log("\n=== Stage 3.1B.7F-R4 — Scope negatives & constraints ===\n");

// ─── EXPLICIT NEGATIVES (enrichment) ─────────────────────────
console.log("EXPLICIT NEGATIVES");
const enrichedOwner = enrichExtractionFromBrief({
  briefText: OWNER_DECK_BRIEF,
  extraction: emptyExtraction(),
  allowedTypes: ["deck", "demolition", "balustrade", "fascia", "coatings"],
});
const balFact = enrichedOwner.extraction.facts.find(
  (f) => f.key === "deck.balustrade_required"
);
check(
  "No balustrade required → deck.balustrade_required=false",
  balFact?.value === false
);
check(
  "Owner brief extracts existing deck removal=true",
  enrichedOwner.extraction.facts.some(
    (f) => f.key === "deck.existing_deck_removal" && f.value === true
  )
);
check(
  "Owner brief extracts fascia / face boards=true",
  enrichedOwner.extraction.facts.some(
    (f) =>
      f.key === "deck.vertical_face_boards_required" && f.value === true
  )
);

const aiWrongTrue = emptyExtraction();
aiWrongTrue.facts.push({
  work_area_type: "deck",
  key: "deck.balustrade_required",
  label: "Balustrade required",
  value: true,
});
const corrected = enrichExtractionFromBrief({
  briefText: "Build an elevated timber deck. No balustrade required.",
  extraction: aiWrongTrue,
  allowedTypes: ["deck"],
});
check(
  "Explicit no polarity-corrects prior true balustrade Fact",
  corrected.extraction.facts.find((f) => f.key === "deck.balustrade_required")
    ?.value === false
);

const unknownBal = enrichExtractionFromBrief({
  briefText: "Build an elevated timber deck approximately 1.2m high.",
  extraction: emptyExtraction(),
  allowedTypes: ["deck"],
});
check(
  "Unknown balustrade → no invented false Fact",
  !unknownBal.extraction.facts.some(
    (f) => f.key === "deck.balustrade_required"
  )
);

const yesBal = enrichExtractionFromBrief({
  briefText: "Elevated deck with hardwood balustrade.",
  extraction: emptyExtraction(),
  allowedTypes: ["deck"],
});
check(
  "Explicit balustrade → deck.balustrade_required=true",
  yesBal.extraction.facts.some(
    (f) => f.key === "deck.balustrade_required" && f.value === true
  )
);

check(
  "no new balustrade → false (not naive true)",
  enrichExtractionFromBrief({
    briefText:
      "Build a deck. Existing balustrade to remain, no new balustrade.",
    extraction: emptyExtraction(),
    allowedTypes: ["deck"],
  }).extraction.facts.find((f) => f.key === "deck.balustrade_required")
    ?.value === false
);

check(
  "Balustrade condition unknown → no fabricated boolean",
  !enrichExtractionFromBrief({
    briefText: "Build a deck. Balustrade condition unknown.",
    extraction: emptyExtraction(),
    allowedTypes: ["deck"],
  }).extraction.facts.some((f) => f.key === "deck.balustrade_required")
);

check(
  "New balustrade required → true",
  enrichExtractionFromBrief({
    briefText: "Build a deck. New balustrade required.",
    extraction: emptyExtraction(),
    allowedTypes: ["deck"],
  }).extraction.facts.some(
    (f) => f.key === "deck.balustrade_required" && f.value === true
  )
);

// ─── FACT AUTHORITY / BATCH DEFAULTS ─────────────────────────
console.log("\nFACT AUTHORITY");
check("unknown != false", !isExplicitNoFact(null) && !isExplicitNoFact(""));
check("explicit no recognised", isExplicitNoFact(false) && isExplicitNoFact("no"));
check("explicit yes recognised", isExplicitYesFact(true) && isExplicitYesFact("yes"));

check(
  "balustrade=false → NOT_REQUIRED decision",
  explicitScopeDecisionFromFactValue({
    factKey: "deck.balustrade_required",
    value: false,
  }) === "NOT_REQUIRED"
);
check(
  "balustrade=true → INCLUDED decision",
  explicitScopeDecisionFromFactValue({
    factKey: "deck.balustrade_required",
    value: true,
  }) === "INCLUDED"
);
check(
  "balustrade unknown → null (catalogue may recommend)",
  explicitScopeDecisionFromFactValue({
    factKey: "deck.balustrade_required",
    value: "",
  }) === null
);

const factsNo = [
  {
    key: "deck.balustrade_required",
    value: false,
    work_area_id: "wa-deck",
  },
];
check(
  "defaultBatchSelection: explicit no → not selected",
  defaultBatchSelection(balustradeSuggestion(), factsNo) === "NOT_REQUIRED"
);
check(
  "defaultBatchSelection: unknown → can remain recommendation/included",
  defaultBatchSelection(balustradeSuggestion(), []) === "INCLUDED"
);
check(
  "defaultBatchSelection: explicit yes → included",
  defaultBatchSelection(balustradeSuggestion(), [
    {
      key: "deck.balustrade_required",
      value: true,
      work_area_id: "wa-deck",
    },
  ]) === "INCLUDED"
);
check(
  "User can reverse: ACCEPTED wins over Fact=false",
  defaultBatchSelection(
    balustradeSuggestion({ decisionState: "ACCEPTED" }),
    factsNo
  ) === "INCLUDED"
);
check(
  "Historical REJECTED preserved",
  defaultBatchSelection(
    balustradeSuggestion({ decisionState: "REJECTED" }),
    [
      {
        key: "deck.balustrade_required",
        value: true,
        work_area_id: "wa-deck",
      },
    ]
  ) === "NOT_REQUIRED"
);

const scopeReviewNo: ScopeReview = {
  workAreas: [
    {
      workAreaId: "wa-deck",
      workAreaName: "Deck",
      workAreaType: "deck",
      facts: [
        {
          id: "f1",
          key: "deck.balustrade_required",
          label: "Balustrade required",
          value: false,
        },
      ],
      activeQuestions: [],
      answeredQuestions: [],
    },
  ],
} as ScopeReview;

const composedNo = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "sug-bal",
      proposedTitle: "Balustrade",
      decisionState: "PROPOSED",
      proposalClass: "SCOPE_ITEM",
      suggestionKind: "MISSING_SCOPE",
      proposedWorkAreaType: "balustrade",
      relatedWorkAreaId: "wa-deck",
      latestReasonCode: "included_pending_detail",
      rationaleCode: "deck.height.balustrade",
    },
  ],
  scopeReview: scopeReviewNo,
});
const balItem = composedNo.items.find((i) => i.title === "Balustrade");
check(
  "Composer: Fact=false → NOT_REQUIRED (not pending-included)",
  balItem?.decisionState === "NOT_REQUIRED" &&
    balItem.detailState === "COMPLETE"
);
check(
  "Composer keeps suggestion visible for manual include",
  balItem != null
);

const composedAccepted = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "sug-bal",
      proposedTitle: "Balustrade",
      decisionState: "ACCEPTED",
      proposalClass: "SCOPE_ITEM",
      proposedWorkAreaType: "balustrade",
      relatedWorkAreaId: "wa-deck",
    },
  ],
  scopeReview: scopeReviewNo,
});
check(
  "Composer: confirmed ACCEPTED preserved over Fact=false",
  composedAccepted.items.find((i) => i.title === "Balustrade")
    ?.decisionState === "INCLUDED"
);

const composedDemo = composeCurrentWorkAreaScopeState({
  suggestions: [
    {
      suggestionId: "sug-demo",
      proposedTitle: "Demolition / existing deck removal",
      decisionState: "PROPOSED",
      proposalClass: "SCOPE_ITEM",
      proposedWorkAreaType: "demolition",
      relatedWorkAreaId: "wa-deck",
    },
  ],
  scopeReview: {
    workAreas: [
      {
        workAreaId: "wa-deck",
        workAreaName: "Deck",
        workAreaType: "deck",
        facts: [
          {
            id: "f-rem",
            key: "deck.existing_deck_removal",
            label: "Existing deck removal",
            value: true,
          },
        ],
        activeQuestions: [],
        answeredQuestions: [],
      },
    ],
  } as ScopeReview,
});
check(
  "Demolition: existing_deck_removal=true → INCLUDED in composer",
  composedDemo.items.find(
    (i) => i.canonicalType === "demolition" || i.title.includes("Demolition")
  )?.decisionState === "INCLUDED"
);

check(
  "Collector passes Facts to catalogue (not stale-only filter)",
  read("lib/scope-discovery/application/source-collector.ts").includes(
    "included for catalogue evaluation"
  ) &&
    read("lib/scope-discovery/orchestration/source-snapshot.ts").includes(
      "isFactMaterialForDiscoveryStale"
    )
);

const deckRel = read("lib/scope-discovery/catalogue/relationships/deck.ts");
const balBlock = deckRel.slice(
  deckRel.indexOf('relationshipId: "deck.balustrade"'),
  deckRel.indexOf('rationaleCode: "deck.height.balustrade"')
);
check(
  "Balustrade stays checklist-visible on explicit no (no catalogue suppress)",
  balBlock.includes('accepted_wa_exists') &&
    !balBlock.includes("fact_is_explicit_no")
);

check(
  "explicitScopeDecisionFromFacts wires type→key",
  explicitScopeDecisionFromFacts({
    proposedWorkAreaType: "balustrade",
    relatedWorkAreaId: "wa-deck",
    facts: factsNo,
  }) === "NOT_REQUIRED"
);

// ─── CONSTRAINTS ─────────────────────────────────────────────
console.log("\nCONSTRAINTS");
const ownerConstraints = extractConstraintsFromBrief(OWNER_DECK_BRIEF);
check(
  "Owner Deck brief → site_access Difficult",
  ownerConstraints.some(
    (c) => c.key === "site_access" && c.value === "Difficult"
  )
);
check(
  "Owner Deck brief → material_carry_distance 10–30m",
  ownerConstraints.some(
    (c) =>
      c.key === "material_carry_distance" &&
      (c.value === "10–30m" || String(c.value).includes("30"))
  )
);
check(
  "Constraint labels are human-readable (not raw keys only)",
  ownerConstraints.every(
    (c) => typeof c.label === "string" && c.label.length > 0 && c.label !== c.key
  )
);

const packConstraints = extractConstraintsFromBrief(
  "Site access is restricted down a narrow side path; waste carting about 25–30 m."
);
check(
  "Owner E2E pack wording → access + carry",
  packConstraints.some((c) => c.key === "site_access") &&
    packConstraints.some((c) => c.key === "material_carry_distance")
);

// ─── NEGATIVE GUARDS ─────────────────────────────────────────
console.log("\nNEGATIVE GUARDS");
check(
  "deck is approximately 5–6m long → no carry",
  !extractConstraintsFromBrief(
    "deck is approximately 5–6m long"
  ).some((c) => c.key === "material_carry_distance")
);
check(
  "ordinary dimensions → no carting inference",
  !extractConstraintsFromBrief(
    "Build a timber deck approximately 5–6 m long with hardwood boards."
  ).some((c) => c.key === "material_carry_distance")
);
check(
  "deck is 5m x 3m → no carry",
  !extractConstraintsFromBrief("deck is 5m x 3m").some(
    (c) => c.key === "material_carry_distance"
  )
);
check(
  "materials manually carried ~25m → carry",
  extractConstraintsFromBrief(
    "materials need to be manually carried approximately 25m"
  ).some((c) => c.key === "material_carry_distance")
);

// ─── USER AUTHORITY (constraint persistence) ─────────────────
console.log("\nUSER AUTHORITY");
const actionsSrc = read("lib/assistant/actions.ts");
check(
  "Analyse Job skips overwrite of user-sourced constraints",
  actionsSrc.includes('existing?.source === "user"') &&
    actionsSrc.includes('.select("id, key, source")')
);

// ─── QUESTION GATING ─────────────────────────────────────────
console.log("\nQUESTION GATING");
check(
  "Excluded balustrade suppresses balustrade_required question key",
  isQuestionSuppressedByScopeItemExclusion({
    factKey: "deck.balustrade_required",
    excludedTypes: new Set(["balustrade"]),
  })
);

const balQ = {
  key: "deck.balustrade_required",
  factKey: "deck.balustrade_required",
  label: "Balustrade",
  questionText: "Is a balustrade required?",
  inputType: "boolean",
} as ScopeQuestionTemplate;
const lookupFalse = buildFactLookup([
  {
    key: "deck.balustrade_required",
    work_area_id: "wa-deck",
    value: false,
    source: "ai_extracted",
  },
]);
check(
  "Explicit balustrade=false hides balustrade detail question",
  shouldHideConditionalQuestion(balQ, "wa-deck", lookupFalse) === true
);

// ─── STALE / DETAIL_ONLY ─────────────────────────────────────
console.log("\nSTALE");
check(
  "DETAIL_ONLY length answer remains DETAIL_ONLY",
  classifyFactScopeImpact({
    factKey: "deck.length_m",
    oldValue: null,
    newValue: 5.2,
  }).classification === "DETAIL_ONLY"
);
check(
  "balustrade Fact change is SCOPE_EXCLUDING not FULL_REANALYSIS",
  classifyFactScopeImpact({
    factKey: "deck.balustrade_required",
    oldValue: true,
    newValue: false,
  }).classification === "SCOPE_EXCLUDING"
);

// ─── BOUNDARIES ──────────────────────────────────────────────
console.log("\nBOUNDARIES");
check(
  "No airport/security taxonomy invented",
  extractConstraintsFromBrief(
    "Airport security screening and noise restrictions overnight."
  ).every(
    (c) => c.key !== "airport_security" && c.key !== "noise_restrictions"
  )
);
check(
  "No migration 034 in tree",
  !readdirSync(join(process.cwd(), "supabase/migrations")).some((f) =>
    f.startsWith("034")
  )
);
check(
  "R4 verify script present",
  read("scripts/verify-stage-3-1b7fr4-scope-negatives-constraints.ts").includes(
    "Stage 3.1B.7F-R4"
  )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
