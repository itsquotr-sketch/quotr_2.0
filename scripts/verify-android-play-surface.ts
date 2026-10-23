/**
 * Play surface host boundary.
 * Run: npx tsx scripts/verify-android-play-surface.ts
 */
import { readFileSync } from "node:fs";
import { HELP_ARTICLES } from "../lib/help/content";
import { helpArticleForPlaySurface } from "../lib/help/play-surface-article";
import {
  isPlaySurfaceHost,
  isQuotrPlayDeploymentHost,
  PLAY_SURFACE_BILLING_NOTE,
  PLAY_SURFACE_HOST,
  PLAY_SURFACE_PREVIEW_HOST,
  WEBSITE_APP_ORIGIN,
} from "../lib/android/play-surface";
import {
  resolveConfiguredSiteOrigin,
  selectAuthCallbackOrigin,
} from "../lib/auth/site-url";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok ${label}`);
}

const previous = process.env.QUOTR_PLAY_SURFACE_HOSTS;
delete process.env.QUOTR_PLAY_SURFACE_HOSTS;

assert(
  "stable Android host is a Play host without extra configuration",
  isPlaySurfaceHost(PLAY_SURFACE_HOST) &&
    isPlaySurfaceHost(`${PLAY_SURFACE_HOST}:443`)
);
assert(
  "preview alias remains a Play host",
  isPlaySurfaceHost(PLAY_SURFACE_PREVIEW_HOST)
);
assert(
  "quotr-play deployment addresses are Play hosts",
  isQuotrPlayDeploymentHost("quotr-play.vercel.app") &&
    isPlaySurfaceHost("quotr-play.vercel.app") &&
    isPlaySurfaceHost("quotr-play-quotr1.vercel.app") &&
    isPlaySurfaceHost("quotr-play-ape0wuei8-quotr1.vercel.app")
);
assert(
  "the main project addresses are not Play hosts",
  !isPlaySurfaceHost("quotr-2-0.vercel.app") &&
    !isPlaySurfaceHost("quotr-2-0-gxgdqe9ez-quotr1.vercel.app") &&
    !isQuotrPlayDeploymentHost("quotr-2-0-git-android-play-twa-quotr1.vercel.app")
);

process.env.QUOTR_PLAY_SURFACE_HOSTS = "android.get-quotr.com";

assert(
  "preview alias is the Play host",
  isPlaySurfaceHost(PLAY_SURFACE_PREVIEW_HOST)
);
assert(
  "configured extra host is a Play host",
  isPlaySurfaceHost("android.get-quotr.com")
);
assert(
  "Production app host is never a Play host",
  !isPlaySurfaceHost("app.get-quotr.com") &&
    !isPlaySurfaceHost("app.get-quotr.com:443") &&
    !isPlaySurfaceHost("App.Get-Quotr.com")
);
assert(
  "website apex is never a Play host",
  !isPlaySurfaceHost("get-quotr.com") && !isPlaySurfaceHost("www.get-quotr.com")
);
assert("localhost is not a Play host", !isPlaySurfaceHost("localhost:3000"));
assert(
  "Production cannot be opted in through the environment",
  !isPlaySurfaceHost("app.get-quotr.com")
);

process.env.QUOTR_PLAY_SURFACE_HOSTS = "app.get-quotr.com, android.get-quotr.com";
assert(
  "listing Production in the environment does not make it a Play host",
  !isPlaySurfaceHost("app.get-quotr.com") && isPlaySurfaceHost("android.get-quotr.com")
);
if (previous === undefined) delete process.env.QUOTR_PLAY_SURFACE_HOSTS;
else process.env.QUOTR_PLAY_SURFACE_HOSTS = previous;

assert(
  "a Play-host site URL does not become the customer link origin",
  resolveConfiguredSiteOrigin({
    VERCEL_ENV: "production",
    NEXT_PUBLIC_SITE_URL: `https://${PLAY_SURFACE_HOST}`,
  }) === WEBSITE_APP_ORIGIN
);
assert(
  "the website site URL stays the customer link origin",
  resolveConfiguredSiteOrigin({
    VERCEL_ENV: "production",
    NEXT_PUBLIC_SITE_URL: WEBSITE_APP_ORIGIN,
  }) === WEBSITE_APP_ORIGIN
);
assert(
  "password reset on the Android host returns to that host",
  selectAuthCallbackOrigin({
    vercelEnv: "production",
    requestOrigin: `https://${PLAY_SURFACE_HOST}`,
    branchHost: null,
    deploymentHost: null,
    configuredSiteUrl: WEBSITE_APP_ORIGIN,
  }) === `https://${PLAY_SURFACE_HOST}`
);
assert(
  "password reset on the website stays on the website",
  selectAuthCallbackOrigin({
    vercelEnv: "production",
    requestOrigin: WEBSITE_APP_ORIGIN,
    branchHost: null,
    deploymentHost: null,
    configuredSiteUrl: WEBSITE_APP_ORIGIN,
  }) === WEBSITE_APP_ORIGIN
);

