/**
 * Quotr email signature identity.
 * Run: npx --yes tsx scripts/verify-email-signature-01.ts
 *
 * Confirms the shared fragment only. Does not send mail.
 */
import { readFileSync } from "node:fs";
import { buildQuotrEmailSignature } from "../lib/email/signature";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(rel, "utf8");
}

const founder = buildQuotrEmailSignature("founder");
const team = buildQuotrEmailSignature("team");
const signatureSrc = read("lib/email/signature.ts");

const untouched = [
  "lib/email/application-email.ts",
  "lib/team/invite-email.ts",
  "lib/quotes/delivery-email.ts",
  "lib/quotes/notification-email.ts",
  "lib/quotes/delivery-provider.ts",
  "lib/variations/delivery-email.ts",
  "lib/variations/response-email.ts",
  "lib/auth/recovery-actions.ts",
  "app/api/webhooks/resend/route.ts",
];

console.log("=== EMAIL SIGNATURE 01 ===\n");

assert(
  "founder copy is the personal signature",
  founder.text.startsWith("Jean-Luc Ellis\nCo-Founder, Quotr\n") &&
    founder.text.includes("Quotr\nEstimating and quoting for trades.") &&
    founder.text.includes("https://get-quotr.com") &&
    founder.text.endsWith("Questions or feedback? Just reply to this email.") &&
    founder.html.includes("Jean-Luc Ellis") &&
    founder.html.includes("Co-Founder, Quotr")
);

assert(
  "team copy is the default automated signature",
  team.text.startsWith("The Quotr team\nEstimating and quoting for trades.") &&
    team.text.endsWith("Need a hand? Reply to this email.") &&
    !team.text.includes("Jean-Luc") &&
    !team.text.includes("Co-Founder") &&
    team.html.includes("The Quotr team") &&
    !team.html.includes("Jean-Luc Ellis")
);

assert(
  "website is a real text link, not a button",
  founder.html.includes('href="https://get-quotr.com"') &&
    founder.html.includes(">get-quotr.com</a>") &&
    team.html.includes('href="https://get-quotr.com"') &&
    !/<button\b/i.test(founder.html) &&
    !/<img\b/i.test(founder.html) &&
    !/<img\b/i.test(team.html)
);

assert(
  "accent is a 3px mark, not a banner or logo",
  founder.html.includes('width="3"') &&
    founder.html.includes("bgcolor=\"#ff6900\"") &&
    !/logo|headshot|facebook|linkedin|instagram|twitter/i.test(founder.html) &&
    !founder.html.includes("tel:") &&
    !team.html.includes("tel:")
);

assert(
  "markup is inline and table-based",
  founder.html.includes('role="presentation"') &&
    founder.html.includes("font-family:Arial,Helvetica,sans-serif") &&
    founder.html.includes("font-size:15px") &&
    founder.html.includes("font-size:12px") &&
    !founder.html.includes("class=") &&
    !founder.html.includes("tailwind") &&
    founder.html.includes('width="100%"')
);

assert(
  "signature module does not send or configure delivery",
  !signatureSrc.includes("api.resend.com") &&
    !signatureSrc.includes("process.env") &&
    !signatureSrc.includes("fetch(")
);

for (const file of untouched) {
  const source = read(file);
  assert(
    `${file} does not import the signature`,
    !source.includes("email/signature") &&
      !source.includes("buildQuotrEmailSignature")
  );
}

if (process.exitCode) {
  console.error("\nEMAIL-SIGNATURE-01 failed");
} else {
  console.log("\nEMAIL-SIGNATURE-01 passed");
}
