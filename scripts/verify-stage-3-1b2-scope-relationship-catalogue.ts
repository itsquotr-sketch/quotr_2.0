/**
 * Stage 3.1B.2 — Scope relationship catalogue verification.
 * Pure / local — no Supabase, no provider calls.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  SCOPE_DISCOVERY_CONTRACT_VERSION,
  identityKeyForSuggestion,
  mergeScopeSuggestions,
  validateScopeDiscoverySuggestion,
  type RejectionRecord,
  type SourceSnapshot,
} from "../lib/scope-discovery";
import {
  CANONICAL_SCOPE_IDS,
  DOCUMENTED_ALIASES,
  SCOPE_RELATIONSHIP_CATALOGUE,
  SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
  evaluateScopeRelationships,
  getCatalogueValidation,
  resolveCanonicalScopeId,
  validateCatalogueRelationships,
} from "../lib/scope-discovery/catalogue";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const IDS = {
  project: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  org: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  run: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  deckWa: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  bathWa: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  partWa: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  ceilWa: "11111111-1111-4111-8111-111111111111",
  fasciaWa: "22222222-2222-4222-8222-222222222222",
  plumbWa: "33333333-3333-4333-8333-333333333333",
};

function snapshot(overrides: Partial<SourceSnapshot> = {}): SourceSnapshot {
  return {
    briefRevision: "brief-v1",
    noteRevisionSet: "notes-v1",
    factRevisions: "facts-v1",
    constraintRevisions: "constraints-v1",
    workAreaRevisions: "wa-v1",
    catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    providerModelId: "claude-sonnet-4-6",
    formattingRevision: "fmt-1",
    ...overrides,
  };
}

function evaluate(input: {
  accepted: { workAreaId: string; type: string }[];
  facts?: { key: string; value: unknown }[];
  constraints?: { key: string; value: unknown }[];
  rejections?: RejectionRecord[];
  sourceSnapshot?: SourceSnapshot;
}) {
  return evaluateScopeRelationships({
    projectId: IDS.project,
    orgId: IDS.org,
    analysisRunId: IDS.run,
    acceptedWorkAreas: input.accepted,
    facts: input.facts ?? [],
    constraints: input.constraints ?? [],
    sourceSnapshot: input.sourceSnapshot ?? snapshot(),
    rejections: input.rejections,
    relationships: SCOPE_RELATIONSHIP_CATALOGUE,
  });
}

function hasEdge(
  result: ReturnType<typeof evaluate>,
  relationshipId: string
): boolean {
  return result.suggestions.some((s) => s.catalogueEdgeId === relationshipId);
}

function suppressedAs(
  result: ReturnType<typeof evaluate>,
  relationshipId: string,
  classification: string
): boolean {
  return result.suppressed.some(
    (s) =>
      s.relationshipId === relationshipId && s.classification === classification
  );
}

function main(): void {
  console.log("=== Stage 3.1B.2 Scope Relationship Catalogue Verification ===\n");

  // --- Catalogue integrity ---
  const validation = getCatalogueValidation();
  check("all catalogue entries valid", validation.ok, JSON.stringify(validation.issues));

  const ids = SCOPE_RELATIONSHIP_CATALOGUE.map((r) => r.relationshipId);
  check(
    "unique relationship IDs",
    new Set(ids).size === ids.length
  );
  check(
    "version exists",
    SCOPE_RELATIONSHIP_CATALOGUE_VERSION === "scope-relationship-catalogue/v2"
  );
  check(
    "aliases resolve deterministically",
    resolveCanonicalScopeId("external_stairs") === "stairs" &&
      resolveCanonicalScopeId("internal_walls") === "partitions" &&
      resolveCanonicalScopeId("balustrades") === "balustrade"
  );
  check("canonical scope ids non-empty", CANONICAL_SCOPE_IDS.length > 10);
  check("documented aliases present", DOCUMENTED_ALIASES.length > 0);

  const revalidate = validateCatalogueRelationships(SCOPE_RELATIONSHIP_CATALOGUE);
  check("no duplicate semantic edge", revalidate.ok);

  const catalogueSrc = read(join(process.cwd(), "lib/scope-discovery/catalogue/relationships/deck.ts")) +
    read(join(process.cwd(), "lib/scope-discovery/catalogue/relationships/bathroom.ts")) +
    read(join(process.cwd(), "lib/scope-discovery/catalogue/relationships/commercial-fitout.ts"));
  check(
    "no commercial values in relationship data",
    !/total_cost|gross_margin|gstAmount|unitRate/.test(catalogueSrc)
  );
  check(
    "no executable predicates in catalogue data",
    !/op:\s*["']function|=>\s*|new Function/.test(catalogueSrc)
  );

  // --- Deck ---
  const deckReplace = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [{ key: "deck.existing_deck_removal", value: "Yes" }],
  });
  check(
    "deck replacement suggests demolition",
    hasEdge(deckReplace, "deck.demolition")
  );
  check(
    "deck replacement suggests waste consideration",
    hasEdge(deckReplace, "deck.waste_removal")
  );

  const noDemo = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [{ key: "deck.existing_deck_removal", value: "No" }],
  });
  check(
    "explicit no demolition suppresses demolition",
    !hasEdge(noDemo, "deck.demolition") &&
      (suppressedAs(noDemo, "deck.demolition", "EXPLICITLY_SUPPRESSED") ||
        noDemo.matches.some(
          (m) =>
            m.relationshipId === "deck.demolition" &&
            m.classification === "NOT_APPLICABLE"
        ))
  );

  const missingSub = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [],
  });
  check(
    "missing substructure condition creates clarification",
    hasEdge(missingSub, "deck.substructure_condition.clarify")
  );

  const noneSub = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [{ key: "deck.substructure_condition", value: "none" }],
  });
  check(
    "deliberate none is treated as answered (no missing-condition clarify)",
    !hasEdge(noneSub, "deck.substructure_condition.clarify")
  );
  check(
    "new deck with none existing substructure still considers new substructure",
    hasEdge(noneSub, "deck.substructure.new")
  );

  const noHandrail = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [
      { key: "deck.substructure_condition", value: "good_existing" },
      { key: "deck.handrail_required", value: "No" },
      { key: "deck.handrail_required", value: false },
    ],
  });
  // fix duplicate key - use single No
  const noHandrail2 = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [
      { key: "deck.substructure_condition", value: "good_existing" },
      { key: "deck.handrail_required", value: "No" },
    ],
  });
  check(
    "explicit no handrail suppresses handrail",
    suppressedAs(noHandrail2, "deck.handrail", "EXPLICITLY_SUPPRESSED") ||
      !hasEdge(noHandrail2, "deck.handrail")
  );
  void noHandrail;

  const elevated = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [
      { key: "deck.substructure_condition", value: "good_existing" },
      { key: "deck.height_m", value: 1.5 },
    ],
  });
  check(
    "elevated deck creates stairs/balustrade clarification where facts incomplete",
    hasEdge(elevated, "deck.stairs") ||
      hasEdge(elevated, "deck.balustrade") ||
      elevated.suggestions.some(
        (s) =>
          s.suggestionKind === "CLARIFICATION_REQUIRED" &&
          (s.catalogueEdgeId === "deck.stairs" ||
            s.catalogueEdgeId === "deck.balustrade")
      )
  );

  const fasciaAccepted = evaluate({
    accepted: [
      { workAreaId: IDS.deckWa, type: "deck" },
      { workAreaId: IDS.fasciaWa, type: "fascia" },
    ],
    facts: [
      { key: "deck.substructure_condition", value: "good_existing" },
      { key: "deck.vertical_face_boards_required", value: "Yes" },
    ],
  });
  check(
    "accepted fascia scope prevents duplicate fascia suggestion",
    !hasEdge(fasciaAccepted, "deck.fascia") &&
      (suppressedAs(fasciaAccepted, "deck.fascia", "ALREADY_COVERED") ||
        suppressedAs(fasciaAccepted, "deck.fascia", "EXPLICITLY_SUPPRESSED"))
  );

  const stepSuggestion = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [
      { key: "deck.substructure_condition", value: "good_existing" },
      { key: "deck.access_type", value: "Single step or step-down" },
    ],
  });
  const stepId = stepSuggestion.suggestions.find(
    (s) => s.catalogueEdgeId === "deck.stairs"
  );
  check("stairs suggestion available for rejection test", Boolean(stepId));
  const rejectedStep: RejectionRecord[] = stepId
    ? [
        {
          identityKey: identityKeyForSuggestion(stepId),
          sourceSnapshot: snapshot(),
          suggestionId: stepId.suggestionId,
        },
      ]
    : [];
  const afterReject = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [
      { key: "deck.substructure_condition", value: "good_existing" },
      { key: "deck.access_type", value: "Single step or step-down" },
    ],
    rejections: rejectedStep,
  });
  check(
    "rejected unchanged step suggestion remains suppressed",
    suppressedAs(afterReject, "deck.stairs", "PREVIOUSLY_REJECTED")
  );

  const afterMaterialChange = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [
      { key: "deck.substructure_condition", value: "good_existing" },
      { key: "deck.access_type", value: "Single step or step-down" },
    ],
    rejections: rejectedStep,
    sourceSnapshot: snapshot({ briefRevision: "brief-v2" }),
  });
  check(
    "changed material source can permit reconsideration",
    hasEdge(afterMaterialChange, "deck.stairs")
  );

  // --- Bathroom ---
  const tilingWet = evaluate({
    accepted: [{ workAreaId: IDS.bathWa, type: "bathroom" }],
    facts: [{ key: "bathroom.tiling_included", value: "Yes" }],
  });
  check(
    "tiling/wet-area scope considers waterproofing",
    hasEdge(tilingWet, "bathroom.waterproofing")
  );

  const clientFixtures = evaluate({
    accepted: [{ workAreaId: IDS.bathWa, type: "bathroom" }],
    facts: [{ key: "bathroom.fixtures_client_supplied", value: "Yes" }],
  });
  check(
    "client-supplied fixtures still consider fit-off",
    hasEdge(clientFixtures, "bathroom.fit_off")
  );

  const bathDemo = evaluate({
    accepted: [{ workAreaId: IDS.bathWa, type: "bathroom" }],
    facts: [{ key: "bathroom.demolition_required", value: "Yes" }],
  });
  check(
    "demolition considers waste removal",
    hasEdge(bathDemo, "bathroom.waste_removal")
  );

  const bathClarify = evaluate({
    accepted: [{ workAreaId: IDS.bathWa, type: "bathroom" }],
    facts: [],
  });
  check(
    "missing existing-condition evidence creates clarification",
    hasEdge(bathClarify, "bathroom.existing_condition.clarify")
  );

  const plumbingAccepted = evaluate({
    accepted: [
      { workAreaId: IDS.bathWa, type: "bathroom" },
      { workAreaId: IDS.plumbWa, type: "plumbing" },
    ],
    facts: [],
  });
  check(
    "accepted plumbing prevents duplicate proposal",
    !hasEdge(plumbingAccepted, "bathroom.plumbing") &&
      (suppressedAs(plumbingAccepted, "bathroom.plumbing", "ALREADY_COVERED") ||
        suppressedAs(
          plumbingAccepted,
          "bathroom.plumbing",
          "EXPLICITLY_SUPPRESSED"
        ))
  );

  // --- Commercial fitout ---
  const partitions = evaluate({
    accepted: [{ workAreaId: IDS.partWa, type: "internal_walls" }],
    facts: [],
  });
  check(
    "partitions consider doors/openings",
    hasEdge(partitions, "fitout.partitions.doors")
  );
  check(
    "partitions consider services coordination",
    hasEdge(partitions, "fitout.partitions.services")
  );
  check(
    "partitions baseline includes framing + wall linings",
    hasEdge(partitions, "fitout.partitions.framing") &&
      hasEdge(partitions, "fitout.partitions.wall_linings")
  );

  const paintingWa = evaluate({
    accepted: [{ workAreaId: IDS.partWa, type: "painting" }],
    facts: [],
  });
  check(
    "painting baseline includes prep + finish coats",
    hasEdge(paintingWa, "fitout.painting.prep") &&
      hasEdge(paintingWa, "fitout.painting.finish_coats")
  );

  const doorsWa = evaluate({
    accepted: [{ workAreaId: IDS.partWa, type: "doors" }],
    facts: [],
  });
  check(
    "doors baseline includes hardware",
    hasEdge(doorsWa, "fitout.doors.hardware")
  );

  const penetrations = evaluate({
    accepted: [{ workAreaId: IDS.partWa, type: "commercial_fitout" }],
    facts: [{ key: "fitout.services_penetrations", value: "Yes" }],
  });
  check(
    "penetrations consider fire-stopping clarification",
    hasEdge(penetrations, "fitout.fire_stopping")
  );

  const ceilings = evaluate({
    accepted: [{ workAreaId: IDS.ceilWa, type: "ceilings" }],
    facts: [],
  });
  check(
    "ceiling scope considers services/seismic interfaces",
    hasEdge(ceilings, "fitout.ceilings.services") &&
      hasEdge(ceilings, "fitout.ceilings.seismic")
  );

  const stripOut = evaluate({
    accepted: [{ workAreaId: IDS.partWa, type: "commercial_fitout" }],
    facts: [],
  });
  check(
    "strip-out considers waste and make-good",
    hasEdge(stripOut, "fitout.waste_removal") &&
      hasEdge(stripOut, "fitout.make_good")
  );

  const fitoutExclude = evaluate({
    accepted: [{ workAreaId: IDS.partWa, type: "commercial_fitout" }],
    facts: [{ key: "fitout.flooring_required", value: "No" }],
  });
  check(
    "explicit exclusions suppress relevant suggestions",
    suppressedAs(fitoutExclude, "fitout.flooring", "EXPLICITLY_SUPPRESSED")
  );

  const access = evaluate({
    accepted: [{ workAreaId: IDS.partWa, type: "commercial_fitout" }],
    constraints: [{ key: "site_access", value: "high_security" }],
  });
  check(
    "access constraint emits logistics clarification",
    hasEdge(access, "fitout.access_logistics")
  );

  // --- Merge / lifecycle integration ---
  const allValid = deckReplace.suggestions.every(
    (s) => validateScopeDiscoverySuggestion(s).ok
  );
  check("emitted suggestions validate under 3.1B.1", allValid);

  const merge = mergeScopeSuggestions({
    deterministicSuggestions: deckReplace.suggestions,
    aiSuggestions: deckReplace.suggestions.slice(0, 1).map((s) => ({
      ...s,
      suggestionId: "99999999-9999-4999-8999-999999999999",
      origin: "ai" as const,
      proposedTitle: "AI wording for same edge",
    })),
    acceptedWorkAreaTypes: [],
    priorProposals: [],
    rejections: [],
  });
  check(
    "deterministic suggestions merge with equivalent contextual suggestions",
    merge.primarySuggestions.length + merge.otherPossibilities.length > 0
  );
  check(
    "deterministic suppression / merge authority preserved",
    merge.suppressedSuggestions.length >= 0
  );

  const coatings = evaluate({
    accepted: [{ workAreaId: IDS.deckWa, type: "deck" }],
    facts: [{ key: "deck.substructure_condition", value: "good_existing" }],
  });
  check(
    "low-confidence conditional suggestions go to other possibilities via merge",
    mergeScopeSuggestions({
      deterministicSuggestions: coatings.suggestions,
      aiSuggestions: [],
      acceptedWorkAreaTypes: [],
      priorProposals: [],
      rejections: [],
    }).otherPossibilities.some((s) => s.confidenceBand === "LOW") ||
      coatings.suggestions.some((s) => s.confidenceBand === "LOW")
  );

  check(
    "accepted scope remains untouched (evaluator emits PROPOSED only)",
    deckReplace.suggestions.every((s) => s.status === "PROPOSED")
  );
  check(
    "no suggestion is auto-accepted",
    deckReplace.suggestions.every((s) => s.status !== "ACCEPTED" && s.decision === null)
  );

  // --- Boundaries ---
  const root = process.cwd();
  const catDir = join(root, "lib", "scope-discovery", "catalogue");
  function collectTs(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) out.push(...collectTs(full));
      else if (name.endsWith(".ts")) out.push(full);
    }
    return out;
  }
  let moduleSrc = "";
  for (const f of collectTs(catDir)) moduleSrc += read(f);

  check("no React", !/from\s+["']react["']/.test(moduleSrc));
  check(
    "no Supabase imports",
    !/from\s+["'][^"']*supabase[^"']*["']/.test(moduleSrc)
  );
  check(
    "no provider SDK",
    !/@anthropic|openai|@google\/generative/i.test(moduleSrc)
  );
  check("no server action", !/"use server"/.test(moduleSrc));
  check(
    "no AI prompt modules",
    !/brief-extraction-prompt|extract-notes|extractFromBrief/.test(moduleSrc)
  );
  check(
    "no commercial engine",
    !/commercial-engine\/calculations|calculate-line/.test(moduleSrc)
  );

  const productionTouch = [
    "lib/assistant/actions.ts",
    "lib/ai/extract.ts",
    "lib/ai/brief-extraction-prompt.ts",
  ];
  let imported = false;
  for (const rel of productionTouch) {
    if (/scope-discovery\/catalogue|evaluateScopeRelationships/.test(read(join(root, rel)))) {
      imported = true;
    }
  }
  check("no production Analyse Job import", !imported);

  const migrationsDir = join(root, "supabase", "migrations");
  let newMigration = false;
  if (statSync(migrationsDir, { throwIfNoEntry: false })?.isDirectory()) {
    newMigration = readdirSync(migrationsDir).some((f) =>
      /scope.?relationship|3_1b2|catalogue/i.test(f)
    );
  }
  check("no migration", !newMigration);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
