/**
 * BRANDING-P0 — Company logo upload + quote rendering (static contracts).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMPANY_LOGO_MAX_BYTES,
  ORGANISATION_BRANDING_BUCKET,
  companyLogoObjectPath,
  detectCompanyLogoMimeFromBytes,
  resolveCompanyLogoSrc,
  validateCompanyLogoFileMeta,
  validateLegacyLogoUrl,
} from "../lib/settings/logo";

const root = process.cwd();
let passed = 0;
let failed = 0;

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function check(name: string, ok: boolean) {
  if (ok) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.error(`FAIL  ${name}`);
    failed += 1;
  }
}

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const webp = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

check("1 PNG magic accepted", detectCompanyLogoMimeFromBytes(png) === "image/png");
check("2 JPEG magic accepted", detectCompanyLogoMimeFromBytes(jpeg) === "image/jpeg");
check("3 WebP magic accepted", detectCompanyLogoMimeFromBytes(webp) === "image/webp");
check(
  "4 invalid type rejected",
  !validateCompanyLogoFileMeta({ size: 100, mime: "image/svg+xml" }).ok &&
    !validateCompanyLogoFileMeta({ size: 100, mime: "application/pdf" }).ok
);
check(
  "5 >2 MB rejected",
  !validateCompanyLogoFileMeta({
    size: COMPANY_LOGO_MAX_BYTES + 1,
    mime: "image/png",
  }).ok
);

const logoActions = read("lib/settings/logo-actions.ts");
check(
  "6 organisation ownership via getAuthOrgContext",
  logoActions.includes("getAuthOrgContext") &&
    logoActions.includes("context.orgId") &&
    !logoActions.includes("SUPABASE_SERVICE_ROLE")
);
check(
  "7a upload precedes obsolete cleanup",
  logoActions.includes("createCompanyLogoUploadPath") &&
    logoActions.includes("previousPaths") &&
    /await context\.supabase\.storage[\s\S]*\.upload\([\s\S]*obsolete/.test(
      logoActions
    )
);
check(
  "7b persist failure keeps old logo and removes orphan",
  logoActions.includes("Persist failed") &&
    logoActions.includes("keep old logo_url") &&
    /saved\.error[\s\S]*removeStoragePaths\(context\.supabase, \[objectPath\]\)/.test(
      logoActions
    )
);
check(
  "7c success removes only obsolete prior objects",
  logoActions.includes("previousPaths.filter") &&
    logoActions.includes("path !== objectPath")
);
check(
  "8 remove clears logo_url null then storage objects",
  logoActions.includes("logo_url: null") &&
    logoActions.includes("removeCompanyLogo") &&
    logoActions.indexOf("logo_url: null") <
      logoActions.indexOf("listOrgBrandingPaths(context.supabase, context.orgId)")
);

const field = read("components/settings/CompanyLogoField.tsx");
check(
  "9–10 settings preview + upload UX",
  field.includes("Upload logo") &&
    field.includes("Company logo preview") &&
    field.includes("object-contain")
);

const quoteLogo = read("components/quotes/QuoteCompanyLogo.tsx");
const quoteTemplate = read("components/quotes/QuoteTemplate.tsx");
check(
  "11–12 quote preview/final use QuoteCompanyLogo",
  quoteTemplate.includes("QuoteCompanyLogo") &&
    quoteLogo.includes("onError") &&
    quoteLogo.includes("object-contain")
);
check(
  "13 aspect ratio preserved (object-contain)",
  field.includes("object-contain") && quoteLogo.includes("object-contain")
);
check(
  "14 missing logo fallback to company name",
  quoteLogo.includes("companyName") && quoteLogo.includes("failed")
);
check(
  "15 broken legacy URL / imgur page rejected or falters safely",
  !validateLegacyLogoUrl("https://imgur.com/gallery/abc").ok &&
    quoteLogo.includes("onError")
);
check(
  "16 legacy URL field retained under Advanced",
  read("components/settings/CompanySettingsContent.tsx").includes(
    "legacy logo link"
  ) ||
    read("components/settings/CompanySettingsContent.tsx").includes(
      "Legacy logo URL"
    )
);
check(
  "17 no raw URL shown to quote recipients",
  quoteTemplate.includes("QuoteCompanyLogo") &&
    !quoteTemplate.includes("src={companySettings.logoUrl}") &&
    !quoteTemplate.includes("src={companySettings?.logoUrl}")
);
check(
  "18 mobile Company Settings upload controls",
  field.includes("sm:flex-row") && field.includes('type="file"')
);
check(
  "19 no commercial calculation changes in branding batch",
  !logoActions.includes("deriveSellFromGrossMargin") &&
    !logoActions.includes("resolveRate")
);
check(
  "20 storage path org-scoped",
  companyLogoObjectPath("org-1", "image/png").startsWith("org-1/branding/") &&
    ORGANISATION_BRANDING_BUCKET === "organisation-branding"
);

check(
  "migration 034 branding storage exists",
  existsSync(join(root, "supabase/migrations/034_organisation_branding_storage.sql"))
);
check(
  "resolveCompanyLogoSrc empty → null",
  resolveCompanyLogoSrc("  ") === null &&
    resolveCompanyLogoSrc("https://cdn.example/logo.png") ===
      "https://cdn.example/logo.png"
);
check(
  "direct https image URL still allowed for legacy",
  validateLegacyLogoUrl("https://cdn.example/logo.png").ok
);
check(
  "BOUNDARY MaterialRequirement not started",
  !existsSync(join(root, "lib/estimate/material-requirement.ts"))
);
check(
  "SCOPE_DISCOVERY not force-enabled",
  !/^[^#\n]*SCOPE_DISCOVERY_ENABLED\s*=\s*true/m.test(read(".env.local.example"))
);

console.log(`\n=== BRANDING-P0 Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
