/**
 * UX-01J.4 — Company and Team presentation.
 *
 * Run: npx --yes tsx scripts/verify-ux-01j4-company-team.ts
 */
import { readFileSync } from "node:fs";
import {
  getSetupRecommendationHref,
  parseCompanySettingsSection,
} from "../lib/setup/recommendation-destinations";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}`);
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const company = read("components/settings/CompanySettingsContent.tsx");
const team = read("components/team/TeamPageContent.tsx");
const destinations = read("lib/setup/recommendation-destinations.ts");
const teamView = read("lib/team/team-page-view.ts");

console.log("=== UX-01J.4 Company and Team ===\n");

check(
  "company sections and legacy aliases",
  parseCompanySettingsSection("overview") === "overview" &&
    parseCompanySettingsSection("business") === "business" &&
    parseCompanySettingsSection("address") === "address" &&
    parseCompanySettingsSection("tax") === "tax" &&
    parseCompanySettingsSection("work") === "work" &&
    parseCompanySettingsSection("branding") === "branding" &&
    parseCompanySettingsSection("documents") === "documents" &&
    parseCompanySettingsSection("general") === "business" &&
    parseCompanySettingsSection("pricing") === "tax" &&
    parseCompanySettingsSection("quotes") === "documents" &&
    parseCompanySettingsSection("work_areas") === "work" &&
    parseCompanySettingsSection("work_types") === "work" &&
    parseCompanySettingsSection("advanced") === null
);
check(
  "work types href is the company work section",
  getSetupRecommendationHref("work_types") ===
    "/app/settings/company?section=work" &&
    destinations.includes('href: "/app/settings/company?section=work"')
);
check(
  "company phone menu and section save",
  company.includes('aria-label="Company section"') &&
    company.includes("data-company-section-select") &&
    company.includes("pushState") &&
    company.includes("data-company-save-footer") &&
    company.includes("Save company settings") &&
    company.includes("Only owners and admins can change company settings.")
);
check(
  "gst rate stays the calculation field and registration is not inferred",
  company.includes("defaultGstRate") &&
    company.includes("GST number") &&
    !company.includes("gstRegistered") &&
    !company.includes("Are you GST registered")
);
check(
  "work types stay on the existing step",
  company.includes("<WorkAreasStep") && company.includes('mode="improve"')
);
check(
  "issued documents are not described as rewritten",
  company.includes("Issued Quotes and") &&
    company.includes("Changes apply to new pricing and quotes.")
);
check(
  "team keeps seat disclosure and plan gates",
  team.includes("SEAT_ADD_DISCLOSURE") &&
    team.includes("SEAT_REMOVE_DISCLOSURE") &&
    team.includes("Send invitation") &&
    team.includes('view.kind === "business" || view.kind === "custom"') &&
    teamView.includes('ctaHref: "/app/settings/billing"') &&
    teamView.includes("canInvite: input.actorRole === \"owner\"")
);
check(
  "team removal uses a dialog and does not grant access in the client",
  team.includes("Remove") &&
    team.includes("DialogTitle") &&
    !team.includes("setRole(") &&
    team.includes("changeTeamMemberRole") &&
    team.includes("inviteTeamMember")
);

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
