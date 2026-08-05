/**
 * Stage 3.1B.1 — Scope discovery suggestion contract verification.
 * Pure / local — no Supabase, no provider calls.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  SCOPE_DISCOVERY_CONTRACT_VERSION,
  SCOPE_DISCOVERY_ERROR_CODES,
  assertFrozenMutationBlocked,
  bandForConfidence,
  buildSuggestionIdentity,
  classifyDuplicate,
  deepFreeze,
  evaluateStaleness,
  identityKeyForSuggestion,
  mergeScopeSuggestions,
  normalizeWorkAreaType,
  transitionScopeSuggestion,
  validateScopeDiscoverySuggestion,
  type ScopeDiscoverySuggestion,
  type SourceSnapshot,
  type TransitionAuditMetadata,
} from "../lib/scope-discovery";

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
  suggestion: "11111111-1111-4111-8111-111111111111",
  suggestion2: "22222222-2222-4222-8222-222222222222",
  suggestion3: "33333333-3333-4333-8333-333333333333",
  project: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  org: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  run: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  user: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  wa: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};

function baseSnapshot(overrides: Partial<SourceSnapshot> = {}): SourceSnapshot {
  return {
    briefRevision: "brief-v1",
    noteRevisionSet: "notes-v1",
    factRevisions: "facts-v1",
    constraintRevisions: "constraints-v1",
    workAreaRevisions: "wa-v1",
    catalogueVersion: "catalogue-v0",
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    providerModelId: "claude-sonnet-4-6",
    formattingRevision: "fmt-1",
    ...overrides,
  };
}

function baseSuggestion(
  overrides: Partial<ScopeDiscoverySuggestion> = {}
): ScopeDiscoverySuggestion {
  const confidence = overrides.confidence ?? 0.82;
  const band = overrides.confidenceBand ?? bandForConfidence(confidence);
  const base: ScopeDiscoverySuggestion = {
    suggestionId: IDS.suggestion,
    projectId: IDS.project,
    orgId: IDS.org,
    analysisRunId: IDS.run,
    suggestionKind: "WORK_AREA",
    proposedWorkAreaType: "deck",
    proposedTitle: "New deck",
    proposedDescription: "Timber deck",
    relatedWorkAreaId: null,
    parentSuggestionId: null,
    confidence,
    confidenceBand: band,
    evidence: [
      {
        sourceType: "PROJECT_BRIEF_TEXT",
        sourceId: "brief",
        excerptOrValue: "build a deck",
        relevance: "primary",
        timestamp: "2026-08-05T00:00:00.000Z",
        provenance: "ai",
        userAuthored: false,
        authoritative: false,
      },
    ],
    rationaleKey: "brief.mentions_deck",
    sourceSnapshot: baseSnapshot(),
    dependencyReferences: [],
    conflictReferences: [],
    missingInformation: [],
    status: "PROPOSED",
    decision: null,
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    providerMetadata: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    staleReason: null,
    supersededBySuggestionId: null,
    failureCode: null,
    failureMessage: null,
    catalogueEdgeId: null,
    origin: "ai",
  };
  return deepFreeze({ ...base, ...overrides, confidenceBand: overrides.confidenceBand ?? bandForConfidence(overrides.confidence ?? confidence) });
}

const audit: TransitionAuditMetadata = {
  actorUserId: IDS.user,
  occurredAt: "2026-08-05T12:00:00.000Z",
  sourceRevision: "brief-v1",
  note: null,
};

function main(): void {
  console.log("=== Stage 3.1B.1 Suggestion Contract Verification ===\n");

  // --- Validation ---
  const valid = validateScopeDiscoverySuggestion(baseSuggestion());
  check("valid suggestion passes", valid.ok && valid.suggestion !== null);

  const unknownKind = validateScopeDiscoverySuggestion(
    baseSuggestion({ suggestionKind: "WIDGET" as never })
  );
  check(
    "unknown kind fails",
    !unknownKind.ok &&
      unknownKind.issues.some(
        (i) => i.code === SCOPE_DISCOVERY_ERROR_CODES.INVALID_KIND
      )
  );

  const badConfidence = validateScopeDiscoverySuggestion(
    baseSuggestion({ confidence: 1.5, confidenceBand: "HIGH" })
  );
  check("invalid confidence fails", !badConfidence.ok);

  const bandMismatch = validateScopeDiscoverySuggestion(
    baseSuggestion({ confidence: 0.1, confidenceBand: "HIGH" })
  );
  check(
    "confidence-band mismatch fails",
    !bandMismatch.ok &&
      bandMismatch.issues.some(
        (i) => i.code === SCOPE_DISCOVERY_ERROR_CODES.CONFIDENCE_BAND_MISMATCH
      )
  );

  const malformedEvidence = validateScopeDiscoverySuggestion(
    baseSuggestion({
      evidence: [
        {
          sourceType: "NOT_A_TYPE" as never,
          sourceId: "x",
          excerptOrValue: "y",
          relevance: "primary",
          timestamp: "t",
          provenance: "ai",
          userAuthored: false,
          authoritative: false,
        },
      ],
    })
  );
  check("malformed evidence fails", !malformedEvidence.ok);

  const dupEvidence = validateScopeDiscoverySuggestion(
    baseSuggestion({
      evidence: [
        {
          sourceType: "PROJECT_BRIEF_TEXT",
          sourceId: "brief",
          excerptOrValue: "a",
          relevance: "primary",
          timestamp: "t",
          provenance: "ai",
          userAuthored: false,
          authoritative: false,
        },
        {
          sourceType: "PROJECT_BRIEF_TEXT",
          sourceId: "brief",
          excerptOrValue: "b",
          relevance: "primary",
          timestamp: "t",
          provenance: "ai",
          userAuthored: false,
          authoritative: false,
        },
      ],
    })
  );
  check(
    "duplicate evidence fails",
    !dupEvidence.ok &&
      dupEvidence.issues.some(
        (i) => i.code === SCOPE_DISCOVERY_ERROR_CODES.DUPLICATE_EVIDENCE
      )
  );

  const commercial = validateScopeDiscoverySuggestion({
    ...baseSuggestion(),
    total_cost: 1200,
  });
  check(
    "commercial fields rejected",
    !commercial.ok &&
      commercial.issues.some(
        (i) => i.code === SCOPE_DISCOVERY_ERROR_CODES.COMMERCIAL_FIELD_FORBIDDEN
      )
  );

  const missingType = validateScopeDiscoverySuggestion(
    baseSuggestion({ proposedWorkAreaType: null })
  );
  check(
    "WORK_AREA requires type",
    !missingType.ok &&
      missingType.issues.some(
        (i) => i.code === SCOPE_DISCOVERY_ERROR_CODES.WORK_AREA_TYPE_REQUIRED
      )
  );

  // --- Lifecycle ---
  const proposed = baseSuggestion();
  const accept = transitionScopeSuggestion(proposed, {
    type: "ACCEPT",
    audit,
    resultingWorkAreaId: IDS.wa,
    reasonCode: null,
  });
  check(
    "PROPOSED → ACCEPTED",
    accept.ok && accept.suggestion?.status === "ACCEPTED"
  );

  const reject = transitionScopeSuggestion(proposed, {
    type: "REJECT",
    audit,
    reasonCode: "not_needed",
    userNote: null,
  });
  check(
    "PROPOSED → REJECTED",
    reject.ok && reject.suggestion?.status === "REJECTED"
  );

  const modify = transitionScopeSuggestion(proposed, {
    type: "MODIFY",
    audit,
    modifiedTitle: "Rear deck",
    modifiedDescription: "Adjusted",
    modifiedWorkAreaType: "deck",
    resultingWorkAreaId: IDS.wa,
    reasonCode: null,
    userNote: "rename",
  });
  check(
    "PROPOSED → MODIFIED",
    modify.ok &&
      modify.suggestion?.status === "MODIFIED" &&
      modify.suggestion.proposedTitle === "New deck" &&
      modify.suggestion.decision?.modifiedTitle === "Rear deck"
  );

  const stale = transitionScopeSuggestion(proposed, {
    type: "MARK_STALE",
    audit,
    staleReason: "brief_changed",
  });
  check("PROPOSED → STALE", stale.ok && stale.suggestion?.status === "STALE");

  const supersede = transitionScopeSuggestion(proposed, {
    type: "SUPERSEDE",
    audit,
    supersededBySuggestionId: IDS.suggestion2,
  });
  check(
    "PROPOSED → SUPERSEDED",
    supersede.ok && supersede.suggestion?.status === "SUPERSEDED"
  );

  const failedTx = transitionScopeSuggestion(proposed, {
    type: "MARK_FAILED",
    audit,
    failureCode: "apply_error",
    failureMessage: "Could not apply",
  });
  check(
    "PROPOSED → FAILED",
    failedTx.ok && failedTx.suggestion?.status === "FAILED"
  );

  const accepted = accept.suggestion!;
  const reviveAccepted = transitionScopeSuggestion(accepted, {
    type: "ACCEPT",
    audit,
    resultingWorkAreaId: IDS.wa,
    reasonCode: null,
  });
  check(
    "accepted cannot return to proposed / re-accept",
    !reviveAccepted.ok
  );

  const rejected = reject.suggestion!;
  const reviveRejected = transitionScopeSuggestion(rejected, {
    type: "ACCEPT",
    audit,
    resultingWorkAreaId: IDS.wa,
    reasonCode: null,
  });
  check("rejected cannot silently revive via ACCEPT", !reviveRejected.ok);

  const before = JSON.stringify(proposed);
  transitionScopeSuggestion(proposed, {
    type: "ACCEPT",
    audit,
    resultingWorkAreaId: IDS.wa,
    reasonCode: null,
  });
  check("original input remains unchanged", JSON.stringify(proposed) === before);

  check(
    "modified decision preserves original and correction",
    modify.suggestion?.proposedTitle === "New deck" &&
      modify.suggestion.decision?.modifiedTitle === "Rear deck" &&
      modify.suggestion.decision.originalSuggestionId === IDS.suggestion
  );

  // --- Staleness ---
  const proposedForStale = baseSuggestion();
  const briefStale = evaluateStaleness({
    suggestion: proposedForStale,
    currentSnapshot: baseSnapshot({ briefRevision: "brief-v2" }),
  });
  check(
    "brief material revision marks proposed stale",
    briefStale.isStale && briefStale.reasons.includes("brief_changed")
  );

  const factStale = evaluateStaleness({
    suggestion: proposedForStale,
    currentSnapshot: baseSnapshot({ factRevisions: "facts-v2" }),
    relevantKeys: ["factRevisions"],
  });
  check("relevant Fact revision marks it stale", factStale.isStale);

  const irrelevant = evaluateStaleness({
    suggestion: proposedForStale,
    currentSnapshot: baseSnapshot({ factRevisions: "facts-v2" }),
    relevantKeys: ["briefRevision"],
  });
  check("irrelevant source change does not", !irrelevant.isStale);

  const formatting = evaluateStaleness({
    suggestion: proposedForStale,
    currentSnapshot: baseSnapshot({ formattingRevision: "fmt-2" }),
  });
  check("formatting-only change does not", !formatting.isStale);

  const providerOnly = evaluateStaleness({
    suggestion: proposedForStale,
    currentSnapshot: baseSnapshot({ providerModelId: "other-model" }),
  });
  check("provider-only change does not", !providerOnly.isStale);

  const acceptedStale = evaluateStaleness({
    suggestion: accepted,
    currentSnapshot: baseSnapshot({ briefRevision: "brief-v9" }),
  });
  check("accepted suggestion does not become stale", !acceptedStale.isStale);

  const rejectedElig = evaluateStaleness({
    suggestion: rejected,
    currentSnapshot: baseSnapshot({ briefRevision: "brief-v2" }),
  });
  check(
    "rejected suggestion eligible after material source change",
    rejectedElig.suppressionResetEligible
  );

  const rejectedStill = evaluateStaleness({
    suggestion: rejected,
    currentSnapshot: baseSnapshot({ providerModelId: "other-model" }),
  });
  check(
    "provider-only change does not reset rejection",
    !rejectedStill.suppressionResetEligible
  );

  // --- Identity / dedupe ---
  const a = baseSuggestion({
    suggestionId: IDS.suggestion,
    proposedTitle: "New deck",
    proposedWorkAreaType: "Deck",
  });
  const b = baseSuggestion({
    suggestionId: IDS.suggestion2,
    proposedTitle: "Timber deck structure",
    proposedWorkAreaType: "deck",
  });
  check(
    "equivalent provider wording has same deterministic identity",
    identityKeyForSuggestion(a) === identityKeyForSuggestion(b)
  );

  const c = baseSuggestion({
    suggestionId: IDS.suggestion3,
    proposedWorkAreaType: "bathroom",
  });
  check(
    "different Work Area types remain distinct",
    identityKeyForSuggestion(a) !== identityKeyForSuggestion(c)
  );

  check(
    "existing accepted scope suppresses duplicate",
    classifyDuplicate({
      candidate: a,
      against: null,
      acceptedWorkAreaTypes: ["deck"],
      priorRejectionIdentityKeys: [],
      rejectionSuppressionActive: false,
    }) === "EXISTING_ACCEPTED_SCOPE"
  );

  const rejectKey = identityKeyForSuggestion(a);
  check(
    "prior rejection suppresses unchanged suggestion",
    classifyDuplicate({
      candidate: a,
      against: null,
      acceptedWorkAreaTypes: [],
      priorRejectionIdentityKeys: [rejectKey],
      rejectionSuppressionActive: true,
    }) === "PREVIOUSLY_REJECTED"
  );

  check(
    "changed source permits reconsideration (identity unchanged, suppression gate separate)",
    buildSuggestionIdentity({
      projectId: IDS.project,
      suggestionKind: "WORK_AREA",
      normalizedWorkAreaType: normalizeWorkAreaType("deck"),
      relatedWorkAreaId: null,
      normalizedParentScope: null,
      catalogueEdgeId: null,
    }) === rejectKey
  );

  check(
    "title-only differences do not create distinct identity",
    identityKeyForSuggestion(a) === identityKeyForSuggestion(b)
  );

  // --- Merge ---
  const detRequired = baseSuggestion({
    suggestionId: IDS.suggestion,
    origin: "deterministic",
    confidence: 0.9,
    confidenceBand: "HIGH",
    proposedTitle: "Deck (deterministic)",
    catalogueEdgeId: "deck.decking",
    evidence: [
      {
        sourceType: "DETERMINISTIC_RULE",
        sourceId: "deck.decking",
        excerptOrValue: "required",
        relevance: "primary",
        timestamp: "2026-08-05T00:00:00.000Z",
        provenance: "deterministic_rule",
        userAuthored: false,
        authoritative: false,
      },
    ],
  });
  const aiSame = baseSuggestion({
    suggestionId: IDS.suggestion2,
    origin: "ai",
    proposedTitle: "AI says timber deck please",
    confidence: 0.55,
    confidenceBand: "MEDIUM",
    catalogueEdgeId: "deck.decking",
  });
  const aiSuppressed = baseSuggestion({
    suggestionId: IDS.suggestion3,
    origin: "ai",
    proposedWorkAreaType: "excavation",
    proposedTitle: "Excavation",
    confidence: 0.2,
    confidenceBand: "LOW",
    catalogueEdgeId: "deck.excavation",
  });
  const detSuppress = baseSuggestion({
    suggestionId: "44444444-4444-4444-8444-444444444444",
    origin: "deterministic",
    suggestionKind: "POSSIBLE_EXCLUSION",
    proposedWorkAreaType: "excavation",
    proposedTitle: "Excavation unlikely",
    confidence: 0.8,
    confidenceBand: "HIGH",
    catalogueEdgeId: "deck.excavation",
    conflictReferences: ["no-ground-works"],
    evidence: [
      {
        sourceType: "DETERMINISTIC_RULE",
        sourceId: "deck.excavation.suppress",
        excerptOrValue: "suppress",
        relevance: "contrary",
        timestamp: "2026-08-05T00:00:00.000Z",
        provenance: "deterministic_rule",
        userAuthored: false,
        authoritative: false,
      },
    ],
  });

  const merge = mergeScopeSuggestions({
    deterministicSuggestions: [detRequired, detSuppress],
    aiSuggestions: [aiSame, aiSuppressed],
    acceptedWorkAreaTypes: [],
    priorProposals: [],
    rejections: [],
  });

  check(
    "deterministic required suggestion wins",
    merge.primarySuggestions.some(
      (s) =>
        s.catalogueEdgeId === "deck.decking" &&
        s.proposedTitle === "Deck (deterministic)"
    )
  );

  check(
    "deterministic suppression removes/conflicts AI suggestion",
    merge.conflicts.some((c) => c.code === "deterministic_conflict_precedence") &&
      merge.suppressedSuggestions.some((s) => s.suggestionId === IDS.suggestion3)
  );

  check(
    "equivalent AI evidence merges safely",
    merge.mergeWarnings.some((w) => w.code === "ai_evidence_merged") &&
      merge.primarySuggestions.some(
        (s) =>
          s.origin === "merged" &&
          s.evidence.some((e) => e.sourceType === "PROJECT_BRIEF_TEXT")
      )
  );

  check("conflicts are explicit", merge.conflicts.length >= 1);

  const lowOnly = mergeScopeSuggestions({
    deterministicSuggestions: [],
    aiSuggestions: [
      baseSuggestion({
        suggestionId: IDS.suggestion,
        confidence: 0.2,
        confidenceBand: "LOW",
        proposedWorkAreaType: "fascia",
        proposedTitle: "Maybe fascia",
      }),
      baseSuggestion({
        suggestionId: IDS.suggestion2,
        confidence: 0.85,
        confidenceBand: "HIGH",
        proposedWorkAreaType: "stairs",
        proposedTitle: "Stairs",
      }),
    ],
    acceptedWorkAreaTypes: [],
    priorProposals: [],
    rejections: [],
  });
  check(
    "high/medium in primary; low in other possibilities",
    lowOnly.primarySuggestions.some((s) => s.proposedWorkAreaType === "stairs") &&
      lowOnly.otherPossibilities.some((s) => s.confidenceBand === "LOW")
  );

  const orderA = mergeScopeSuggestions({
    deterministicSuggestions: [detRequired],
    aiSuggestions: [],
    acceptedWorkAreaTypes: [],
    priorProposals: [],
    rejections: [],
  });
  const orderB = mergeScopeSuggestions({
    deterministicSuggestions: [detRequired],
    aiSuggestions: [],
    acceptedWorkAreaTypes: [],
    priorProposals: [],
    rejections: [],
  });
  check(
    "ordering is deterministic",
    JSON.stringify(orderA.primarySuggestions.map((s) => s.suggestionId)) ===
      JSON.stringify(orderB.primarySuggestions.map((s) => s.suggestionId))
  );

  const mergeReject = mergeScopeSuggestions({
    deterministicSuggestions: [],
    aiSuggestions: [baseSuggestion()],
    acceptedWorkAreaTypes: [],
    priorProposals: [],
    rejections: [
      {
        identityKey: identityKeyForSuggestion(baseSuggestion()),
        sourceSnapshot: baseSnapshot(),
        suggestionId: IDS.suggestion2,
      },
    ],
  });
  check(
    "prior rejection suppresses unchanged suggestion in merge",
    mergeReject.suppressedSuggestions.length === 1 &&
      mergeReject.primarySuggestions.length === 0
  );

  const mergeRejectReset = mergeScopeSuggestions({
    deterministicSuggestions: [],
    aiSuggestions: [
      baseSuggestion({
        sourceSnapshot: baseSnapshot({ briefRevision: "brief-v2" }),
      }),
    ],
    acceptedWorkAreaTypes: [],
    priorProposals: [],
    rejections: [
      {
        identityKey: identityKeyForSuggestion(baseSuggestion()),
        sourceSnapshot: baseSnapshot(),
        suggestionId: IDS.suggestion2,
      },
    ],
  });
  check(
    "changed source permits reconsideration in merge",
    mergeRejectReset.primarySuggestions.length === 1
  );

  check(
    "existing accepted suppresses in merge",
    mergeScopeSuggestions({
      deterministicSuggestions: [baseSuggestion()],
      aiSuggestions: [],
      acceptedWorkAreaTypes: ["deck"],
      priorProposals: [],
      rejections: [],
    }).suppressedSuggestions.length === 1
  );

  // --- Immutability ---
  const frozen = valid.suggestion!;
  check(
    "nested evidence mutation blocked",
    assertFrozenMutationBlocked(frozen.evidence as unknown as object, "0", null) ||
      Object.isFrozen(frozen.evidence)
  );
  check(
    "suggestion mutation blocked",
    assertFrozenMutationBlocked(
      frozen as unknown as object,
      "proposedTitle",
      "mutated"
    )
  );

  const mergeFrozen = mergeScopeSuggestions({
    deterministicSuggestions: [detRequired],
    aiSuggestions: [aiSame],
    acceptedWorkAreaTypes: [],
    priorProposals: [],
    rejections: [],
  });
  check(
    "merge result frozen",
    Object.isFrozen(mergeFrozen) &&
      Object.isFrozen(mergeFrozen.primarySuggestions)
  );

  // --- Boundaries ---
  const root = process.cwd();
  const moduleDir = join(root, "lib", "scope-discovery");
  const moduleFiles = readdirSync(moduleDir).filter((f) => f.endsWith(".ts"));
  let moduleSrc = "";
  for (const f of moduleFiles) {
    moduleSrc += read(join(moduleDir, f));
  }
  check(
    "no React imports in scope-discovery",
    !/from\s+["']react["']|from\s+["']react\//.test(moduleSrc)
  );
  check(
    "no Supabase imports in scope-discovery",
    !/from\s+["'][^"']*supabase[^"']*["']|require\(["'][^"']*supabase/i.test(
      moduleSrc
    )
  );
  check(
    "no provider SDK imports in scope-discovery",
    !/@anthropic|openai|@google\/generative/i.test(moduleSrc)
  );
  check(
    "no server-action directive in scope-discovery",
    !/"use server"/.test(moduleSrc)
  );
  check(
    "no commercial-engine formula imports",
    !/commercial-engine\/calculations|calculate-line|aggregate/.test(moduleSrc)
  );
  check(
    "no parity imports",
    !/commercial-engine\/parity/.test(moduleSrc)
  );

  // 3.1B.1 was contract-only. Persistence begins at 028 (3.1B.4B).
  // Allow that file; reject 3.1B.1-named or any earlier accidental scope-discovery SQL.
  const migrationsDir = join(root, "supabase", "migrations");
  let disallowedMigration = false;
  if (statSync(migrationsDir, { throwIfNoEntry: false })?.isDirectory()) {
    const files = readdirSync(migrationsDir);
    disallowedMigration = files.some((f) => {
      if (/3_1b1|3\.1b\.1|suggestion.?contract/i.test(f)) return true;
      const m = f.match(/^(\d{3})_.*scope.?discovery/i);
      if (!m) return false;
      const n = Number(m[1]);
      return n < 28 || (n === 28 && f !== "028_scope_discovery_persistence.sql");
    });
  }
  check("no migrations added for 3.1B.1", !disallowedMigration);

  const productionTouch = [
    "lib/assistant/actions.ts",
    "lib/project-notes/proposals/actions.ts",
    "lib/ai/extract.ts",
    "lib/ai/extract-notes.ts",
    "lib/ai/brief-extraction-prompt.ts",
    "components/assistant/AssistantShell.tsx",
  ];
  let imported = false;
  for (const rel of productionTouch) {
    const src = read(join(root, rel));
    if (/scope-discovery|lib\/scope-discovery/.test(src)) {
      imported = true;
    }
  }
  check("Analyse Job / production path does not import module", !imported);

  check(
    "contract version constant set",
    SCOPE_DISCOVERY_CONTRACT_VERSION === "scope-discovery-suggestion/v1"
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
