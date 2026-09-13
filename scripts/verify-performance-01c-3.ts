/**
 * PERFORMANCE-01C-3 — independent entitlement + membership check parallelisation.
 *
 * Run: npx --yes tsx scripts/verify-performance-01c-3.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { detailsReadyCardVisible } from "../lib/assistant/clarify/interaction";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
import {
  composeEntitlementAndPermissionDecision,
  runIndependentEntitlementAndPermissionChecks,
} from "../lib/team/entitlement-permission-composition";
import { decideMembershipAuthority } from "../lib/team/membership-authority";
import {
  PERMISSION_DENIED_MESSAGE,
  roleAllowsPermission,
} from "../lib/team/permissions";

const root = resolve(import.meta.dirname ?? __dirname, "..");

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

function read(relativePath: string): string {
  const path = join(root, relativePath);
  if (!existsSync(path)) {
    check(`${relativePath} exists`, false, path);
    return "";
  }
  return readFileSync(path, "utf8");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function okPermission() {
  return {
    ok: true as const,
    role: "estimator" as const,
    orgId: "org-a",
    userId: "user-1",
  };
}

function forbiddenPermission() {
  return {
    ok: false as const,
    error: PERMISSION_DENIED_MESSAGE,
    reasonCode: "forbidden" as const,
  };
}

function entitledOk() {
  return { ok: true, message: null, reasonCode: null };
}

function entitlementDenied(message = "This is not included on the current plan.") {
  return {
    ok: false,
    message,
    reasonCode: "upgrade_required" as const,
  };
}

const DENIED_TRIAL =
  "Your 14-day trial has ended. Choose Quotr Builder or Business to continue creating and sending new work.";

console.log("verify-performance-01c-3: starting…\n");

const compositionSrc = read("lib/team/entitlement-permission-composition.ts");
const permissionServer = read("lib/team/permission-server.ts");
const factActions = read("lib/assistant/fact-actions.ts");
const ownershipSrc = read("lib/security/org-ownership.ts");
const persistSrc = read("lib/assistant/scope-persistence.ts");
const staleSrc = read("lib/estimate/stale.ts");
const mutationResult = read("lib/assistant/load-assistant-mutation-result.ts");

console.log("-- STRUCTURE --");
check(
  "requireEntitlementAndPermission runs both checks via Promise.all helper",
  permissionServer.includes("runIndependentEntitlementAndPermissionChecks") &&
    permissionServer.includes("composeEntitlementAndPermissionDecision") &&
    permissionServer.includes("requireOrgEntitlement") &&
    permissionServer.includes("requireOrgPermission") &&
    compositionSrc.includes("await Promise.all([") &&
    compositionSrc.includes("input.checkEntitlement()") &&
    compositionSrc.includes("input.checkPermission()")
);
check(
  "permission-server no longer awaits entitlement before membership",
  !/const entitled = await requireOrgEntitlement[\s\S]{0,400}await requireOrgPermission/.test(
    permissionServer
  ) &&
    !/if \(!entitled\.ok\) \{[\s\S]{0,250}const permitted = await requireOrgPermission/.test(
      permissionServer
    )
);
check(
  "scalar Details mutation still composes entitlement + projects.edit",
  factActions.includes("permissionDeniedError({") &&
    factActions.includes('permission: "projects.edit"') &&
    factActions.includes('entitlement: "projects.create"')
);
check(
  "G. 01C-2 merged pre-write project read is intact",
  ownershipSrc.includes("assertOrgOwnsActiveProjectWithStage") &&
    ownershipSrc.includes('.select("id, stage, quality_level")') &&
    ownershipSrc.includes('.is("deleted_at", null)') &&
    factActions.includes("assertOrgOwnsActiveProjectWithStage(context, projectId)") &&
    persistSrc.includes("existingTarget: existingFact")
);
check(
  "H. post-write ownership stays uncached assertOrgOwnsActiveProject",
  staleSrc.includes("assertOrgOwnsActiveProject(context, projectId)") &&
    !staleSrc.includes("WithStage") &&
    !staleSrc.includes("ForRead") &&
    mutationResult.includes("assertOrgOwnsActiveProject(auth, projectId)") &&
    !mutationResult.includes("ForRead") &&
    !mutationResult.includes("WithStage")
);
check(
  "no request-global cache added for authz",
  !compositionSrc.includes("React.cache") &&
    !compositionSrc.includes("unstable_cache") &&
    !permissionServer.includes("unstable_cache") &&
    !permissionServer.includes("use cache")
);

console.log("\n-- FAILURE SEMANTICS --");
const entitledMember = composeEntitlementAndPermissionDecision({
  entitled: entitledOk(),
  permitted: okPermission(),
});
check(
  "A. valid entitled member proceeds",
  entitledMember.ok === true &&
    entitledMember.ok &&
    entitledMember.role === "estimator" &&
    entitledMember.orgId === "org-a" &&
    entitledMember.userId === "user-1"
);

const nonMember = composeEntitlementAndPermissionDecision({
  entitled: entitledOk(),
  permitted: forbiddenPermission(),
});
check(
  "B. invalid / non-member fails with the same permission message",
  !nonMember.ok &&
    nonMember.error === PERMISSION_DENIED_MESSAGE &&
    nonMember.reasonCode === "forbidden" &&
    !("entitlementDenied" in nonMember)
);

const viewerBlocked =
  roleAllowsPermission("estimator", "projects.edit") &&
  !roleAllowsPermission("viewer", "projects.edit");
check("B. insufficient role (viewer) still cannot projects.edit", viewerBlocked);

const noEntitlement = composeEntitlementAndPermissionDecision({
  entitled: entitlementDenied(),
  permitted: okPermission(),
});
check(
  "C. no entitlement fails with billing message + entitlementDenied",
  !noEntitlement.ok &&
    noEntitlement.error === "This is not included on the current plan." &&
    noEntitlement.reasonCode === "upgrade_required" &&
    noEntitlement.entitlementDenied === true
);

const expired = composeEntitlementAndPermissionDecision({
  entitled: entitlementDenied(DENIED_TRIAL),
  permitted: okPermission(),
});
check(
  "C. expired entitlement message is unchanged",
  !expired.ok && expired.error === DENIED_TRIAL && expired.entitlementDenied === true
);

const mixed = composeEntitlementAndPermissionDecision({
  entitled: entitlementDenied(),
  permitted: forbiddenPermission(),
});
check(
  "mixed failure still returns entitlement denial, not membership",
  !mixed.ok &&
    mixed.entitlementDenied === true &&
    mixed.error === "This is not included on the current plan." &&
    mixed.error !== PERMISSION_DENIED_MESSAGE
);

const skippedEntitlement = composeEntitlementAndPermissionDecision({
  entitled: null,
  permitted: okPermission(),
});
check(
  "permission-only callers still proceed when entitlement is omitted",
  skippedEntitlement.ok === true
);

const skippedForbidden = composeEntitlementAndPermissionDecision({
  entitled: null,
  permitted: forbiddenPermission(),
});
check(
  "permission-only callers still fail closed on membership",
  !skippedForbidden.ok && skippedForbidden.error === PERMISSION_DENIED_MESSAGE
);

const crossOrgMembership = decideMembershipAuthority({
  membershipTableAvailable: true,
  membership: null,
  profile: { orgId: "org-b", role: "estimator" },
});
check(
  "F. foreign-org / unbound membership does not grant role permissions",
  crossOrgMembership.kind === "bound_without_membership" &&
    permissionServer.includes(
      "context.orgId !== input.orgId || context.user.id !== input.userId"
    )
);

async function main(): Promise<void> {
  console.log("\n-- CONCURRENCY --");

  let entitlementRan = false;
  let permissionRan = false;
  const both = await runIndependentEntitlementAndPermissionChecks({
    entitlement: "projects.create",
    checkEntitlement: async () => {
      entitlementRan = true;
      return entitlementDenied();
    },
    checkPermission: async () => {
      await delay(25);
      permissionRan = true;
      return forbiddenPermission();
    },
  });
  const bothDecision = composeEntitlementAndPermissionDecision(both);
  check("D. both checks execute when entitlement would have short-circuited", entitlementRan && permissionRan);
  check(
    "D. mixed live run still surfaces entitlement denial",
    !bothDecision.ok &&
      bothDecision.entitlementDenied === true &&
      bothDecision.error === "This is not included on the current plan."
  );

  const overlap: { label: string; at: number }[] = [];
  const started = performance.now();
  const concurrent = await runIndependentEntitlementAndPermissionChecks({
    entitlement: "projects.create",
    checkEntitlement: async () => {
      overlap.push({ label: "entitlement:start", at: performance.now() });
      await delay(60);
      overlap.push({ label: "entitlement:end", at: performance.now() });
      return entitledOk();
    },
    checkPermission: async () => {
      overlap.push({ label: "permission:start", at: performance.now() });
      await delay(60);
      overlap.push({ label: "permission:end", at: performance.now() });
      return okPermission();
    },
  });
  const elapsed = performance.now() - started;
  const entStart = overlap.find((row) => row.label === "entitlement:start")?.at ?? 0;
  const entEnd = overlap.find((row) => row.label === "entitlement:end")?.at ?? 0;
  const permStart = overlap.find((row) => row.label === "permission:start")?.at ?? 0;
  const permEnd = overlap.find((row) => row.label === "permission:end")?.at ?? 0;
  check(
    "E. checks overlap instead of awaiting each other",
    concurrent.permitted.ok === true &&
      elapsed < 110 &&
      entStart < permEnd &&
      permStart < entEnd,
    `elapsed=${Math.round(elapsed)}ms`
  );

  let skippedEntitlementRan = false;
  const permissionOnly = await runIndependentEntitlementAndPermissionChecks({
    entitlement: null,
    checkEntitlement: async () => {
      skippedEntitlementRan = true;
      return entitlementDenied();
    },
    checkPermission: async () => okPermission(),
  });
  check(
    "omitted entitlement does not run the billing check",
    skippedEntitlementRan === false && permissionOnly.entitled === null && permissionOnly.permitted.ok === true
  );

  check(
    "J. persistError still hides Ready",
    detailsReadyCardVisible({
      visibleGroupCount: 0,
      remaining: 0,
      viewEnoughToEstimate: true,
      readinessEnoughToEstimate: true,
      persistError: "Could not save",
    }) === false
  );

  const realJob = loadCalibrationFixture("REAL-JOB-01.json");
  const wa: EstimateWorkArea = {
    id: "wa-deck-1",
    type: "deck",
    name: "Deck",
    sort_order: 1,
  };
  const realFacts: EstimateFact[] = Object.entries(realJob.facts).map(
    ([key, value]) => ({
      key,
      work_area_id: wa.id,
      value,
    })
  );
  const realEstimate = calculateEstimate({
    project: { id: "real-job-01", qualityLevel: "standard" },
    confirmedWorkAreas: [wa],
    facts: realFacts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext);
  check(
    "REAL-JOB-01 recommendedSell unchanged",
    realEstimate.recommendedSell === 12878.01,
    `got ${realEstimate.recommendedSell}`
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
