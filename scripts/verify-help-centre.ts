/**
 * Public help centre: local search, eight guides, and navigation links.
 *
 * Run: npx --yes tsx scripts/verify-help-centre.ts
 */
import { readFileSync } from "node:fs";
import {
  HELP_ARTICLES,
  HELP_GROUPS,
  HELP_SUPPORT_EMAIL,
  getHelpArticle,
  helpArticlePlainText,
} from "../lib/help/content";
import { searchHelp } from "../lib/help/search";

let failed = 0;

function assert(name: string, ok: boolean): void {
  if (ok) {
    console.log(`PASS  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}`);
}

const slugs = HELP_ARTICLES.map((article) => article.slug);
assert("eight guides", HELP_ARTICLES.length === 8 && new Set(slugs).size === 8);
assert(
  "groups list every guide once",
  HELP_GROUPS.flatMap((group) => [...group.slugs]).join() === slugs.join()
);
assert(
  "related guides exist",
  HELP_ARTICLES.every((article) =>
    article.related.every((slug) => getHelpArticle(slug) != null && slug !== article.slug)
  )
);
assert(
  "support email is the public address",
  HELP_SUPPORT_EMAIL === "hello@get-quotr.com"
);

const gst = searchHelp("gst");
assert(
  "gst search finds getting started",
  gst.some((hit) => hit.slug === "getting-started") && gst.every((hit) => hit.excerpt.length > 0)
);
assert(
  "client preview search finds sending",
  searchHelp("client preview").some((hit) => hit.slug === "sending-a-quote")
);
assert(
  "deck productivity search finds rates",
  searchHelp("deck productivity").some((hit) => hit.slug === "rates-and-productivity")
);
assert(
  "keyword rfq finds variations without showing the keyword list",
  searchHelp("rfq").some((hit) => hit.slug === "variations-and-subcontractor-prices" && !hit.excerpt.includes("rfq"))
);
assert("empty search has no hits", searchHelp("  ").length === 0);
assert("unknown search has no hits", searchHelp("zzzznotaterm").length === 0);

const plain = HELP_ARTICLES.map(helpArticlePlainText).join("\n").toLowerCase();
assert(
  "articles do not promise guaranteed prices or automatic updates",
  plain.includes("not guaranteed") && plain.includes("no automatic price update")
);
assert(
  "articles do not mention retrieval internals",
  !plain.includes("supabase") && !plain.includes("embedding") && !plain.includes("stripe secret")
);

const sidebar = readFileSync("components/app-sidebar.tsx", "utf8");
const menu = readFileSync("components/layout/mobile-menu-sheet.tsx", "utf8");
const onboarding = readFileSync("components/setup/OnboardingFrame.tsx", "utf8");
const setupRequired = readFileSync("components/auth/SetupRequiredForm.tsx", "utf8");
const middleware = readFileSync("middleware.ts", "utf8");
const helpPage = readFileSync("app/help/page.tsx", "utf8");
const articlePage = readFileSync("app/help/[slug]/page.tsx", "utf8");

assert(
  "sidebar help sits with report issue and is not a primary destination",
  sidebar.includes("<HelpLink") &&
    sidebar.includes("FeedbackLink") &&
    sidebar.indexOf("<HelpLink") > sidebar.indexOf('label="Work"') &&
    !sidebar.includes('href: "/help"')
);
assert(
  "mobile help is outside the setup-incomplete hide",
  menu.includes("<HelpLink") &&
    menu.includes("FeedbackLink") &&
    menu.indexOf("<HelpLink") > menu.indexOf("setupIncomplete ? null")
);
assert(
  "setup keeps help and has no primary nav",
  onboarding.includes("No primary nav") &&
    onboarding.includes("<HelpLink") &&
    !onboarding.includes("MobileNav") &&
    setupRequired.includes('href="/help"')
);
assert(
  "public help is not an authenticated app route",
  middleware.includes('pathname.startsWith("/app")') &&
    !middleware.includes('pathname.startsWith("/help")') &&
    helpPage.includes("How can we help?") &&
    articlePage.includes("generateStaticParams") &&
    !helpPage.includes("supabase") &&
    !articlePage.includes("supabase")
);

if (failed > 0) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nHelp centre checks passed.");
