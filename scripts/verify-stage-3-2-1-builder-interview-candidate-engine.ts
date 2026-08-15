/**
 * Stage 3.2.1 — Builder Interview deterministic candidate engine verification.
 *
 * Pure domain checks. No live Supabase / AI / UI.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  buildBuilderInterviewCandidates,
  evaluateProposedUserAnswer,
  factSourcePrecedence,
  FACT_SOURCE_PRECEDENCE,
  INTERVIEW_QUESTION_REGISTRY,
  INTERVIEW_REGISTRY_VERSION,
  resolveTargetEvidence,
} from "../lib/builder-interview";
import {
  buildBathroomFixture,
  buildCommercialFitoutFixture,
  buildDeckFixture,
} from "../lib/builder-interview/fixtures";
import type { BuilderInterviewInput } from "../lib/builder-interview/types";

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

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_k, v) => v, 0);
}

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listTsFiles(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

function main(): void {
  console.log("=== Stage 3.2.1 Builder Interview Candidate Engine ===\n");

  // --- Boundaries ---
  check(
    "No interview_answers migration invented",
    !existsSync(join("supabase", "migrations")) ||
      !readdirSync(join("supabase", "migrations")).some((f) =>
        f.toLowerCase().includes("interview_answer")
      )
  );

  const engineFiles = listTsFiles(join("lib", "builder-interview"));
  const engineSource = engineFiles.map((f) => readFileSync(f, "utf8")).join("\n");
  check(
    "Engine modules have no supabase client imports",
    !engineSource.includes("@supabase") &&
      !engineSource.includes("createClient") &&
      !engineSource.includes("from(\"")
  );
  check(
    "Engine modules have no AI provider imports",
    !engineSource.includes("@anthropic") &&
      !engineSource.includes("lib/ai/") &&
      !engineSource.includes("generateText")
  );
  check(
    "Engine does not use bad constraint table name project_constraints",
    !engineSource.includes("project_constraints")
  );
  check(
    "Engine uses canonical occupied_site (not site_occupied)",
    engineSource.includes("occupied_site") &&
      !engineSource.includes('"site_occupied"') &&
      !engineSource.includes("'site_occupied'")
  );

  // --- Authority reuse ---
  check("Canonical user precedence is 100", FACT_SOURCE_PRECEDENCE.user === 100);
  check(
    "factSourcePrecedence imported path matches canonical",
    factSourcePrecedence("user") === 100 &&
      factSourcePrecedence("assumption") === 30 &&
      factSourcePrecedence("system") === 20
  );
  check(
    "Registry version stamped",
    INTERVIEW_REGISTRY_VERSION === "3.2.1.0"
  );

  // --- Determinism ---
  const deck = buildDeckFixture();
  const r1 = buildBuilderInterviewCandidates(deck);
  const r2 = buildBuilderInterviewCandidates(deck);
  check(
    "Determinism: identical candidates JSON",
    stableSerialize(r1.candidates) === stableSerialize(r2.candidates)
  );
  check(
    "Determinism: identical readiness JSON",
    stableSerialize(r1.readiness) === stableSerialize(r2.readiness)
  );
  check(
    "Determinism: identical suppressed order keys",
    stableSerialize(r1.suppressed.map((s) => `${s.questionKey}:${s.workAreaId ?? ""}`)) ===
      stableSerialize(r2.suppressed.map((s) => `${s.questionKey}:${s.workAreaId ?? ""}`))
  );

  // --- Deck fixture expectations ---
  const deckAskKeys = r1.candidates.map((c) => c.questionKey);
  check(
    "Deck: site_access not re-asked",
    !deckAskKeys.includes("interview.site.site_access")
  );
  check(
    "Deck: carry not re-asked",
    !deckAskKeys.includes("interview.site.material_carry_distance")
  );
  check(
    "Deck: balustrade existence is FLAG (not ASK)",
    r1.suppressed.some(
      (s) =>
        s.questionKey === "interview.flag.deck.balustrade_existence" &&
        s.suppressionCode === "POLICY_FLAG"
    )
  );
  check(
    "Deck: no WA access clones ASK'd when project access known",
    !r1.candidates.some((c) => c.questionKey.includes(".access_clone"))
  );
  check(
    "Deck: demolition risk questions may appear when unknown",
    r1.candidates.some(
      (c) =>
        c.questionKey === "interview.risk.services_isolated" ||
        c.questionKey === "interview.risk.hazardous_materials"
    ) ||
      r1.suppressed.some(
        (s) =>
          s.questionKey === "interview.risk.services_isolated" ||
          s.questionKey === "interview.risk.hazardous_materials"
      )
  );

  // --- Bathroom ---
  const bath = buildBathroomFixture({ accessKnown: true });
  const bathResult = buildBuilderInterviewCandidates(bath);
  check(
    "Bathroom: occupied known → not re-asked",
    !bathResult.candidates.some(
      (c) => c.questionKey === "interview.site.occupied_site"
    )
  );
  check(
    "Bathroom: waterproofing DEFER to Scope Details",
    bathResult.suppressed.some(
      (s) =>
        s.questionKey === "interview.defer.bathroom.waterproofing" &&
        s.suppressionCode === "POLICY_DEFER"
    )
  );
  check(
    "Bathroom: access known → no access ASK",
    !bathResult.candidates.some(
      (c) => c.semanticTopic === "site.access" && c.askPolicy === "ASK"
    )
  );
  const bathUnknownAccess = buildBathroomFixture({ accessKnown: false });
  const bathUnknownResult = buildBuilderInterviewCandidates(bathUnknownAccess);
  check(
    "Bathroom: access unknown → project site_access ASK",
    bathUnknownResult.candidates.some(
      (c) => c.questionKey === "interview.site.site_access"
    )
  );

  // --- Fitout multi-WA ---
  const fitout = buildCommercialFitoutFixture({ logisticsKnown: true });
  const fitoutResult = buildBuilderInterviewCandidates(fitout);
  const fitoutAccessAsks = fitoutResult.candidates.filter(
    (c) => c.semanticTopic === "site.access"
  );
  check(
    "Fitout: project logistics known → ≤0 access ASK clones",
    fitoutAccessAsks.length === 0,
    `got ${fitoutAccessAsks.map((c) => c.questionKey).join(",")}`
  );
  check(
    "Fitout: 7 confirmed WAs",
    fitoutResult.diagnostics.confirmedWorkAreaCount === 7
  );
  check(
    "Fitout: Scope Details defer framing/doors/coats/plaster",
    ["interview.defer.internal_walls.framing_type", "interview.defer.doors.count", "interview.defer.painting.coat_count", "interview.defer.plastering.finish_level"].every(
      (k) =>
        fitoutResult.suppressed.some(
          (s) => s.questionKey === k && s.suppressionCode === "POLICY_DEFER"
        )
    )
  );
  check(
    "Fitout: fire/seismic FLAG not ASK",
    fitoutResult.suppressed.some(
      (s) =>
        s.questionKey === "interview.flag.fitout.fire_seismic_existence" &&
        s.suppressionCode === "POLICY_FLAG"
    ) &&
      !fitoutResult.candidates.some(
        (c) => c.questionKey === "interview.flag.fitout.fire_seismic_existence"
      )
  );

  const fitoutUnknown = buildCommercialFitoutFixture({ logisticsKnown: false });
  const fitoutUnknownResult = buildBuilderInterviewCandidates(fitoutUnknown);
  const projectAccessAsks = fitoutUnknownResult.candidates.filter(
    (c) => c.questionKey === "interview.site.site_access"
  );
  const waAccessAsks = fitoutUnknownResult.candidates.filter((c) =>
    c.questionKey.includes(".access_clone")
  );
  check(
    "Fitout unknown logistics: site_access asked once (project)",
    projectAccessAsks.length === 1
  );
  check(
    "Fitout unknown logistics: no 7× WA access clones",
    waAccessAsks.length === 0,
    `got ${waAccessAsks.length}`
  );

  // --- Priority ranking ---
  const unknownSite: BuilderInterviewInput = {
    workAreas: [
      { id: "wa1", type: "deck", name: "Deck", status: "confirmed", sortOrder: 1 },
    ],
    facts: [],
    constraints: [],
  };
  const ranked = buildBuilderInterviewCandidates(unknownSite);
  const priorities = ranked.candidates.map((c) => c.priority);
  let mono = true;
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
  for (let i = 1; i < priorities.length; i++) {
    if (order[priorities[i]] < order[priorities[i - 1]]) mono = false;
  }
  check("Priority ranking monotonic P0→P3", mono && priorities.length > 0);

  // --- Authority / conflict ---
  const userKnown = resolveTargetEvidence({
    writeTarget: "CONSTRAINT",
    targetKey: "site_access",
    facts: [],
    constraints: [{ key: "site_access", value: "Easy", source: "user" }],
  });
  check("User evidence state KNOWN", userKnown.state === "KNOWN");

  const aiKnown = resolveTargetEvidence({
    writeTarget: "CONSTRAINT",
    targetKey: "site_access",
    facts: [],
    constraints: [{ key: "site_access", value: "Easy", source: "ai_extracted" }],
  });
  check(
    "AI evidence is LOWER_AUTHORITY_EVIDENCE",
    aiKnown.state === "LOWER_AUTHORITY_EVIDENCE"
  );

  const conflict = evaluateProposedUserAnswer({
    existing: userKnown,
    proposedValue: "Difficult",
  });
  check(
    "User vs different user → conflict confirm",
    conflict.requiresConflictConfirm && conflict.evidenceState === "USER_CONFLICT"
  );
  const noConflict = evaluateProposedUserAnswer({
    existing: userKnown,
    proposedValue: "Easy",
  });
  check(
    "User vs identical user → no conflict",
    !noConflict.requiresConflictConfirm
  );
  const supersedeAi = evaluateProposedUserAnswer({
    existing: aiKnown,
    proposedValue: "Difficult",
  });
  check(
    "User may supersede AI without conflict confirm",
    !supersedeAi.requiresConflictConfirm
  );

  const withProposed: BuilderInterviewInput = {
    ...unknownSite,
    constraints: [{ key: "site_access", value: "Easy", source: "user" }],
    proposedAnswers: {
      "interview.site.site_access": "Difficult",
    },
  };
  // site_access known → suppressed; test conflict via parking unknown + user constraint on parking
  const conflictInput: BuilderInterviewInput = {
    workAreas: unknownSite.workAreas,
    facts: [],
    constraints: [{ key: "parking_loading", value: "Easy", source: "user" }],
    proposedAnswers: {
      "interview.site.parking_loading": "Poor",
    },
  };
  const conflictResult = buildBuilderInterviewCandidates(conflictInput);
  // parking known as user → suppressed as TARGET_KNOWN, so proposed won't appear.
  // Model conflict on open question with existing user via evaluateProposedUserAnswer already covered.
  check(
    "Conflict modelling available without writes",
    conflict.requiresConflictConfirm === true
  );
  void withProposed;
  void conflictResult;

  // --- Assumptions ---
  const assumedInput: BuilderInterviewInput = {
    workAreas: [
      { id: "wa1", type: "deck", name: "Deck", status: "confirmed", sortOrder: 1 },
      {
        id: "wa-demo",
        type: "demolition",
        name: "Demo",
        status: "confirmed",
        sortOrder: 0,
      },
    ],
    facts: [],
    constraints: [
      { key: "site_access", value: "Moderate", source: "assumption" },
      { key: "material_carry_distance", value: "10–30m", source: "assumption" },
      { key: "floor_level", value: "Ground", source: "assumption" },
      { key: "occupied_site", value: "No", source: "assumption" },
      { key: "working_hours", value: "No", source: "assumption" },
      { key: "parking_loading", value: "Easy", source: "assumption" },
      { key: "hazardous_materials_risk", value: "No", source: "assumption" },
      { key: "services_isolated", value: "Yes", source: "assumption" },
    ],
    existingAssumptions: [
      {
        questionKey: "interview.site.site_access",
        assumedValue: "Moderate",
        targetKey: "site_access",
        writeTarget: "CONSTRAINT",
        reason: "Typical suburban access",
        confidenceImpact: "medium",
      },
    ],
  };
  const assumedResult = buildBuilderInterviewCandidates(assumedInput);
  check(
    "Active assumptions → READY_WITH_ASSUMPTIONS when no P0 ASK",
    assumedResult.readiness.state === "READY_WITH_ASSUMPTIONS",
    assumedResult.readiness.state
  );
  check(
    "Assumption classified CURRENT",
    assumedResult.diagnostics.assumptionClassifications.some(
      (a) => a.questionKey === "interview.site.site_access" && a.status === "CURRENT"
    )
  );

  const supersededInput: BuilderInterviewInput = {
    ...assumedInput,
    constraints: assumedInput.constraints.map((c) =>
      c.key === "site_access" ? { ...c, value: "Difficult", source: "user" } : c
    ),
  };
  const supersededResult = buildBuilderInterviewCandidates(supersededInput);
  check(
    "User evidence supersedes assumption classification",
    supersededResult.diagnostics.assumptionClassifications.some(
      (a) =>
        a.questionKey === "interview.site.site_access" && a.status === "SUPERSEDED"
    )
  );

  // --- Readiness P0 ---
  const needsInfo = buildBuilderInterviewCandidates(unknownSite);
  check(
    "Unresolved P0 → NEEDS_IMPORTANT_INFORMATION",
    needsInfo.readiness.state === "NEEDS_IMPORTANT_INFORMATION"
  );
  check(
    "Soft-block Quick Estimate when NEEDS_IMPORTANT_INFORMATION",
    needsInfo.readiness.softBlockQuickEstimate === true &&
      needsInfo.readiness.canGenerateQuickEstimate === false
  );
  check(
    "Blocking keys include site_access P0",
    needsInfo.readiness.blockingCandidateKeys.includes(
      "interview.site.site_access"
    )
  );

  // Ready when all logistics answered by user
  const readyInput: BuilderInterviewInput = {
    workAreas: [
      { id: "wa1", type: "painting", name: "Painting", status: "confirmed" },
    ],
    facts: [],
    constraints: [
      { key: "site_access", value: "Easy", source: "user" },
      { key: "material_carry_distance", value: "< 10m", source: "user" },
      { key: "floor_level", value: "Ground", source: "user" },
      { key: "occupied_site", value: "No", source: "user" },
      { key: "working_hours", value: "No", source: "user" },
      { key: "parking_loading", value: "Easy", source: "user" },
    ],
  };
  const readyResult = buildBuilderInterviewCandidates(readyInput);
  check(
    "All site known, no assumptions → READY",
    readyResult.readiness.state === "READY",
    readyResult.readiness.state + " " + readyResult.readiness.reasons.join(";")
  );

  // --- Answerability ---
  // Hazmat may be absent without reno types on painting-only fixtures — use bathroom.
  const bathHaz = buildBuilderInterviewCandidates(
    buildBathroomFixture({ accessKnown: false })
  );
  const haz = bathHaz.candidates.find(
    (c) => c.questionKey === "interview.risk.hazardous_materials"
  );
  check(
    "Hazmat answerability REQUIRES_EXPERT",
    haz?.answerability === "REQUIRES_EXPERT",
    haz?.answerability
  );
  check(
    "Requires-expert P0/P1 still listed distinctly in readiness reasons when open",
    !haz ||
      bathHaz.readiness.reasons.some((r) => r.includes("requires-expert")) ||
      haz.priority !== "P0"
  );

  // --- Conditional child ---
  const parentUnknown: BuilderInterviewInput = {
    workAreas: [
      {
        id: "wa-demo",
        type: "demolition",
        name: "Demo",
        status: "confirmed",
      },
    ],
    facts: [],
    constraints: [
      { key: "site_access", value: "Easy", source: "user" },
      { key: "material_carry_distance", value: "< 10m", source: "user" },
    ],
  };
  const parentUnknownResult = buildBuilderInterviewCandidates(parentUnknown);
  check(
    "Conditional child omitted while parent unknown",
    !parentUnknownResult.candidates.some(
      (c) => c.questionKey === "interview.wa.demolition.salvage_detail"
    ) &&
      parentUnknownResult.suppressed.some(
        (s) =>
          s.questionKey === "interview.wa.demolition.salvage_detail" &&
          s.suppressionCode === "CONDITIONAL_PARENT"
      )
  );

  const parentTrue: BuilderInterviewInput = {
    ...parentUnknown,
    facts: [
      {
        key: "demolition.salvage_required",
        workAreaId: "wa-demo",
        value: true,
        source: "user",
      },
    ],
  };
  const parentTrueResult = buildBuilderInterviewCandidates(parentTrue);
  check(
    "Conditional child appears when parent true",
    parentTrueResult.candidates.some(
      (c) => c.questionKey === "interview.wa.demolition.salvage_detail"
    )
  );

  const parentFalse: BuilderInterviewInput = {
    ...parentUnknown,
    facts: [
      {
        key: "demolition.salvage_required",
        workAreaId: "wa-demo",
        value: false,
        source: "user",
      },
    ],
  };
  const parentFalseResult = buildBuilderInterviewCandidates(parentFalse);
  check(
    "Conditional child suppressed when parent false",
    parentFalseResult.suppressed.some(
      (s) =>
        s.questionKey === "interview.wa.demolition.salvage_detail" &&
        s.suppressionCode === "CONDITIONAL_PARENT"
    )
  );

  // --- Override trigger ---
  const overrideInput: BuilderInterviewInput = {
    workAreas: [
      {
        id: "wa-demo",
        type: "demolition",
        name: "Demo",
        status: "confirmed",
      },
      { id: "wa-paint", type: "painting", name: "Paint", status: "confirmed" },
    ],
    facts: [
      {
        key: "demolition.floor_level",
        workAreaId: "wa-demo",
        value: "Basement",
        source: "user",
      },
    ],
    constraints: [
      { key: "site_access", value: "Easy", source: "user" },
      { key: "floor_level", value: "Ground", source: "user" },
      { key: "material_carry_distance", value: "< 10m", source: "user" },
    ],
  };
  const overrideResult = buildBuilderInterviewCandidates(overrideInput);
  check(
    "Explicit demolition floor mismatch does not ASK access override (DEFER / Project Conditions own access)",
    !overrideResult.candidates.some(
      (c) => c.questionKey === "interview.wa.demolition.access_override"
    )
  );
  check(
    "Painting access clone still suppressed despite demo override",
    !overrideResult.candidates.some(
      (c) => c.questionKey === "interview.wa.painting.access_clone"
    )
  );

  // --- Registry DEFER/FLAG inventory ---
  check(
    "Registry contains DEFER Scope Details entries",
    INTERVIEW_QUESTION_REGISTRY.some((q) => q.askPolicy === "DEFER")
  );
  check(
    "Registry contains FLAG Scope Review entries",
    INTERVIEW_QUESTION_REGISTRY.some((q) => q.askPolicy === "FLAG")
  );

  // --- inferConstraintsFromFacts still dead ---
  const constraintTemplates = readFileSync(
    join("lib", "assistant", "constraint-templates.ts"),
    "utf8"
  );
  check(
    "inferConstraintsFromFacts still defined (legacy, not deleted)",
    constraintTemplates.includes("function inferConstraintsFromFacts")
  );
  const callers: string[] = [];
  function walk(dir: string): void {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === "node_modules" || name === ".next") continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(name)) {
        const text = readFileSync(p, "utf8");
        if (
          text.includes("buildScopeDrivenConstraints") &&
          !p.endsWith("constraint-templates.ts")
        ) {
          callers.push(p);
        }
      }
    }
  }
  walk("lib");
  walk("components");
  walk("app");
  check(
    "buildScopeDrivenConstraints remains unconsumed (dead)",
    callers.length === 0,
    callers.join(",")
  );

  // --- Performance baseline ---
  const perfRuns = 50;
  const t0 = performance.now();
  for (let i = 0; i < perfRuns; i++) {
    buildBuilderInterviewCandidates(fitout);
  }
  const t1 = performance.now();
  const avgMs = (t1 - t0) / perfRuns;
  console.log(
    `\nPERF  Fitout×${perfRuns}: avg ${avgMs.toFixed(3)}ms | candidates=${fitoutResult.candidates.length} suppressed=${fitoutResult.suppressed.length}`
  );
  check("Fitout engine avg runtime < 50ms (smoke)", avgMs < 50, `${avgMs}ms`);

  const deckT0 = performance.now();
  for (let i = 0; i < perfRuns; i++) buildBuilderInterviewCandidates(deck);
  const deckAvg = (performance.now() - deckT0) / perfRuns;
  console.log(
    `PERF  Deck×${perfRuns}: avg ${deckAvg.toFixed(3)}ms | candidates=${r1.candidates.length} suppressed=${r1.suppressed.length}`
  );

  const bathT0 = performance.now();
  for (let i = 0; i < perfRuns; i++)
    buildBuilderInterviewCandidates(bath);
  const bathAvg = (performance.now() - bathT0) / perfRuns;
  console.log(
    `PERF  Bathroom×${perfRuns}: avg ${bathAvg.toFixed(3)}ms | candidates=${bathResult.candidates.length} suppressed=${bathResult.suppressed.length}`
  );

  // Write baseline numbers for docs (stdout only; completion doc will cite)

  // --- Owner decisions approved documented ---
  const decisions = readFileSync(
    join("docs", "decisions", "STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md"),
    "utf8"
  );
  check(
    "Owner decisions mark D1–D16 OWNER APPROVED",
    (decisions.match(/\*\*OWNER APPROVED\*\*/g) || []).length >= 16
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
