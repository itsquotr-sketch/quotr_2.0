/**
 * Public help centre: local search, eight guides, and navigation links.
 *
 * Run: npx --yes tsx scripts/verify-help-centre.ts
 */
import { readFileSync } from "node:fs";
import {
  HELP_ARTICLES,
  HELP_GROUPS,
  HELP_ON_THIS_PAGE_MIN_SECTIONS,
  HELP_SUPPORT_EMAIL,
  getHelpArticle,
  helpArticlePlainText,
  helpSectionId,
} from "../lib/help/content";
import { helpInlineParts } from "../lib/help/inline";
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
const helpLayout = readFileSync("app/help/layout.tsx", "utf8");
const articlePage = readFileSync("app/help/[slug]/page.tsx", "utf8");
const helpSearch = readFileSync("components/help/help-search.tsx", "utf8");
const helpArticle = readFileSync("components/help/help-article.tsx", "utf8");
const helpFrame = readFileSync("components/help/help-frame.tsx", "utf8");

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
    !/pathname === "\/help"[\s\S]{0,400}redirect\(/.test(middleware) &&
    helpPage.includes("How can we help?") &&
    articlePage.includes("generateStaticParams") &&
    !helpPage.includes("supabase") &&
    !articlePage.includes("supabase") &&
    !helpLayout.includes("supabase") &&
    !helpLayout.includes("getOrgBillingState")
);
assert(
  "signed-in return uses the existing session flag only",
  middleware.includes('requestHeaders.set("x-quotr-help-return", authenticated ? "1" : "0")') &&
    helpLayout.includes('headerStore.get("x-quotr-help-return") === "1"') &&
    helpFrame.includes("Back to Quotr") &&
    helpFrame.includes('href="/app/dashboard"') &&
    helpFrame.includes("Sign in") &&
    helpFrame.includes('href="/login"')
);
assert(
  "landing search and first group stay readable",
  HELP_GROUPS[0]?.label === "Start here" &&
    helpSearch.includes("Search help") &&
    !helpSearch.includes("sr-only") &&
    helpSearch.includes("Search help, e.g. rates or sending a quote") &&
    helpArticle.includes("max-w-[760px]") === false &&
    helpFrame.includes("max-w-[760px]") &&
    helpArticle.includes("leading-[1.6]") &&
    helpArticle.includes("On this page") === false &&
    readFileSync("components/help/help-on-this-page.tsx", "utf8").includes("On this page")
);
assert(
  "longer guides have stable unique section anchors and no empty media",
  HELP_ARTICLES.every((article) => {
    const ids = article.sections.map(helpSectionId);
    return (
      new Set(ids).size === ids.length &&
      ids.every((id) => id.length > 0) &&
      article.sections.every((section) => section.media == null)
    );
  }) &&
    HELP_ARTICLES.some((article) => article.sections.length >= HELP_ON_THIS_PAGE_MIN_SECTIONS) &&
    HELP_ARTICLES.some((article) => article.sections.length < HELP_ON_THIS_PAGE_MIN_SECTIONS)
);
assert(
  "guide references are links and labels stay visible in search",
  plain.includes("select continue to save your answers and open the next step.") &&
    helpInlineParts("See [Rates and productivity](/help/rates-and-productivity).").some(
      (part) => part.kind === "link" && part.href === "/help/rates-and-productivity"
    ) &&
    searchHelp("continue").every((hit) => !hit.excerpt.includes("**") && !hit.excerpt.includes("]("))
);

if (failed > 0) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nHelp centre checks passed.");
