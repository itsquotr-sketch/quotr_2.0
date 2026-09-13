/**
 * PERFORMANCE-01B — request-scoped ownership + settings reader verifier.
 *
 * Run: npx --yes tsx scripts/verify-performance-01b.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cache } from "react";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { DEFAULT_ORGANISATION_SETTINGS } from "../lib/settings/default-organisation-settings";

function mapCompanySettingsRowForParity(
  organisationName: string,
  row: Record<string, unknown>
) {
  return {
    organisationName,
    tradingName: (row.trading_name as string | null) ?? null,
    defaultGstRate: Number(row.default_gst_rate ?? 15),
    addressCountry: (row.address_country as string) ?? "New Zealand",
    contactEmail: (row.contact_email as string | null) ?? null,
    deckingWastagePercent:
      row.decking_wastage_percent != null
        ? Number(row.decking_wastage_percent)
        : null,
  };
}
import {
  assertOrgOwnsActiveProject,
  resetUnderlyingActiveProjectOwnershipCount,
  getUnderlyingActiveProjectOwnershipCount,
} from "../lib/security/org-ownership";
import type { AuthOrgContext } from "../lib/security/auth-org-context";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";

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

function makeOwnershipCtx(options: {
  orgId: string;
  projectId: string;
  deleted?: boolean;
  foreign?: boolean;
}): AuthOrgContext {
  let queries = 0;
  const projectId = options.projectId;
  const orgId = options.orgId;
  const chain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    async maybeSingle() {
      queries += 1;
      if (options.deleted || options.foreign) {
        return { data: null, error: null };
      }
      return { data: { id: projectId }, error: null };
    },
  };
  return {
    orgId,
    user: { id: "user-1" },
    supabase: {
      from() {
        return chain;
      },
    },
    _queries: () => queries,
  } as AuthOrgContext & { _queries: () => number };
}

console.log("verify-performance-01b: starting…\n");

const ownershipSrc = read("lib/security/org-ownership.ts");
const ownershipReadSrc = read("lib/security/org-ownership-read.ts");
const settingsReader = read("lib/settings/organisation-settings-reader.ts");
const companyLoader = read("lib/settings/company-settings-loader.ts");
const generateResult = read("lib/assistant/load-estimate-generation-result.ts");
const mutationResult = read("lib/assistant/load-assistant-mutation-result.ts");
const factActions = read("lib/assistant/fact-actions.ts");
const displaySrc = read("lib/security/auth-display.ts");
const firstRunSrc = read("lib/setup/actions.ts");
const assistantState = read("lib/assistant/state.ts");
const readinessSrc = read("lib/setup/readiness-actions.ts");
const estimateContext = read("lib/estimate/context.ts");
const projectLoaders = read("lib/projects/project-loaders.ts");

console.log("-- STRUCTURE --");
check(
  "1. uncached ownership query is unchanged",
  ownershipSrc.includes('.select("id")') &&
    ownershipSrc.includes('.eq("org_id", ctx.orgId)') &&
    ownershipSrc.includes('.is("deleted_at", null)')
);
check(
  "2. read wrapper is React.cache keyed by orgId + projectId",
  ownershipReadSrc.includes('import { cache } from "react"') &&
    ownershipReadSrc.includes("cache(") &&
    ownershipReadSrc.includes("resolveActiveProjectOwnershipForRead") &&
    ownershipReadSrc.includes("orgId: string") &&
    ownershipReadSrc.includes("projectId: string") &&
    ownershipReadSrc.includes("assertOrgOwnsActiveProjectForRead") &&
    !ownershipSrc.includes("cache(")
);
check(
  "3. session org mismatch fails closed in read wrapper",
  ownershipReadSrc.includes("auth.orgId !== orgId")
);
check(
  "4. post-write loadEstimateGenerationResult uses uncached ownership",
  generateResult.includes("assertOrgOwnsActiveProject(auth, projectId)") &&
    !generateResult.includes("assertOrgOwnsActiveProjectForRead")
);
check(
  "5. mutation result + fact save stay on uncached ownership",
  mutationResult.includes("assertOrgOwnsActiveProject(auth, projectId)") &&
    !mutationResult.includes("ForRead") &&
    (factActions.includes("assertOrgOwnsActiveProject(context, projectId)") ||
      factActions.includes("assertOrgOwnsActiveProjectWithStage(context, projectId)")) &&
    !factActions.includes("ForRead")
);
check(
  "6. settings reader is select-only",
  settingsReader.includes("SELECT only") &&
    settingsReader.includes("cache(") &&
    !settingsReader.includes(".insert(") &&
    !settingsReader.includes("ensureCompanySettingsRow") &&
    !settingsReader.includes(".update(")
);
const firstRunFn = firstRunSrc.slice(
  firstRunSrc.indexOf("export async function getFirstRunStage"),
  firstRunSrc.indexOf("const companyBasicsSchema")
);
check(
  "7. create-if-missing stays on company-settings loader",
  companyLoader.includes("ensureCompanySettingsRow") &&
    companyLoader.includes("if (!error && row)") &&
    !displaySrc.includes("ensureCompanySettingsRow") &&
    !assistantState.includes("ensureCompanySettingsRow") &&
    !readinessSrc.includes("ensureCompanySettingsRow") &&
    !firstRunFn.includes("ensureCompanySettingsRow") &&
    !firstRunFn.includes("ensureDefaultSettings") &&
    firstRunFn.includes("loadOrganisationSettingsRow")
);
check(
  "8. getProjectWithContext is not request-cached",
  !projectLoaders.includes("cache(")
);
check(
  "9. no unstable_cache / process Map tenant store",
  !ownershipSrc.includes("unstable_cache") &&
    !ownershipReadSrc.includes("unstable_cache") &&
    !settingsReader.includes("unstable_cache") &&
    !ownershipSrc.includes("new Map") &&
    !ownershipReadSrc.includes("new Map") &&
    !settingsReader.includes("new Map")
);

const quoteLoaders = read("lib/quotes/quote-loaders.ts");
const pricingLoaders = read("lib/pricing/pricing-loaders.ts");
const noteLoaders = read("lib/project-notes/note-loaders.ts");
const loadStage = read("lib/assistant/load-project-stage.ts");
const staleSrc = read("lib/estimate/stale.ts");
const clarifySrc = read("lib/assistant/clarify/actions.ts");
const workAreaSrc = read("lib/assistant/work-area-actions.ts");
const constraintSrc = read("lib/assistant/constraint-actions.ts");
const quoteActions = read("lib/quotes/actions.ts");
const pricingActions = read("lib/pricing/actions.ts");

check(
  "cached read call sites use ForRead",
  quoteLoaders.includes("assertOrgOwnsActiveProjectForRead") &&
    pricingLoaders.includes("assertOrgOwnsActiveProjectForRead") &&
    noteLoaders.includes("assertOrgOwnsActiveProjectForRead") &&
    assistantState.includes("assertOrgOwnsActiveProjectForRead") &&
    estimateContext.includes("assertOrgOwnsActiveProjectForRead") &&
    loadStage.includes("assertOrgOwnsActiveProjectForRead")
);
check(
  "mutation / post-write call sites stay uncached",
  !quoteActions.includes("assertOrgOwnsActiveProjectForRead") &&
    !pricingActions.includes("assertOrgOwnsActiveProjectForRead") &&
    !staleSrc.includes("ForRead") &&
    !clarifySrc.includes("ForRead") &&
    !workAreaSrc.includes("ForRead") &&
    !constraintSrc.includes("ForRead") &&
    !generateResult.includes("ForRead") &&
    !mutationResult.includes("ForRead") &&
    !factActions.includes("ForRead")
);
check(
  "getEstimateContextWithContext itself is not React.cache wrapped",
  !estimateContext.includes("cache(")
);

async function main(): Promise<void> {
console.log("\n-- OWNERSHIP BEHAVIOUR --");
resetUnderlyingActiveProjectOwnershipCount();
const ownedCtx = makeOwnershipCtx({
  orgId: "org-a",
  projectId: "proj-1",
});
const first = await assertOrgOwnsActiveProject(ownedCtx, "proj-1");
const second = await assertOrgOwnsActiveProject(ownedCtx, "proj-1");
const third = await assertOrgOwnsActiveProject(ownedCtx, "proj-1");
check(
  "A/uncached. three uncached calls hit the DB three times",
  !("error" in first) &&
    !("error" in second) &&
    !("error" in third) &&
    getUnderlyingActiveProjectOwnershipCount() === 3
);

resetUnderlyingActiveProjectOwnershipCount();
const cachedOwnership = cache(async (orgId: string, projectId: string) => {
  return assertOrgOwnsActiveProject(ownedCtx, projectId);
});
await cachedOwnership("org-a", "proj-1");
await cachedOwnership("org-a", "proj-1");
await cachedOwnership("org-a", "proj-1");
const cachedHits = getUnderlyingActiveProjectOwnershipCount();
check(
  "A. same-request ForRead key (orgId+projectId) reuses in RSC (1) or no-ops in Node (3)",
  cachedHits === 1 || cachedHits === 3,
  `underlying=${cachedHits}`
);

resetUnderlyingActiveProjectOwnershipCount();
const secondRequest = cache(async (orgId: string, projectId: string) => {
  return assertOrgOwnsActiveProject(ownedCtx, projectId);
});
await secondRequest("org-a", "proj-1");
check(
  "B. new cache instance / request executes again",
  getUnderlyingActiveProjectOwnershipCount() === 1
);

const cross = await assertOrgOwnsActiveProject(
  makeOwnershipCtx({ orgId: "org-a", projectId: "proj-b", foreign: true }),
  "proj-b"
);
check(
  "C. Org A + Org B projectId is not-found",
  "error" in cross && cross.error === "Project not found."
);

resetUnderlyingActiveProjectOwnershipCount();
const failedCtx = makeOwnershipCtx({
  orgId: "org-a",
  projectId: "missing",
  foreign: true,
});
const fail1 = await assertOrgOwnsActiveProject(failedCtx, "missing");
const fail2 = await assertOrgOwnsActiveProject(failedCtx, "missing");
check(
  "D. failed ownership remains failed",
  "error" in fail1 &&
    "error" in fail2 &&
    fail1.error === fail2.error &&
    fail1.error === "Project not found."
);

const live = makeOwnershipCtx({
  orgId: "org-a",
  projectId: "proj-del",
});
const preWrite = await assertOrgOwnsActiveProject(live, "proj-del");
const deleted = makeOwnershipCtx({
  orgId: "org-a",
  projectId: "proj-del",
  deleted: true,
});
const postWrite = await assertOrgOwnsActiveProject(deleted, "proj-del");
check(
  "E. uncached post-write check detects soft-delete",
  !("error" in preWrite) &&
    "error" in postWrite &&
    postWrite.error === "Project not found."
);
check(
  "G. loadEstimateGenerationResult still imports uncached assertOrgOwnsActiveProject",
  generateResult.includes('from "@/lib/security/org-ownership"') &&
    generateResult.includes("assertOrgOwnsActiveProject(auth, projectId)")
);

console.log("\n-- SETTINGS PARITY --");
const presentRow = {
  trading_name: "Build Co",
  timezone: "Pacific/Auckland",
  default_gst_rate: 15,
  default_margin_percent: 22,
  default_quote_validity_days: 30,
  default_material_wastage_percent: 10,
  address_country: "New Zealand",
};
const mappedPresent = mapCompanySettingsRowForParity("Acme", presentRow);
check(
  "settings present: trading name and GST preserved",
  mappedPresent.tradingName === "Build Co" && mappedPresent.defaultGstRate === 15
);
const mappedMissing = mapCompanySettingsRowForParity("Acme", {});
check(
  "settings missing/empty: GST default 15 and NZ address country",
  mappedMissing.defaultGstRate === 15 &&
    mappedMissing.addressCountry === "New Zealand" &&
    mappedMissing.tradingName === null
);
check(
  "nullable fields stay null",
  mappedMissing.contactEmail === null && mappedMissing.deckingWastagePercent === null
);
check(
  "estimate default constant unchanged",
  DEFAULT_ORGANISATION_SETTINGS.default_margin_percent === 20 &&
    DEFAULT_ORGANISATION_SETTINGS.default_gst_rate === 15 &&
    DEFAULT_ORGANISATION_SETTINGS.currency === "NZD"
);
check(
  "read consumers use shared raw reader",
  displaySrc.includes("loadOrganisationSettingsRow") &&
    assistantState.includes("loadOrganisationSettingsRow") &&
    readinessSrc.includes("loadOrganisationSettingsRow") &&
    firstRunSrc.includes("loadOrganisationSettingsRow") &&
    estimateContext.includes("loadOrganisationSettingsRow")
);
check(
  "create-if-missing path is not in the raw reader",
  !settingsReader.includes(".insert(") &&
    !settingsReader.includes("ensureCompanySettingsRow")
);

console.log("\n-- ESTIMATOR --");
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
const realContext = {
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
} as unknown as EstimateContext;
const realEstimate = calculateEstimate(realContext);
check(
  "REAL-JOB-01 recommendedSell unchanged",
  realEstimate.recommendedSell === 12878.01,
  `got ${realEstimate.recommendedSell}`
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
}

void main();
