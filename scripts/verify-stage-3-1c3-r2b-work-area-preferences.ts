/**
 * Stage 3.1C.3-R2B — Work Area preferences vs capability verification.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c3-r2b-work-area-preferences.ts
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  getAnalysisCapableWorkAreaTypes,
  getSupportedWorkAreaTypes,
  isSupportedWorkAreaType,
  SUPPORTED_WORK_AREA_TYPES,
} from "../lib/scopes/capability";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { computeCompanySetupReadiness } from "../lib/setup/readiness";
import { validateAndFilterExtraction } from "../lib/ai/schema";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function migrationsHave033(): boolean {
  const dir = join(process.cwd(), "supabase/migrations");
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.startsWith("033"));
}

console.log("=== Stage 3.1C.3-R2B work area preferences verification ===\n");

section("CAPABILITY");
assert(
  "canonical supported catalogue exists",
  existsSync(join(process.cwd(), "lib/scopes/capability.ts"))
);
assert(
  "SUPPORTED_WORK_AREA_TYPES non-empty",
  SUPPORTED_WORK_AREA_TYPES.length >= 10
);
assert("deck supported", isSupportedWorkAreaType("deck"));
assert("bathroom supported", isSupportedWorkAreaType("bathroom"));
assert("fence supported", isSupportedWorkAreaType("fence"));
assert(
  "capability matches SCOPE_CATALOGUE",
  getSupportedWorkAreaTypes().length === SCOPE_CATALOGUE.length
);
assert(
  "analysis capable === full catalogue",
  getAnalysisCapableWorkAreaTypes().join(",") ===
    getSupportedWorkAreaTypes().join(",")
);

const assistant = read("lib/assistant/actions.ts");
const notes = read("lib/project-notes/proposals/actions.ts");
assert(
  "Analyse Job uses getAnalysisCapableWorkAreaTypes",
  /getAnalysisCapableWorkAreaTypes/.test(assistant)
);
assert(
  "note analysis uses getAnalysisCapableWorkAreaTypes",
  /getAnalysisCapableWorkAreaTypes/.test(notes)
);
assert(
  "no loadAllowedWorkAreaTypes helper",
  !/loadAllowedWorkAreaTypes/.test(assistant) &&
    !/loadAllowedWorkAreaTypes/.test(notes)
);
assert(
  "Analyse Job does not query organisation_work_areas for allow-list",
  !/organisation_work_areas/.test(
    assistant.slice(
      assistant.indexOf("saveBriefAndSeedWorkAreas"),
      assistant.indexOf("saveBriefAndSeedWorkAreas") + 3500
    )
  )
);

const discoverySchemas = read("lib/scope-discovery/decisions/schemas.ts");
assert(
  "Scope Discovery uses SCOPE_CATALOGUE support check",
  /SCOPE_CATALOGUE/.test(discoverySchemas) &&
    /isSupportedWorkAreaType/.test(discoverySchemas)
);
assert(
  "Scope Discovery does not import organisation_work_areas",
  !/organisation_work_areas/.test(discoverySchemas)
);

const addWa = read("components/assistant/AddWorkAreaDialog.tsx");
assert(
  "Add Work Area uses full SCOPE_CATALOGUE",
  /SCOPE_CATALOGUE\.filter/.test(addWa)
);
assert(
  "Add Work Area copy clarifies preferences do not limit",
  /preferences do not limit/.test(addWa)
);
assert(
  "manual add validates against catalogue only",
  /SCOPE_CATALOGUE/.test(read("lib/assistant/work-area-actions.ts")) &&
    !/organisation_work_areas/.test(read("lib/assistant/work-area-actions.ts"))
);

section("CROSS-PREFERENCE TESTS");
// Simulate: company prefers deck/fence only — analysis allow-list still full.
const preferDeckFence = new Set(["deck", "fence"]);
const analysisTypes = new Set(getAnalysisCapableWorkAreaTypes());
assert(
  "preferences Deck/Fence do not remove Bathroom from capability",
  analysisTypes.has("bathroom") &&
    !preferDeckFence.has("bathroom") &&
    analysisTypes.has("deck")
);
assert(
  "preferences Bathroom do not remove Deck from capability",
  analysisTypes.has("deck") && analysisTypes.has("bathroom")
);

const bathroomBriefExtraction = validateAndFilterExtraction(
  {
    workAreas: [
      {
        type: "bathroom",
        confidence: 0.9,
        rationale: "Full bathroom renovation",
      },
    ],
    facts: [],
  },
  getAnalysisCapableWorkAreaTypes(),
  getSupportedWorkAreaTypes()
);
assert(
  "Bathroom survives filter when preferences would have been Deck/Fence",
  bathroomBriefExtraction.workAreas.some((wa) => wa.type === "bathroom")
);

const deckBriefExtraction = validateAndFilterExtraction(
  {
    workAreas: [
      {
        type: "deck",
        confidence: 0.9,
        rationale: "New timber deck",
      },
    ],
    facts: [],
  },
  getAnalysisCapableWorkAreaTypes(),
  getSupportedWorkAreaTypes()
);
assert(
  "Deck survives filter when preferences would have been Bathroom",
  deckBriefExtraction.workAreas.some((wa) => wa.type === "deck")
);

section("SETUP");
const workAreasStep = read("components/setup/WorkAreasStep.tsx");
assert(
  "Setup heading What kind of work",
  /What kind of work do you usually price/.test(workAreasStep)
);
assert(
  "Setup copy can still estimate other work",
  /still[\s\S]{0,40}estimate other work/.test(workAreasStep)
);
assert("Save preferences CTA", /Save preferences/.test(workAreasStep));
assert("Skip for now CTA", /Skip for now/.test(workAreasStep));
assert(
  "no mandatory Save and continue",
  !/Save and continue/.test(workAreasStep)
);
assert(
  "defaults do not use defaultEnabled as preference",
  !/item\.defaultEnabled/.test(workAreasStep) &&
    /saved\.has\(item\.type\) \? Boolean\(saved\.get\(item\.type\)\) : false/.test(
      workAreasStep
    )
);
assert(
  "save stays in Setup via onSaved",
  /onSaved\?/.test(workAreasStep)
);

const saveAction = read("lib/setup/actions.ts");
const saveSlice = saveAction.slice(
  saveAction.indexOf("saveOrganisationWorkAreas"),
  saveAction.indexOf("saveOrganisationWorkAreas") + 2200
);
assert(
  "save uses explicit preference === true (not defaultEnabled)",
  /selectionMap\.get\(item\.type\) === true/.test(saveSlice)
);
assert(
  "save does not require at least one selection",
  !/Select at least one work area/.test(saveSlice)
);
assert(
  "save revalidates setup/dashboard not project AI",
  /revalidatePath\("\/app\/setup"\)/.test(saveSlice)
);

const shell = read("components/setup/SetupShell.tsx");
assert("optional Work types nav", /Work types/.test(shell));
assert("no ReviewStep in improve nav", !/ReviewStep/.test(shell));
assert("no numbered Step wizard required", !/Step 1/.test(shell));

const scopeCard = read("components/setup/ScopeSelectionCard.tsx");
assert(
  "no Estimate-ready badge noise on preference cards",
  !/Estimate-ready|getEstimateSupportLabel/.test(scopeCard)
);

section("DEFAULTS / READINESS");
const noPrefs = computeCompanySetupReadiness({
  accountReady: true,
  organisationName: "Acme",
  onboardingStatus: "in_progress",
  currency: "NZD",
  country: "NZ",
  region: null,
  defaultGstRate: 15,
  defaultMarginPercent: 20,
  hasLabourRate: false,
  hasWorkTypePreferences: false,
  tradingName: null,
  legalName: null,
  contactEmail: null,
  contactPhone: null,
  addressLine1: null,
  city: null,
});
assert(
  "without preferences recommends Choose common work types",
  noPrefs.recommendedSetup.some(
    (s) => s.id === "work_types" && s.title.startsWith("Choose")
  )
);

const withPrefs = computeCompanySetupReadiness({
  accountReady: true,
  organisationName: "Acme",
  onboardingStatus: "in_progress",
  currency: "NZD",
  country: "NZ",
  region: null,
  defaultGstRate: 15,
  defaultMarginPercent: 20,
  hasLabourRate: false,
  hasWorkTypePreferences: true,
  tradingName: null,
  legalName: null,
  contactEmail: null,
  contactPhone: null,
  addressLine1: null,
  city: null,
});
assert(
  "with preferences recommends Change work types",
  withPrefs.recommendedSetup.some(
    (s) => s.id === "work_types" && s.title.startsWith("Change")
  )
);

const improve = read("components/setup/ImproveSetupCard.tsx");
assert(
  "Improve card shows Choose not Change",
  /title\.startsWith\("Choose"\)/.test(improve)
);

section("RATES / CALIBRATION BOUNDARY");
const ratesStep = read("components/setup/RatesStep.tsx");
assert(
  "Rates uses preferences for display personalisation only",
  /Preferences personalise starter rate sections only/.test(ratesStep)
);
assert(
  "Rates does not invent defaultEnabled preferences",
  !/enabled: item\.defaultEnabled/.test(ratesStep)
);
assert(
  "no calibration scenario implementation",
  !existsSync(join(process.cwd(), "lib/calibration")) &&
    !existsSync(join(process.cwd(), "lib/company-dna"))
);

section("SECURITY");
assert(
  "saveOrganisationWorkAreas uses getSetupAuthContext / auth org",
  /getSetupAuthContext/.test(saveSlice)
);
assert(
  "preference helper documents org-scoped load",
  /org_id/.test(read("lib/setup/work-area-preferences.ts"))
);
assert(
  "domain ownership documents preference ≠ capability",
  /NOT capability/.test(read("lib/scopes/domain-ownership.ts"))
);

section("BOUNDARIES");
assert("no migration 033", !migrationsHave033());
assert(
  "generic scope starters retained",
  /scope\.deck\.m2/.test(read("lib/setup/starter-rates.ts"))
);
assert(
  "SCOPE_DISCOVERY not force-enabled",
  !/^[^#\n]*SCOPE_DISCOVERY_ENABLED\s*=\s*true/m.test(
    read(".env.local.example")
  )
);
assert(
  "architecture model doc exists",
  existsSync(
    join(
      process.cwd(),
      "docs/architecture/QUOTR_WORK_AREA_CAPABILITY_AND_PREFERENCE_MODEL.md"
    )
  )
);

if (failed > 0) {
  console.error(`\nStage 3.1C.3-R2B verification failed (${failed}).`);
  process.exit(1);
}

console.log("\nStage 3.1C.3-R2B work area preferences verification passed.");
