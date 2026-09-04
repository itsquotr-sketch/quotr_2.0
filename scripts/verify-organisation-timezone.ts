/**
 * Organisation timezone (migration 051) — focused verifier.
 *
 * Run: npx --yes tsx scripts/verify-organisation-timezone.ts
 *
 * No paid AI. No live Stripe. Does not print secret values.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_ORG_TIMEZONE,
  defaultTimezoneForCountry,
  formatInOrgTimezone,
  isCatalogueTimezone,
  isIanaTimezone,
  ORG_TIMEZONE_CATALOGUE,
  resolveDisplayTimezone,
  timezoneLabel,
} from "../lib/org/timezone";
import { formatQuoteDateTime } from "../lib/quotes/display";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function main() {
  console.log("=== Organisation timezone 051 verification ===");

  const migrations = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const sql = read("supabase/migrations/051_organisation_timezone.sql");
  const timezoneSrc = read("lib/org/timezone.ts");
  const basics = read("components/setup/CompanyBasicsStep.tsx");
  const setupActions = read("lib/setup/actions.ts");
  const companyActions = read("lib/settings/company-actions.ts");
  const companyUi = read("components/settings/CompanySettingsContent.tsx");
  const acceptance = read("components/quotes/QuoteAcceptanceRecord.tsx");
  const details = read("components/quotes/QuoteAcceptanceDetails.tsx");
  const history = read("components/quotes/QuoteTransactionHistory.tsx");
  const delivery = read("components/quotes/QuoteDeliveryHistory.tsx");
  const publicShell = read("components/quotes/QuotePublicShell.tsx");

  section("SCHEMA");
  assert(
    "051_organisation_timezone.sql exists",
    existsSync(join(process.cwd(), "supabase/migrations/051_organisation_timezone.sql"))
  );
  assert(
    "051 timezone migration remains in chain",
    migrations.includes("051_organisation_timezone.sql")
  );
  assert(
    "052 is Company DNA, not a timezone rewrite",
    migrations.includes("052_company_productivity_calibration.sql")
  );
  assert(
    "053 is role-aware RLS, not a timezone rewrite",
    migrations.at(-1) === "053_role_aware_rls_hardening.sql"
  );
  assert(
    "adds organisation_settings.timezone text NULL",
    /add column if not exists timezone text/.test(sql) &&
      !/timezone text not null/i.test(sql)
  );
  assert(
    "no database DEFAULT Pacific/Auckland",
    !/default\s+'Pacific\/Auckland'/i.test(sql) &&
      !/timezone text\s+default/i.test(sql)
  );
  assert(
    "environment-neutral (no Preview/Production refs or fixture ids)",
    !/shhpjsoldmqtkdbgrbtm/.test(sql) &&
      !/lxvnylhsbvudzzupxeqr/.test(sql) &&
      !/PREVIEW ONLY/.test(sql) &&
      !/select 'test'::text/.test(sql) &&
      !/\bcus_|\bsub_|\bprice_/.test(sql) &&
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(sql)
  );
  assert(
    "structural CHECK does not pretend to be full IANA",
    /organisation_settings_timezone_form/.test(sql) &&
      /structural form only/.test(sql) &&
      /full IANA/.test(sql)
  );

  section("BACKFILL");
  assert(
    "NZ non-Chatham backfills Pacific/Auckland",
    /Pacific\/Auckland/.test(sql) &&
      /upper\(trim\(country\)\) in \('NZ', 'NEW ZEALAND'\)/.test(sql)
  );
  assert(
    "Chatham region maps to Pacific/Chatham",
    /like '%chatham%'/.test(sql) && /Pacific\/Chatham/.test(sql)
  );
  assert(
    "backfill only where timezone is null",
    /where timezone is null/.test(sql)
  );
  assert(
    "non-NZ is not assigned Auckland",
    !/australia/i.test(sql) &&
      !/set timezone = 'Pacific\/Auckland'\s*;/.test(sql)
  );

  section("IANA VALIDATION");
  assert("catalogue includes Auckland", isCatalogueTimezone("Pacific/Auckland"));
  assert("catalogue includes Chatham", isCatalogueTimezone("Pacific/Chatham"));
  assert(
    "catalogue includes real Australian zones",
    isCatalogueTimezone("Australia/Sydney") &&
      isCatalogueTimezone("Australia/Brisbane") &&
      isCatalogueTimezone("Australia/Perth") &&
      !ORG_TIMEZONE_CATALOGUE.some((option) => option.id === "Australia")
  );
  assert("UTC+12 rejected", !isIanaTimezone("UTC+12") && !isCatalogueTimezone("UTC+12"));
  assert("GMT+12 rejected", !isIanaTimezone("GMT+12") && !isCatalogueTimezone("GMT+12"));
  assert("+12:00 rejected", !isIanaTimezone("+12:00") && !isCatalogueTimezone("+12:00"));
  assert(
    "human labels stored under IANA ids",
    timezoneLabel("Pacific/Auckland") === "Auckland / Wellington — New Zealand" &&
      timezoneLabel("Pacific/Chatham") === "Chatham Islands — New Zealand" &&
      timezoneLabel("Australia/Sydney") === "Sydney / Melbourne"
  );
  assert(
    "persistence uses catalogue not raw Intl",
    /isCatalogueTimezone/.test(setupActions) &&
      /isCatalogueTimezone/.test(companyActions)
  );

  section("NEW USER / COMPANY UX");
  assert(
    "NZ proposes Auckland",
    defaultTimezoneForCountry({ country: "NZ" }) === "Pacific/Auckland"
  );
  assert(
    "Chatham region proposes Chatham",
    defaultTimezoneForCountry({ country: "NZ", region: "Chatham Islands" }) ===
      "Pacific/Chatham"
  );
  assert(
    "AU proposes Sydney not a generic Australia zone",
    defaultTimezoneForCountry({ country: "AU" }) === "Australia/Sydney"
  );
  assert("Company Basics collects timezone", /basics-timezone/.test(basics));
  assert(
    "first-run save requires catalogue timezone",
    /shouldMarkWorkNext && !isCatalogueTimezone/.test(setupActions)
  );
  assert(
    "Company Settings can edit timezone",
    /company-timezone/.test(companyUi) && /timezone/.test(companyActions)
  );

  section("AUTHORITY + DISPLAY");
  assert(
    "canonical resolver lives in lib/org/timezone.ts",
    /organisation_settings\.timezone/.test(timezoneSrc) &&
      /resolveDisplayTimezone/.test(timezoneSrc)
  );
  assert(
    "NULL stored timezone falls back to Auckland",
    resolveDisplayTimezone(null) === DEFAULT_ORG_TIMEZONE &&
      resolveDisplayTimezone("") === DEFAULT_ORG_TIMEZONE
  );
  const acceptedUtc = "2026-03-20T01:30:00.000Z";
  const auckland = formatInOrgTimezone(acceptedUtc, "Pacific/Auckland");
  const perth = formatInOrgTimezone(acceptedUtc, "Australia/Perth");
  assert("formatter returns a value for Auckland", Boolean(auckland));
  assert(
    "same UTC instant renders differently in Perth vs Auckland",
    Boolean(perth) && auckland !== perth
  );
  assert(
    "formatQuoteDateTime uses the org timezone argument",
    formatQuoteDateTime(acceptedUtc, "Pacific/Auckland") === auckland
  );
  assert(
    "acceptance record formats with timeZone prop",
    /formatQuoteDateTime\(acceptance\.accepted_at, timeZone\)/.test(acceptance) &&
      /formatQuoteDateTime\(acceptance\.accepted_at, timeZone\)/.test(details)
  );
  assert(
    "transaction and delivery history use org timezone",
    /timeZone/.test(history) && /timeZone/.test(delivery)
  );
  assert(
    "public quote formats times without exposing timezone settings UI",
    /resolveDisplayTimezone/.test(publicShell) &&
      !/company-timezone/.test(publicShell) &&
      !/ORG_TIMEZONE_CATALOGUE/.test(publicShell)
  );
  assert(
    "UTC evidence columns are not rewritten by 051",
    !/accepted_at/.test(sql) &&
      !/sent_at/.test(sql) &&
      !/viewed_at/.test(sql) &&
      !/signature/.test(sql)
  );

  if (process.exitCode) {
    console.error("\nOrganisation timezone verification failed.");
  } else {
    console.log("\nOrganisation timezone verification passed.");
  }
}

main();
