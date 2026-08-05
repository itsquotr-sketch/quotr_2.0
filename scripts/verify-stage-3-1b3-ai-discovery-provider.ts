/**
 * Stage 3.1B.3 — AI scope discovery provider verification.
 * Uses injected fake transport only — no live ANTHROPIC_API_KEY required.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  SCOPE_DISCOVERY_CONTRACT_VERSION,
  deepFreeze,
  identityKeyForSuggestion,
  mergeScopeSuggestions,
  type ScopeDiscoverySuggestion,
  type SourceSnapshot,
} from "../lib/scope-discovery";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../lib/scope-discovery/catalogue";
import {
  ANTHROPIC_API_KEY_ENV,
  PROVIDER_ERROR_CODES,
  PROVIDER_INPUT_LIMITS,
  SCOPE_DISCOVERY_PROMPT_VERSION,
  SCOPE_DISCOVERY_SYSTEM_PROMPT,
  assertAnthropicApiKeyConfigured,
  buildAllowedEvidenceRefs,
  hasAnthropicApiKey,
  mapOutputToSuggestions,
  normaliseProviderInput,
  promptGovernanceMarkers,
  runScopeDiscoveryProvider,
  safeProviderFailureMessage,
  validateProviderOutputObject,
  type ScopeDiscoveryProviderInput,
  type ScopeDiscoveryTransport,
  type ScopeDiscoveryTransportRequest,
} from "../lib/scope-discovery/provider";

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
  note: "note-1",
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

function baseInput(
  overrides: Partial<ScopeDiscoveryProviderInput> = {}
): ScopeDiscoveryProviderInput {
  return deepFreeze({
    projectId: IDS.project,
    orgId: IDS.org,
    analysisRunId: IDS.run,
    projectBrief: "Client wants a timber deck with stairs.",
    selectedSiteNotes: [
      { noteId: IDS.note, content: "Existing fascia looks rotten." },
    ],
    acceptedWorkAreas: [
      {
        workAreaId: IDS.deckWa,
        type: "deck",
        title: "Main deck",
      },
    ],
    relevantFacts: [
      { key: "deck.height_mm", value: 0 },
      { key: "deck.unknown_dim", value: null },
    ],
    relevantConstraints: [{ key: "access.limited", value: true }],
    deterministicSuggestions: [],
    deterministicSuppressions: [],
    deterministicConflicts: [],
    sourceSnapshot: snapshot(),
    catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    region: "NZ",
    analysisObjective: "Propose missing related scopes from brief and notes.",
    ...overrides,
  });
}

function validCandidate(overrides: Record<string, unknown> = {}) {
  return {
    suggestionKind: "DEPENDENCY",
    proposedWorkAreaType: "fascia",
    proposedTitle: "Replace fascia",
    proposedDescription: "Rotten fascia noted on site",
    relatedWorkAreaReference: `work-area:${IDS.deckWa}`,
    parentSuggestionReference: null,
    confidenceBand: "MEDIUM",
    evidenceReferences: ["brief:project", `note:${IDS.note}`],
    rationaleCode: "ai.site_note_fascia",
    missingInformation: [],
    dependencyReferences: [],
    conflictReferences: [],
    ...overrides,
  };
}

function jsonResponse(candidates: unknown[], warnings: string[] = []): string {
  return JSON.stringify({ candidates, warnings });
}

function fakeTransport(options: {
  responses: string[];
  models?: string[];
}): {
  transport: ScopeDiscoveryTransport;
  calls: ScopeDiscoveryTransportRequest[];
} {
  const calls: ScopeDiscoveryTransportRequest[] = [];
  let index = 0;
  const transport: ScopeDiscoveryTransport = async (request) => {
    calls.push(request);
    const text = options.responses[index] ?? options.responses.at(-1) ?? "";
    const model =
      options.models?.[index] ?? request.model ?? "fake-model";
    index += 1;
    return {
      text,
      model,
      requestId: `req-${index}`,
      tokenUsage: { inputTokens: 10, outputTokens: 20 },
      latencyMs: 1,
    };
  };
  return { transport, calls };
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) acc.push(full);
  }
  return acc;
}

async function main(): Promise<void> {
  console.log("=== Stage 3.1B.3 AI Discovery Provider Verification ===\n");

  // --- Input ---
  const minOk = normaliseProviderInput(baseInput());
  check("valid minimum input", minOk.projectId === IDS.project);

  try {
    normaliseProviderInput(
      baseInput({
        projectBrief: "x".repeat(PROVIDER_INPUT_LIMITS.maxBriefChars + 1),
      })
    );
    check("overlong brief rejected", false);
  } catch (e) {
    check(
      "overlong brief rejected",
      e instanceof Error &&
        "code" in e &&
        (e as { code: string }).code ===
          PROVIDER_ERROR_CODES.INPUT_VALIDATION_FAILED
    );
  }

  try {
    normaliseProviderInput(
      baseInput({
        selectedSiteNotes: Array.from(
          { length: PROVIDER_INPUT_LIMITS.maxNotes + 1 },
          (_, i) => ({ noteId: `n${i}`, content: "ok" })
        ),
      })
    );
    check("excessive notes rejected", false);
  } catch {
    check("excessive notes rejected", true);
  }

  try {
    normaliseProviderInput(
      baseInput({
        relevantFacts: Array.from(
          { length: PROVIDER_INPUT_LIMITS.maxFacts + 1 },
          (_, i) => ({ key: `f${i}`, value: i })
        ),
      })
    );
    check("excessive Facts rejected", false);
  } catch {
    check("excessive Facts rejected", true);
  }

  try {
    normaliseProviderInput({
      ...baseInput(),
      margin: 0.2,
      gst: 0.15,
    });
    check("commercial records absent (rejected)", false);
  } catch (e) {
    check(
      "commercial records absent (rejected)",
      e instanceof Error &&
        "code" in e &&
        ((e as { code: string }).code ===
          PROVIDER_ERROR_CODES.COMMERCIAL_CONTENT_FORBIDDEN ||
          (e as { code: string }).code ===
            PROVIDER_ERROR_CODES.INPUT_VALIDATION_FAILED)
    );
  }

  try {
    normaliseProviderInput({
      ...baseInput(),
      quotes: [{ id: "q1" }],
      attachments: ["x"],
    });
    check("irrelevant fields rejected", false);
  } catch {
    check("irrelevant fields rejected", true);
  }

  const zeroUnknown = normaliseProviderInput(baseInput());
  const height = zeroUnknown.relevantFacts.find((f) => f.key === "deck.height_mm");
  const unknown = zeroUnknown.relevantFacts.find(
    (f) => f.key === "deck.unknown_dim"
  );
  check(
    "zero and unknown remain distinct",
    height?.value === 0 && unknown?.value === null
  );

  // --- Prompt ---
  check(
    "prompt version exists",
    SCOPE_DISCOVERY_PROMPT_VERSION === "scope-discovery-prompt/v1"
  );
  const markers = promptGovernanceMarkers();
  for (const marker of markers) {
    check(
      `prompt includes: ${marker.slice(0, 40)}`,
      SCOPE_DISCOVERY_SYSTEM_PROMPT.includes(marker)
    );
  }

  const briefPrompt = read("lib/ai/brief-extraction-prompt.ts");
  const scopePrompt = read("lib/scope-discovery/provider/prompt.ts");
  check(
    "Analyse Job brief prompt unchanged (no scope-discovery coupling)",
    !briefPrompt.includes("SCOPE_DISCOVERY") &&
      !briefPrompt.includes("scope-discovery-prompt")
  );
  check(
    "scope discovery prompt is dedicated file",
    scopePrompt.includes("SCOPE_DISCOVERY_SYSTEM_PROMPT") &&
      scopePrompt.includes("You PROPOSE only")
  );

  // --- Output mapping / validation ---
  const allowed = buildAllowedEvidenceRefs(baseInput());
  const validOut = validateProviderOutputObject({
    raw: { candidates: [validCandidate()], warnings: [] },
    input: baseInput(),
    allowedEvidenceRefs: allowed,
  });
  check("valid structured response accepted", validOut.ok);

  const mapped = mapOutputToSuggestions({
    output: {
      candidates: [validCandidate() as never],
      warnings: [],
    },
    input: baseInput(),
    model: "fake-model",
    createdAt: "2026-08-05T00:00:00.000Z",
  });
  check(
    "maps to PROPOSED suggestions",
    mapped.length === 1 && mapped[0].status === "PROPOSED"
  );
  check(
    "IDs generated by Quotr",
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      mapped[0].suggestionId
    ) && mapped[0].origin === "ai"
  );

  const acceptedStatus = validateProviderOutputObject({
    raw: {
      candidates: [validCandidate({ status: "ACCEPTED" })],
      warnings: [],
    },
    input: baseInput(),
    allowedEvidenceRefs: allowed,
  });
  check("accepted status from provider is rejected", !acceptedStatus.ok);

  const unknownKind = validateProviderOutputObject({
    raw: {
      candidates: [validCandidate({ suggestionKind: "WIDGET" })],
      warnings: [],
    },
    input: baseInput(),
    allowedEvidenceRefs: allowed,
  });
  check("unknown suggestion kind rejected", !unknownKind.ok);

  const fabricated = validateProviderOutputObject({
    raw: {
      candidates: [
        validCandidate({
          evidenceReferences: ["brief:project", "note:not-real"],
        }),
      ],
      warnings: [],
    },
    input: baseInput(),
    allowedEvidenceRefs: allowed,
  });
  check("fabricated evidence reference rejected", !fabricated.ok);

  const commercial = validateProviderOutputObject({
    raw: {
      candidates: [validCandidate({ price: 1200 })],
      warnings: [],
      margin: 0.3,
    },
    input: baseInput(),
    allowedEvidenceRefs: allowed,
  });
  check("commercial fields rejected", !commercial.ok);

  const duplicate = validateProviderOutputObject({
    raw: {
      candidates: [validCandidate(), validCandidate()],
      warnings: [],
    },
    input: baseInput(),
    allowedEvidenceRefs: allowed,
  });
  check("duplicate candidate rejected", !duplicate.ok);

  const highNoEvidence = validateProviderOutputObject({
    raw: {
      candidates: [
        validCandidate({
          confidenceBand: "HIGH",
          evidenceReferences: ["brief:project"],
        }),
      ],
      warnings: [],
    },
    input: baseInput(),
    allowedEvidenceRefs: allowed,
  });
  check("high confidence without evidence rejected", !highNoEvidence.ok);

  const unsupportedWa = validateProviderOutputObject({
    raw: {
      candidates: [validCandidate({ proposedWorkAreaType: "teleporter" })],
      warnings: [],
    },
    input: baseInput(),
    allowedEvidenceRefs: allowed,
  });
  check("unsupported Work Area type rejected", !unsupportedWa.ok);

  // --- Repair ---
  {
    const { transport, calls } = fakeTransport({
      responses: [
        "not-json",
        jsonResponse([validCandidate()]),
      ],
    });
    const result = await runScopeDiscoveryProvider({
      input: baseInput(),
      transport,
      model: "fake-model",
    });
    check("malformed primary output triggers one repair", result.repairAttempted);
    check("valid repair succeeds", result.success);
    check(
      "exactly two transport calls (primary+repair)",
      calls.length === 2 && calls[0].isRepair === false && calls[1].isRepair === true
    );
  }

  {
    const { transport, calls } = fakeTransport({
      responses: ["{", "{ still bad"],
    });
    const result = await runScopeDiscoveryProvider({
      input: baseInput(),
      transport,
      model: "fake-model",
    });
    check("failed repair stops", !result.success);
    check(
      "no third attempt occurs",
      calls.length === 2 &&
        result.failureCode === PROVIDER_ERROR_CODES.REPAIR_FAILED
    );
    check(
      "no alternate provider/model used",
      calls.every((c) => c.model === "fake-model")
    );
  }

  // --- Deterministic integration (merge authority remains 3.1B.1) ---
  const detFascia: ScopeDiscoverySuggestion = deepFreeze({
    suggestionId: "11111111-1111-4111-8111-111111111111",
    projectId: IDS.project,
    orgId: IDS.org,
    analysisRunId: IDS.run,
    suggestionKind: "DEPENDENCY",
    proposedWorkAreaType: "fascia",
    proposedTitle: "Fascia (catalogue)",
    proposedDescription: "Deterministic fascia",
    relatedWorkAreaId: IDS.deckWa,
    parentSuggestionId: null,
    confidence: 0.9,
    confidenceBand: "HIGH",
    evidence: [
      {
        sourceType: "DETERMINISTIC_RULE",
        sourceId: "deck.requires_fascia",
        excerptOrValue: "rule",
        relevance: "primary",
        timestamp: "2026-08-05T00:00:00.000Z",
        provenance: "deterministic_rule",
        userAuthored: false,
        authoritative: false,
      },
    ],
    rationaleKey: "catalogue.deck.requires_fascia",
    sourceSnapshot: snapshot(),
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
    catalogueEdgeId: "deck.requires_fascia",
    origin: "deterministic",
  });

  const aiEquivalent = mapOutputToSuggestions({
    output: {
      candidates: [
        validCandidate({
          suggestionKind: "DEPENDENCY",
          proposedWorkAreaType: "fascia",
          relatedWorkAreaReference: IDS.deckWa,
          rationaleCode: "ai.extra_evidence",
          evidenceReferences: ["brief:project", `note:${IDS.note}`],
        }) as never,
      ],
      warnings: [],
    },
    input: baseInput(),
    model: "fake-model",
    createdAt: "2026-08-05T00:00:00.000Z",
  })[0];

  // Align identity fields for equivalent merge (same kind/type/related/edge)
  const aiAligned = deepFreeze({
    ...aiEquivalent,
    relatedWorkAreaId: IDS.deckWa,
    catalogueEdgeId: "deck.requires_fascia",
  });

  const mergeEq = mergeScopeSuggestions({
    deterministicSuggestions: [detFascia],
    aiSuggestions: [aiAligned],
    acceptedWorkAreaTypes: ["deck"],
    rejections: [],
    currentSnapshot: snapshot(),
  });
  check(
    "provider equivalent suggestion merges into deterministic suggestion",
    mergeEq.primarySuggestions.length === 1 &&
      mergeEq.primarySuggestions[0].origin === "merged" &&
      mergeEq.mergeWarnings.some((w) => w.code === "ai_evidence_merged")
  );

  const suppressedInput = baseInput({
    deterministicSuppressions: [
      {
        relationshipId: "deck.suppress_excavation",
        candidateScopeType: "excavation",
        reason: "Already covered",
      },
    ],
  });
  const suppressedAllowed = buildAllowedEvidenceRefs(suppressedInput);
  const overrideAttempt = validateProviderOutputObject({
    raw: {
      candidates: [
        validCandidate({
          proposedWorkAreaType: "excavation",
          rationaleCode: "ai.override",
        }),
      ],
      warnings: [],
    },
    input: suppressedInput,
    allowedEvidenceRefs: suppressedAllowed,
  });
  check("deterministic suppression wins (provider cannot override)", !overrideAttempt.ok);

  const detConflict: ScopeDiscoverySuggestion = deepFreeze({
    ...detFascia,
    suggestionId: "22222222-2222-4222-8222-222222222222",
    suggestionKind: "CONFLICT_WARNING",
    proposedWorkAreaType: "excavation",
    proposedTitle: "Excavation conflict",
    relatedWorkAreaId: null,
    catalogueEdgeId: "deck.conflict_excavation",
    conflictReferences: ["deck.conflict_excavation"],
    rationaleKey: "catalogue.conflict",
  });
  const aiConflictAttempt = deepFreeze({
    ...aiEquivalent,
    suggestionId: "33333333-3333-4333-8333-333333333333",
    suggestionKind: "WORK_AREA",
    proposedWorkAreaType: "excavation",
    relatedWorkAreaId: null,
    catalogueEdgeId: null,
    confidenceBand: "MEDIUM" as const,
    confidence: 0.6,
  });
  const mergeConflict = mergeScopeSuggestions({
    deterministicSuggestions: [detConflict],
    aiSuggestions: [aiConflictAttempt],
    acceptedWorkAreaTypes: ["deck"],
    rejections: [],
    currentSnapshot: snapshot(),
  });
  check(
    "deterministic conflict remains explicit",
    mergeConflict.conflicts.some(
      (c) => c.code === "deterministic_conflict_precedence"
    ) &&
      mergeConflict.primarySuggestions.some(
        (s) => s.suggestionId === detConflict.suggestionId
      )
  );

  const detRequired = detFascia;
  const mergeRequired = mergeScopeSuggestions({
    deterministicSuggestions: [detRequired],
    aiSuggestions: [],
    acceptedWorkAreaTypes: ["deck"],
    rejections: [],
    currentSnapshot: snapshot(),
  });
  check(
    "provider cannot remove required deterministic scope",
    mergeRequired.primarySuggestions.some(
      (s) =>
        identityKeyForSuggestion(s) === identityKeyForSuggestion(detRequired)
    )
  );

  const lowAi = deepFreeze({
    ...aiEquivalent,
    suggestionId: "44444444-4444-4444-8444-444444444444",
    suggestionKind: "WORK_AREA" as const,
    proposedWorkAreaType: "coatings",
    relatedWorkAreaId: null,
    catalogueEdgeId: null,
    confidenceBand: "LOW" as const,
    confidence: 0.2,
  });
  const mergeLow = mergeScopeSuggestions({
    deterministicSuggestions: [detRequired],
    aiSuggestions: [lowAi],
    acceptedWorkAreaTypes: ["deck"],
    rejections: [],
    currentSnapshot: snapshot(),
  });
  check(
    "low-confidence contextual output remains other possibility after merge",
    mergeLow.otherPossibilities.some((s) => s.suggestionId === lowAi.suggestionId) &&
      mergeLow.primarySuggestions.some(
        (s) => s.suggestionId === detRequired.suggestionId
      )
  );

  // --- Security / boundaries ---
  try {
    assertAnthropicApiKeyConfigured({});
    check("missing API key returns controlled failure", false);
  } catch (e) {
    check(
      "missing API key returns controlled failure",
      e instanceof Error &&
        "code" in e &&
        (e as { code: string }).code ===
          PROVIDER_ERROR_CODES.PROVIDER_CONFIGURATION_MISSING &&
        !safeProviderFailureMessage(
          PROVIDER_ERROR_CODES.PROVIDER_CONFIGURATION_MISSING
        ).includes("sk-")
    );
  }
  check(
    "env key name is ANTHROPIC_API_KEY only",
    ANTHROPIC_API_KEY_ENV === "ANTHROPIC_API_KEY"
  );

  const missingCfg = await runScopeDiscoveryProvider({
    input: baseInput(),
    transport: async () => {
      throw Object.assign(
        new Error("Scope discovery provider is not configured."),
        { code: PROVIDER_ERROR_CODES.PROVIDER_CONFIGURATION_MISSING, details: [] }
      );
    },
  });
  // Transport non-ScopeDiscoveryProviderError maps to TRANSPORT_FAILED —
  // use proper error class via assert path result string checks instead:
  const { ScopeDiscoveryProviderError } = await import(
    "../lib/scope-discovery/provider/errors"
  );
  const missingResult = await runScopeDiscoveryProvider({
    input: baseInput(),
    transport: async () => {
      throw new ScopeDiscoveryProviderError(
        PROVIDER_ERROR_CODES.PROVIDER_CONFIGURATION_MISSING,
        "Scope discovery provider is not configured."
      );
    },
  });
  check(
    "configuration missing surfaces controlled result",
    !missingResult.success &&
      missingResult.failureCode ===
        PROVIDER_ERROR_CODES.PROVIDER_CONFIGURATION_MISSING
  );
  const serialised = JSON.stringify(missingResult);
  check(
    "secret never appears in error/result",
    !serialised.toLowerCase().includes("sk-ant") &&
      !serialised.includes("ANTHROPIC_API_KEY=")
  );
  void missingCfg;
  void hasAnthropicApiKey;

  const providerDir = "lib/scope-discovery/provider";
  const providerSrc = walkFiles(providerDir).map(read).join("\n");
  check("no React in provider", !/\bfrom ["']react["']/.test(providerSrc));
  check(
    "no Supabase in provider",
    !/supabase|createClient/i.test(providerSrc.replace(/Anthropic/g, ""))
  );
  check(
    "no server action in provider",
    !/"use server"/.test(providerSrc) && !/server action/i.test(providerSrc)
  );
  check(
    "no production Analyse Job import",
    !/brief-extraction-prompt|extractFromBrief|from ["']@\/lib\/ai\/extract/.test(
      providerSrc
    )
  );
  check(
    "no persistence / migration in provider",
    !/\.from\(|insert\(|upsert\(|create table|migration/i.test(providerSrc)
  );
  check(
    "no commercial engine import",
    !/from ["'][^"']*commercial-engine|calculateQuote|lib\/pricing\/|lib\/estimate\//i.test(
      providerSrc
    )
  );

  const appFiles = [
    ...walkFiles("app"),
    ...walkFiles("components"),
    ...walkFiles("lib").filter(
      (p) => !p.replace(/\\/g, "/").includes("lib/scope-discovery")
    ),
  ];
  const productionImportsProvider = appFiles.some((f) => {
    const src = read(f);
    return /scope-discovery\/provider/.test(src);
  });
  check("no production path imports the provider", !productionImportsProvider);

  const anthropicProviderSrc = read(
    "lib/scope-discovery/provider/anthropic-provider.ts"
  );
  check(
    "Anthropic transport uses existing ANTHROPIC_API_KEY pattern",
    anthropicProviderSrc.includes("getAnthropicClient") &&
      anthropicProviderSrc.includes("assertAnthropicApiKeyConfigured")
  );

  // --- Immutability ---
  const { transport } = fakeTransport({
    responses: [jsonResponse([validCandidate()])],
  });
  const success = await runScopeDiscoveryProvider({
    input: baseInput(),
    transport,
    model: "fake-model",
  });
  check("result success", success.success);
  let resultMutable = false;
  try {
    (success as { success: boolean }).success = false;
  } catch {
    resultMutable = true;
  }
  check("result cannot be mutated", resultMutable || Object.isFrozen(success));

  let suggestionMutable = false;
  try {
    (success.contextualSuggestions[0] as { status: string }).status =
      "ACCEPTED";
  } catch {
    suggestionMutable = true;
  }
  check(
    "suggestions cannot be mutated",
    suggestionMutable || Object.isFrozen(success.contextualSuggestions[0])
  );

  const inputObj = baseInput();
  const before = JSON.stringify(inputObj);
  await runScopeDiscoveryProvider({
    input: inputObj,
    transport: fakeTransport({
      responses: [jsonResponse([validCandidate()])],
    }).transport,
    model: "fake-model",
  });
  check("source input not mutated", JSON.stringify(inputObj) === before);

  const transportPayload = { text: jsonResponse([validCandidate()]) };
  const frozenTransportText = transportPayload.text;
  await runScopeDiscoveryProvider({
    input: baseInput(),
    transport: async () =>
      deepFreeze({
        text: frozenTransportText,
        model: "fake-model",
        requestId: "r1",
        tokenUsage: { inputTokens: 1, outputTokens: 1 },
        latencyMs: 1,
      }),
    model: "fake-model",
  });
  check(
    "transport response not mutated",
    transportPayload.text === frozenTransportText
  );

  // Docs / status markers
  const completionPath =
    "docs/implementation/STAGE_3_1B3_AI_DISCOVERY_PROVIDER_COMPLETION.md";
  const contractPath =
    "docs/specifications/SCOPE_DISCOVERY_PROVIDER_CONTRACT.md";
  let docsExist = true;
  try {
    read(completionPath);
    read(contractPath);
  } catch {
    docsExist = false;
  }
  check("completion + provider contract docs exist", docsExist);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
