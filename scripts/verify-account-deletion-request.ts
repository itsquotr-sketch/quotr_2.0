/**
 * Account-deletion requests record an ask and do not delete anything.
 * Run: npx tsx scripts/verify-account-deletion-request.ts
 */
import { readFileSync } from "node:fs";
import {
  deletionRequestResolution,
  deletionStatusCopy,
  normalizeDeletionEmail,
  publicDeletionAcknowledgement,
} from "../lib/account-deletion/request";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok ${label}`);
}

assert(
  "another member does not refuse the request",
  deletionRequestResolution({ otherActiveMemberCount: 2 }) === "needs_support"
);
assert(
  "a sole active member is recorded for review",
  deletionRequestResolution({ otherActiveMemberCount: 0 }) === "recorded"
);

const support = deletionStatusCopy({
  identityConfirmed: true,
  resolution: "needs_support",
  otherActiveMemberCount: 2,
  issuedQuoteCount: 1,
  subscriptionStatus: "active",
});
const recorded = deletionStatusCopy({
  identityConfirmed: true,
  resolution: "recorded",
  otherActiveMemberCount: 0,
  issuedQuoteCount: 0,
  subscriptionStatus: null,
});
const unconfirmed = deletionStatusCopy({
  identityConfirmed: false,
  resolution: "recorded",
  otherActiveMemberCount: 0,
  issuedQuoteCount: 0,
  subscriptionStatus: null,
});
const publicCopy = publicDeletionAcknowledgement();
const combined = `${support.body}\n${recorded.body}\n${unconfirmed.body}\n${publicCopy}`;

assert("support path stays available", support.body.includes("hello@get-quotr.com"));
assert("status says the account has not been deleted", recorded.body.includes("has not deleted"));
assert("unconfirmed identity stays visible", unconfirmed.title.includes("not confirmed"));
assert(
  "copy does not promise a deletion period or a completed deletion",
  !/within \d+ days|will be deleted|has been deleted|retention period of/i.test(combined)
);
assert("email is normalised", normalizeDeletionEmail("  Person@Example.com ") === "person@example.com");
assert("a blank email is rejected", normalizeDeletionEmail("   ") === null);

const migration = readFileSync("supabase/migrations/121_account_deletion_requests.sql", "utf8");
const actions = readFileSync("lib/account-deletion/actions.ts", "utf8");
const profile = readFileSync("components/profile/ProfilePageContent.tsx", "utf8");
const runbook = readFileSync("docs/runbooks/ACCOUNT_DELETION_REQUESTS.md", "utf8");
assert(
  "one open request is allowed per email",
  migration.includes("account_deletion_requests_one_open_email_uidx")
);
assert(
  "the request table does not grant deletion of accounts",
  migration.includes("does not delete auth users") &&
    !migration.includes("delete from auth.users") &&
    !migration.includes("auth.admin")
);
const signedInAction = actions.slice(actions.indexOf("export async function submitSignedInDeletionRequest"));
assert(
  "a confirmed request is not inserted twice",
  signedInAction.includes("existing?.identityConfirmed") &&
    signedInAction.indexOf("signInWithPassword") <
      signedInAction.indexOf(".from(\"account_deletion_requests\")")
);
assert(
  "Profile links to the signed-in request",
  profile.includes('href="/app/profile/deletion"') &&
    profile.includes("Request account deletion")
);
assert(
  "the public page is linked without a purchase path",
  readFileSync("components/legal/LegalDocumentLinks.tsx", "utf8").includes(
    'href="/account-deletion"'
  ) &&
    readFileSync("app/account-deletion/page.tsx", "utf8").includes("PublicDeletionForm")
);
assert(
  "the operator procedure covers members, subscriptions, and issued quotes",
  runbook.includes("needs_support") &&
    runbook.includes("org_subscriptions") &&
    runbook.includes("issued") &&
    runbook.includes("No separate product retention period")
);

if (process.exitCode) {
  console.error("account deletion request checks failed");
} else {
  console.log("account deletion request checks passed");
}
