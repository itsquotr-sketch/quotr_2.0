/**
 * Signup Terms and marketing choices.
 * Run: npx --yes tsx scripts/verify-signup-choices.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARKETING_CHOICE_REQUIRED,
  signupChoiceErrors,
  TERMS_ACCEPTANCE_REQUIRED,
  TERMS_OF_USE_VERSION,
} from "../lib/auth/signup-choices";

const root = join(import.meta.dirname, "..");
function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

let failed = 0;
function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`ok ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
}

const form = read("components/auth/SignupForm.tsx");
const choices = read("lib/auth/signup-choices.ts");
const preferences = read("lib/auth/signup-preferences.ts");
const migration = read("supabase/migrations/112_signup_terms_acceptance.sql");
const termsPage = read("app/(legal)/terms/page.tsx");
const privacyPage = read("app/(legal)/privacy/page.tsx");
const missing = signupChoiceErrors({ termsAccepted: false, marketingConsent: null });
const yes = signupChoiceErrors({ termsAccepted: true, marketingConsent: "yes" });
const no = signupChoiceErrors({ termsAccepted: true, marketingConsent: "no" });

assert(
  "missing Terms and marketing choices are separate inline errors",
  missing.terms_accepted?.[0] === TERMS_ACCEPTANCE_REQUIRED &&
    missing.marketing_consent?.[0] === MARKETING_CHOICE_REQUIRED
);
assert("either marketing choice continues once Terms are accepted", Object.keys(yes).length === 0 && Object.keys(no).length === 0);
assert("Terms alone do not imply a marketing choice", Object.keys(signupChoiceErrors({ termsAccepted: true, marketingConsent: null })).length === 1);
assert(
  "signup form has one unchecked Terms control and an unselected marketing choice",
    form.includes("I agree to the") &&
    form.includes("Application Terms") &&
    form.includes("TERMS_OF_USE_URL") &&
    choices.includes('"/terms"') &&
    form.includes("Privacy Notice") &&
    form.includes("PRIVACY_POLICY_URL") &&
    choices.includes('"/privacy"') &&
    form.includes("Would you like occasional product updates and practical Quotr tips?") &&
    form.includes("Yes, send me updates") &&
    form.includes("No thanks") &&
    form.includes("You can unsubscribe anytime.") &&
    form.includes("Account, security, and service emails are separate.") &&
    form.includes("useState(false)") &&
    form.includes("useState<boolean | null>(null)")
);
assert(
  "acceptance is recorded server-side without backfilling existing accounts",
  migration.includes("where id = v_uid") &&
    migration.includes("Existing profiles stay null") &&
    migration.includes("2026-10-15") &&
    TERMS_OF_USE_VERSION === "2026-10-22" &&
    !migration.includes(TERMS_OF_USE_VERSION) &&
    migration.includes("terms_accepted_at is not null") 
);
assert(
  "marketing consent reuses the signup source and does not start a campaign",
  preferences.includes('p_source: "signup"') &&
    preferences.includes("set_own_marketing_consent") &&
    !preferences.includes("loops.so") &&
    !preferences.includes("activateCampaign")
);

assert(
  "application documents use the stored version and stay separate from the website terms",
  termsPage.includes("TERMS_OF_USE_VERSION") &&
    termsPage.includes("Application Terms") &&
    termsPage.includes("get-quotr.com") &&
    privacyPage.includes("TERMS_OF_USE_VERSION") &&
    privacyPage.includes("Privacy Notice") &&
    termsPage.includes("Proposed, not yet approved") &&
    privacyPage.includes("ap-northeast-1") &&
    !termsPage.includes("privacy@quotr.co.nz") &&
    !privacyPage.includes("privacy@quotr.co.nz") &&
    !termsPage.includes("Quotr Limited") &&
    !privacyPage.includes("Quotr Limited")
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("signup choices ok");
