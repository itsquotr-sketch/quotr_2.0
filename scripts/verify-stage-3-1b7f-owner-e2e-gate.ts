/**
 * Stage 3.1B.7F — Owner Preview E2E gate documentation + release invariants.
 * Run: npx tsx scripts/verify-stage-3-1b7f-owner-e2e-gate.ts
 *
 * Does not execute live Preview E2E. Does not enable Production.
 * After Stage 3.1B closure, asserts Owner-validated PASS evidence + Production Disabled.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isScopeDiscoveryEnabled,
  SCOPE_DISCOVERY_ENABLED_ENV,
} from "../lib/scope-discovery/configuration";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function fileHas(path: string, needle: string | RegExp): boolean {
  const src = read(path);
  return typeof needle === "string" ? src.includes(needle) : needle.test(src);
}

const ROOT = process.cwd();

console.log(
  "\n=== Stage 3.1B.7F — Owner E2E Gate Verification ===\n"
);

const TEST_PACK = "docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md";
const RESULTS = "docs/audits/STAGE_3_1B7F_OWNER_E2E_RESULTS.md";
const COMPLETION =
  "docs/implementation/STAGE_3_1B7F_OWNER_E2E_GATE_COMPLETION.md";
const DEFECTS = "docs/audits/STAGE_3_1B7E_PREVIEW_DEFECT_REGISTER.md";
const PERF = "docs/performance/STAGE_3_1B_PREVIEW_PERFORMANCE_RESULTS.md";
const ENABLEMENT =
  "docs/runbooks/STAGE_3_1B_PRODUCTION_ENABLEMENT_RUNBOOK.md";
const PLAN = "docs/plans/STAGE_3_1B_INTELLIGENT_SCOPE_DISCOVERY_PLAN.md";
const ROADMAP = "docs/plans/STAGE_3_PRODUCT_ROADMAP.md";
const BACKLOG = "docs/product/QUOTR_PRODUCT_BACKLOG.md";
const HARDENING = "docs/MVP_HARDENING_GUIDE.md";

// —— Required artifacts ——
check("owner E2E test pack exists", existsSync(join(ROOT, TEST_PACK)));
check("owner E2E results template exists", existsSync(join(ROOT, RESULTS)));
check("7F completion doc exists", existsSync(join(ROOT, COMPLETION)));
check("7E defect register still present", existsSync(join(ROOT, DEFECTS)));
check("performance results doc present", existsSync(join(ROOT, PERF)));
check("production enablement runbook present", existsSync(join(ROOT, ENABLEMENT)));

// —— Test pack content ——
check(
  "test pack includes Deck scenario",
  fileHas(TEST_PACK, "Project A — Deck") && fileHas(TEST_PACK, "elevated")
);
check(
  "test pack includes Bathroom scenario",
  fileHas(TEST_PACK, "Project B — Bathroom") &&
    fileHas(TEST_PACK, "waterproofing")
);
check(
  "test pack includes Commercial Fitout scenario",
  fileHas(TEST_PACK, "Project C — Commercial Fitout") &&
    fileHas(TEST_PACK, "fire stopping")
);
check(
  "test pack includes quality rubric 1–5",
  fileHas(TEST_PACK, "Quality rubric") &&
    /average\s*[≥>=]\s*\*?\*?4/i.test(read(TEST_PACK))
);
check(
  "test pack includes latency capture guidance",
  fileHas(TEST_PACK, "Latency capture") &&
    fileHas(TEST_PACK, "quotr-preview-perf")
);
check(
  "test pack includes provider usage guidance",
  fileHas(TEST_PACK, "Provider usage") &&
    fileHas(TEST_PACK, "Do **not** store project text")
);
check(
  "test pack includes log review process",
  fileHas(TEST_PACK, "Log review process") &&
    fileHas(TEST_PACK, "Critical / High / Medium / Low / benign")
);
check(
  "test pack includes commercial check",
  fileHas(TEST_PACK, "Commercial check") &&
    /unexplained money mismatch/i.test(read(TEST_PACK))
);
check(
  "test pack release options A and B",
  fileHas(TEST_PACK, "READY FOR OWNER PRODUCTION GATE") &&
    fileHas(TEST_PACK, "BLOCKED BY PREVIEW DEFECTS")
);
check(
  "test pack does not enable Production",
  fileHas(TEST_PACK, "Do **not** enable Production") ||
    fileHas(TEST_PACK, "Remains **Disabled**")
);

// —— Results (post–Owner E2E / Stage 3.1B closed) ——
check(
  "results has three project sections",
  fileHas(RESULTS, "Project A — Deck") &&
    fileHas(RESULTS, "Project B — Bathroom") &&
    fileHas(RESULTS, "Project C — Commercial Fitout")
);
check(
  "results records Deck / Bathroom / Fitout PASS",
  fileHas(RESULTS, "Deck") &&
    fileHas(RESULTS, "Bathroom") &&
    fileHas(RESULTS, "Fitout") &&
    fileHas(RESULTS, "**PASS**")
);
check(
  "results closed Complete — Preview Validated",
  fileHas(RESULTS, "Complete — Preview Validated") &&
    fileHas(RESULTS, "READY FOR OWNER PRODUCTION GATE")
);
check(
  "results keep Production enablement separate",
  (fileHas(RESULTS, "Disabled") || fileHas(RESULTS, "separate")) &&
    /Production/i.test(read(RESULTS))
);

// —— Completion doc invariants ——
check(
  "7F completion keeps Production disabled",
  fileHas(COMPLETION, "Production") &&
    (fileHas(COMPLETION, "Disabled") ||
      fileHas(COMPLETION, "Production remains")) &&
    !fileHas(COMPLETION, "Production — Enabled")
);
check(
  "7F marks Stage 3.1B Complete — Preview Validated",
  fileHas(COMPLETION, "Complete — Preview Validated")
);
check(
  "7F points at Stage 3.1B closure",
  fileHas(COMPLETION, "STAGE_3_1B_CLOSURE")
);
check(
  "7F does not begin Stage 3.2 implementation",
  fileHas(COMPLETION, "Stage 3.2") &&
    (fileHas(COMPLETION, "Not Started") ||
      fileHas(COMPLETION, "Do not begin Stage 3.2"))
);

// —— Defect register ——
check(
  "DEF-7E-003 closed / Owner validated",
  fileHas(DEFECTS, "DEF-7E-003") &&
    fileHas(DEFECTS, "Complete / Owner validated")
);
check(
  "defect register points to 7F pack / results",
  fileHas(DEFECTS, "STAGE_3_1B7F_OWNER_E2E") ||
    fileHas(DEFECTS, "3.1B.7F")
);
check(
  "release gate Complete — Preview Validated (not BLOCKED)",
  fileHas(DEFECTS, "Complete — Preview Validated") &&
    !fileHas(DEFECTS, "**Stage 3.1B — BLOCKED BY PREVIEW DEFECTS**")
);

// —— Status board updates ——
check(
  "ISD plan references 7F",
  fileHas(PLAN, "3.1B.7F") || fileHas(PLAN, "7F")
);
check(
  "roadmap references 7F",
  fileHas(ROADMAP, "3.1B.7F") || fileHas(ROADMAP, "7F")
);
check(
  "backlog references 7F",
  fileHas(BACKLOG, "3.1B.7F") || fileHas(BACKLOG, "7F")
);
check(
  "MVP hardening guide references 7F",
  fileHas(HARDENING, "3.1B.7F") || fileHas(HARDENING, "7F")
);
check(
  "perf results reference 7F E2E capture",
  fileHas(PERF, "7F") || fileHas(PERF, "Owner E2E")
);

// —— Feature flag / boundaries ——
check(
  "flag defaults disabled",
  isScopeDiscoveryEnabled({}) === false
);
check(
  "flag exact true only",
  isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "true" }) === true &&
    isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "" }) === false
);
check(
  "env constant SCOPE_DISCOVERY_ENABLED",
  SCOPE_DISCOVERY_ENABLED_ENV === "SCOPE_DISCOVERY_ENABLED"
);
check(
  "no NEXT_PUBLIC scope discovery flag module",
  !fileHas(
    "lib/scope-discovery/configuration/feature-flags.ts",
    "NEXT_PUBLIC_SCOPE_DISCOVERY"
  )
);
check(
  "no migration 030",
  !existsSync(join(ROOT, "supabase/migrations/030_scope_discovery.sql"))
);
check(
  "2B.10 verify script present",
  existsSync(
    join(ROOT, "scripts/verify-batch-2b10-final-commercial-authority.ts")
  )
);
check(
  "preview performance helper present",
  existsSync(join(ROOT, "lib/assistant/preview-performance.ts"))
);
check(
  "enablement runbook keeps Production disabled by default",
  fileHas(ENABLEMENT, "Production remains disabled") ||
    fileHas(ENABLEMENT, "Do not enable Production")
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