const article = HELP_ARTICLES.find((item) => item.slug === "account-and-billing");
if (!article) {
  assert("account help article exists", false);
} else {
  const website = JSON.stringify(article);
  const play = JSON.stringify(helpArticleForPlaySurface(article));
  assert("website help still names Stripe", website.includes("Stripe"));
  assert("website help still names Manage billing", website.includes("Manage billing"));
  assert("Play help does not name Stripe", !play.includes("Stripe") && !play.includes("stripe"));
  assert("Play help does not name Manage billing", !play.includes("Manage billing"));
  assert("Play help does not link to Checkout", !play.includes("/app/settings/billing"));
  assert("Play help keeps the existing deletion request email", play.includes("hello@get-quotr.com"));
  assert("Play help uses the billing note", play.includes(PLAY_SURFACE_BILLING_NOTE));
}

const billingActions = readFileSync("lib/billing/billing-actions.ts", "utf8");
assert(
  "checkout refuses a Play purchase before Stripe",
  billingActions.indexOf("playSurfacePurchaseBlock") <
    billingActions.indexOf("checkout.sessions.create") &&
    billingActions.includes("if (blocked) return blocked;")
);
const seatApply = readFileSync("lib/billing/seat-apply.ts", "utf8");
assert(
  "a paid seat increase refuses a Play purchase before Stripe",
  seatApply.indexOf('errorCode: "play_surface"') !== -1 &&
    seatApply.indexOf('errorCode: "play_surface"') <
      seatApply.indexOf("stripe.subscriptions.retrieve")
);
const invite = readFileSync("lib/team/actions.ts", "utf8");
assert(
  "team invite refuses a Play purchase before the invitation is saved",
  invite.indexOf("isPlaySurfacePurchaseRequest") <
    invite.indexOf("create_organisation_invitation_v1")
);

const gradle = readFileSync("android/app/build.gradle", "utf8");
const assetLinks = readFileSync("public/.well-known/assetlinks.json", "utf8");
assert(
  "the Android package is com.getquotr.app",
  gradle.includes('applicationId "com.getquotr.app"') &&
    gradle.includes('namespace "com.getquotr.app"') &&
    assetLinks.includes('"package_name": "com.getquotr.app"') &&
    !gradle.includes("com.flowra.quotr") &&
    !assetLinks.includes("com.flowra.quotr")
);
assert(
  "Digital Asset Links names the upload and Play signing certificates",
  assetLinks.includes(
    "DA:0C:A3:38:23:58:F5:D4:9B:EE:7B:62:10:6F:23:A2:3B:5C:BA:B6:25:78:4C:97:C5:E9:C0:00:4E:40:F0:04"
  ) &&
    assetLinks.includes(
      "65:6A:33:D6:DF:17:30:A1:FF:FF:A2:33:4C:9A:3D:31:3C:66:17:57:78:15:C8:16:99:F4:BB:D7:19:40:F5:D1"
    )
);
const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
assert("the Android app declares internet only", manifest.includes("android.permission.INTERNET"));
assert(
  "the Android app does not declare camera or storage permissions",
  !manifest.includes("CAMERA") &&
    !manifest.includes("READ_EXTERNAL_STORAGE") &&
    !manifest.includes("READ_MEDIA")
);
assert(
  "the Android app opens the Play preview host",
  manifest.includes("${twaDefaultUrl}") && manifest.includes("${twaHost}")
);
assert(
  "the Android launch URL is unchanged",
  gradle.includes(
    'def twaHost = "quotr-2-0-git-android-play-twa-quotr1.vercel.app"'
  ) && !gradle.includes(PLAY_SURFACE_HOST)
);

const terms = readFileSync("app/(legal)/terms/page.tsx", "utf8");
const privacy = readFileSync("app/(legal)/privacy/page.tsx", "utf8");
const login = readFileSync("app/(auth)/login/page.tsx", "utf8");
const signup = readFileSync("app/(auth)/signup/page.tsx", "utf8");
const helpFrame = readFileSync("components/help/help-frame.tsx", "utf8");
const legalLinks = readFileSync("components/legal/LegalDocumentLinks.tsx", "utf8");
assert(
  "Application Terms and Privacy Notice do not link to a purchase",
  !terms.includes('href="/signup"') &&
    !terms.includes('href="/app/settings/billing"') &&
    !terms.includes("checkout.stripe") &&
    !privacy.includes('href="/signup"') &&
    !privacy.includes('href="/app/settings/billing"') &&
    privacy.includes("TERMS_OF_USE_URL") &&
    terms.includes("PRIVACY_POLICY_URL")
);
assert(
  "Play sign-in and Help keep the legal documents reachable",
  legalLinks.includes('href="/terms"') &&
    legalLinks.includes('href="/privacy"') &&
    !legalLinks.includes('href="/signup"') &&
    !legalLinks.includes('href="/app/settings/billing"') &&
    login.includes("<LegalDocumentLinks") &&
    signup.includes("<LegalDocumentLinks") &&
    signup.indexOf("await isPlaySurfaceRequest()") < signup.indexOf("<SignupForm") &&
    helpFrame.includes("<LegalDocumentLinks")
);
assert(
  "the Android app declares the browser helper site-settings activity",
  manifest.includes("com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity")
);

if (process.exitCode) {
  console.error("android play surface checks failed");
} else {
  console.log("android play surface checks passed");
}
