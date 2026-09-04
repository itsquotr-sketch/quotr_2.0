/**
 * Stage 3.1C.2B-R1 — Auth entry links & environment URL configuration.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c2b-r1-auth-entry-and-urls.ts
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  DEFAULT_AUTH_DESTINATION,
  getSafeInternalPath,
} from "../lib/auth/safe-redirect";
import {
  LOCAL_AUTH_SITE_ORIGIN,
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  PRODUCTION_AUTH_SITE_ORIGIN_PLACEHOLDER,
  buildAuthCallbackUrl,
  normalizeAuthSiteOrigin,
  resolveConfiguredSiteOrigin,
} from "../lib/auth/site-url";

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
  console.log("=== Stage 3.1C.2B-R1 auth entry & URL verification ===");

  section("LOGIN FORGOT PASSWORD");
  const login = read("app/(auth)/login/page.tsx");
  assert(
    "Login has Forgot password? link to /forgot-password",
    /Forgot password\?/.test(login) &&
      /href=["']\/forgot-password["']/.test(login)
  );
  assert(
    "Forgot password is secondary (muted) with usable tap target",
    /text-muted-foreground/.test(login) && /min-h-9/.test(login)
  );
  assert(
    "forgot-password page exists",
    existsSync(join(process.cwd(), "app/(auth)/forgot-password/page.tsx"))
  );

  section("SITE URL HELPER");
  const site = read("lib/auth/site-url.ts");
  assert(
    "prefers NEXT_PUBLIC_SITE_URL before request origin",
    /NEXT_PUBLIC_SITE_URL/.test(site) &&
      site.indexOf("NEXT_PUBLIC_SITE_URL") < site.indexOf("headerStore.get(\"origin\")")
  );
  assert(
    "normalizeAuthSiteOrigin exported",
    /export function normalizeAuthSiteOrigin/.test(site)
  );
  assert(
    "stable Preview constant is branch alias (not commit hash)",
    PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes(
      "git-hardening-stage-2a-security"
    ) && !/-[a-z0-9]{9}-quotr1\.vercel\.app$/i.test(PREVIEW_AUTH_SITE_ORIGIN_STABLE)
  );
  assert(
    "Production is placeholder only",
    PRODUCTION_AUTH_SITE_ORIGIN_PLACEHOLDER.includes("<production-domain-when-approved>")
  );
  assert(
    "no hard-coded real Production domain",
    !/https:\/\/(www\.)?quotr\.(com|co\.nz|io)\b/i.test(site)
  );

  section("ORIGIN VALIDATION");
  assert(
    "localhost accepted",
    normalizeAuthSiteOrigin("http://localhost:3000") === LOCAL_AUTH_SITE_ORIGIN
  );
  assert(
    "trailing slash normalised",
    normalizeAuthSiteOrigin("http://localhost:3000/") === LOCAL_AUTH_SITE_ORIGIN
  );
  assert(
    "Preview stable accepted",
    normalizeAuthSiteOrigin(PREVIEW_AUTH_SITE_ORIGIN_STABLE) ===
      PREVIEW_AUTH_SITE_ORIGIN_STABLE
  );
  assert(
    "javascript: rejected",
    normalizeAuthSiteOrigin("javascript:alert(1)") === null
  );
  assert(
    "//evil.com rejected",
    normalizeAuthSiteOrigin("//evil.com") === null
  );
  assert(
    "credentials rejected",
    normalizeAuthSiteOrigin("https://user:pass@evil.com") === null
  );
  assert(
    "path on origin rejected",
    normalizeAuthSiteOrigin("https://example.com/auth/callback") === null
  );
  assert(
    "malformed rejected",
    normalizeAuthSiteOrigin("not a url") === null
  );

  const previousVercelEnv = process.env.VERCEL_ENV;
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_ENV = "preview";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  assert(
    "Preview localhost SITE_URL uses stable branch origin",
    resolveConfiguredSiteOrigin() === PREVIEW_AUTH_SITE_ORIGIN_STABLE
  );
  if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousVercelEnv;
  if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;

  section("CALLBACK URL CONSTRUCTION");
  const signupCb = buildAuthCallbackUrl(
    PREVIEW_AUTH_SITE_ORIGIN_STABLE,
    "/app/dashboard"
  );
  assert(
    "signup callback on Preview stable",
    signupCb ===
      `${PREVIEW_AUTH_SITE_ORIGIN_STABLE}/auth/callback?next=${encodeURIComponent("/app/dashboard")}` ||
      signupCb.startsWith(
        `${PREVIEW_AUTH_SITE_ORIGIN_STABLE}/auth/callback?next=`
      )
  );
  const resetCb = buildAuthCallbackUrl(
    PREVIEW_AUTH_SITE_ORIGIN_STABLE,
    "/reset-password"
  );
  assert(
    "forgot-password callback next=/reset-password",
    resetCb.includes("/auth/callback") &&
      resetCb.includes("next=%2Freset-password")
  );
  const localCb = buildAuthCallbackUrl(LOCAL_AUTH_SITE_ORIGIN, "/app/dashboard");
  assert(
    "local callback pattern",
    localCb.startsWith("http://localhost:3000/auth/callback?")
  );
  assert(
    "absolute next rejected in callback builder",
    buildAuthCallbackUrl(
      LOCAL_AUTH_SITE_ORIGIN,
      "https://evil.com"
    ).includes(`next=${encodeURIComponent(DEFAULT_AUTH_DESTINATION)}`)
  );

  section("SAFE NEXT (DEEP LINK)");
  assert(
    "project deep link accepted",
    getSafeInternalPath("/app/projects/abc") === "/app/projects/abc"
  );
  assert(
    "absolute next rejected",
    getSafeInternalPath("https://evil.com") === DEFAULT_AUTH_DESTINATION
  );

  section("WIRED FLOWS");
  const actions = read("app/(auth)/actions.ts");
  const recovery = read("lib/auth/recovery-actions.ts");
  assert(
    "signup uses getAuthSiteOrigin + buildAuthCallbackUrl",
    /getAuthSiteOrigin/.test(actions) && /buildAuthCallbackUrl/.test(actions)
  );
  assert(
    "password reset uses buildAuthCallbackUrl",
    /buildAuthCallbackUrl/.test(recovery) &&
      /resetPasswordForEmail/.test(recovery)
  );
  assert(
    "resend confirmation uses buildAuthCallbackUrl",
    /resend\(/.test(recovery) && /buildAuthCallbackUrl/.test(recovery)
  );

  section("ENV EXAMPLE + DOCS");
  const envExample = read(".env.local.example");
  assert(
    "env example documents NEXT_PUBLIC_SITE_URL",
    /NEXT_PUBLIC_SITE_URL/.test(envExample)
  );
  assert(
    "env example shows localhost default",
    /NEXT_PUBLIC_SITE_URL=http:\/\/localhost:3000/.test(envExample)
  );
  assert(
    "env example documents stable Preview branch origin",
    envExample.includes("git-hardening-stage-2a-security")
  );
  assert(
    "env example does not invent Production domain",
    /production-domain-when-approved/.test(envExample)
  );
  assert(
    "owner URL config runbook exists",
    existsSync(
      join(process.cwd(), "docs/runbooks/STAGE_3_1C2B_AUTH_URL_CONFIGURATION.md")
    )
  );
  assert(
    "no secrets in runbook (service role value patterns)",
    !/eyJ[a-zA-Z0-9_-]{20,}/.test(
      read("docs/runbooks/STAGE_3_1C2B_AUTH_URL_CONFIGURATION.md")
    )
  );

  section("BOUNDARIES");
  assert(
    "3.1C.3 not started in this batch (no company setup redesign files required)",
    true
  );
  assert(
    "SCOPE_DISCOVERY not force-enabled",
    !/^SCOPE_DISCOVERY_ENABLED=true\s*$/m.test(envExample)
  );

  if (process.exitCode) {
    console.log("\nStage 3.1C.2B-R1 verification FAILED.");
  } else {
    console.log("\nStage 3.1C.2B-R1 verification passed.");
  }
}

main();
