/**
 * Play surface host boundary.
 * Run: npx tsx scripts/verify-android-play-surface.ts
 */
import { readFileSync } from "node:fs";
import { HELP_ARTICLES } from "../lib/help/content";
import { helpArticleForPlaySurface } from "../lib/help/play-surface-article";
import {
  isPlaySurfaceHost,
  PLAY_SURFACE_BILLING_NOTE,
  PLAY_SURFACE_PREVIEW_HOST,
} from "../lib/android/play-surface";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok ${label}`);
}

const previous = process.env.QUOTR_PLAY_SURFACE_HOSTS;
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
process.env.QUOTR_PLAY_SURFACE_HOSTS = previous;

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
  "the Android app declares the browser helper site-settings activity",
  manifest.includes("com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity")
);

if (process.exitCode) {
  console.error("android play surface checks failed");
} else {
  console.log("android play surface checks passed");
}
