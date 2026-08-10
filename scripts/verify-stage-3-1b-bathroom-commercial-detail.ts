/**
 * Stage 3.1B — Bathroom commercial detail (access wording) verification.
 *
 * Run: npx tsx scripts/verify-stage-3-1b-bathroom-commercial-detail.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getLabourAdjustmentFactor,
  getWorkAreaAccessFactor,
} from "../lib/estimate/adjustments";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import {
  applyLabourMinimums,
  formatAccessAdjustmentDisplay,
  formatLabourMinimumDisplay,
  getCommercialTrustDetailLines,
} from "../lib/estimate/commercial-realism";
import type { EstimateContext, EstimateWorkArea } from "../lib/estimate/types";

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`PASS  ${label}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${label}`);
    failed += 1;
  }
}

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

console.log("\n=== Stage 3.1B — Bathroom commercial detail (access) ===\n");

// ─── Recognition ─────────────────────────────────────────────
check(
  "Restricted maps to same work-area access factor as Difficult (1.1)",
  getWorkAreaAccessFactor("Restricted") === 1.1 &&
    getWorkAreaAccessFactor("Difficult") === 1.1
);
check(
  "Easy / Standard / blank do not inflate access factor",
  getWorkAreaAccessFactor("Easy") === 1 &&
    getWorkAreaAccessFactor("Standard") === 1 &&
    getWorkAreaAccessFactor(null) === 1
);
check(
  "Moderate remains 1.05",
  getWorkAreaAccessFactor("Moderate") === 1.05
);

// ─── Display ─────────────────────────────────────────────────
const restrictedMeta = applyLabourMinimums({
  calculatedHours: 10,
  minTotalHours: 8,
  accessFactor: getWorkAreaAccessFactor("Restricted"),
  accessLabel: "Restricted",
  accessLabourKind: "removal",
});
const lines = formatLabourMinimumDisplay(restrictedMeta.metadata);
check(
  "raw 'Access factor: Restricted' is not contractor-facing output",
  !lines.some((l) => /access factor:/i.test(l))
);
check(
  "Restricted removal line explains handling/removal + %",
  lines.some(
    (l) =>
      /restricted site access/i.test(l) &&
      /handling\/removal/i.test(l) &&
      /\+10%/.test(l)
  )
);

const installLine = formatAccessAdjustmentDisplay({
  accessFactor: 1.1,
  accessLabel: "Difficult",
  accessLabourKind: "installation",
});
check(
  "installation kind uses installation wording",
  !!installLine &&
    /installation labour/i.test(installLine) &&
    /\+10%/.test(installLine)
);

check(
  "no access display when factor is 1 (label alone must not surface)",
  formatAccessAdjustmentDisplay({
    accessFactor: undefined,
    accessLabel: "Restricted",
  }) === null &&
    applyLabourMinimums({
      calculatedHours: 10,
      accessFactor: 1,
      accessLabel: "Restricted",
    }).metadata.accessLabel === undefined
);

// ─── Bathroom calculator wiring ──────────────────────────────
const wa: EstimateWorkArea = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom",
  sort_order: 1,
};
const ctx = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [wa],
  facts: [
    {
      key: "bathroom.area_m2",
      work_area_id: "b1",
      value: 6,
      source: "manual",
    },
    {
      key: "bathroom.renovation_type",
      work_area_id: "b1",
      value: "Full strip-out and rebuild",
      source: "manual",
    },
    {
      key: "bathroom.demolition_required",
      work_area_id: "b1",
      value: true,
      source: "manual",
    },
    {
      key: "bathroom.access",
      work_area_id: "b1",
      value: "Restricted",
      source: "manual",
    },
    {
      key: "bathroom.tile_extent",
      work_area_id: "b1",
      value: "Floor only",
      source: "manual",
    },
  ],
  // Project-level constraints present — bathroom must NOT double-apply via
  // getLabourAdjustmentFactor on these in-house labour lines.
  constraints: [
    { key: "site_access", value: "Difficult", label: "Site access" },
    {
      key: "material_carry_distance",
      value: "10–30m",
      label: "Material carry distance",
    },
  ],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: {
    sheet_material: 10,
    flooring: 10,
    paint: 10,
    default: 5,
  },
  rates: [],
} as unknown as EstimateContext;

const result = calculateBathroom(ctx, wa);
const demo = result.lineItems.find((i) => /demolition/i.test(i.label));
const carpentry = result.lineItems.find((i) => /carpentry/i.test(i.label));

check("Demolition/strip-out line present with Restricted access", !!demo);
check("Bathroom carpentry/prep labour line present", !!carpentry);

const demoTrust = getCommercialTrustDetailLines({
  labourMinimum: demo?.labourMinimum,
  notes: demo?.notes,
});
const carpTrust = getCommercialTrustDetailLines({
  labourMinimum: carpentry?.labourMinimum,
  notes: carpentry?.notes,
});

check(
  "Demolition commercial detail has no Access factor wording",
  !demoTrust.some((l) => /access factor/i.test(l))
);
check(
  "Carpentry commercial detail has no Access factor wording",
  !carpTrust.some((l) => /access factor/i.test(l))
);
check(
  "Demolition commercial detail names restricted access + removal labour",
  demoTrust.some(
    (l) => /restricted site access/i.test(l) && /handling\/removal/i.test(l)
  )
);
check(
  "Carpentry commercial detail names restricted access + installation labour",
  carpTrust.some(
    (l) => /restricted site access/i.test(l) && /installation labour/i.test(l)
  )
);

// Access applied once via applyLabourMinimums hours scale — not again via
// getLabourAdjustmentFactor on bathroom labour lines.
const compound = getLabourAdjustmentFactor(ctx.constraints);
check(
  "site_access + carry still form independent compound factor (deck/fence path)",
  compound > 1.1 && compound <= 1.35
);

const demoHours = demo?.labourHours ?? 0;
const demoWithoutAccess = applyLabourMinimums({
  calculatedHours: demo?.labourMinimum?.calculatedHours ?? 10,
  minCrewSize: 2,
  minDurationHours: 4,
  minTotalHours: 8,
  accessFactor: 1,
  smallJobFactor: demo?.labourMinimum?.smallJobFactor ?? 1,
}).finalHours;
check(
  "access adjustment still applies on demolition hours when not floor-min dominated",
  demoHours >= demoWithoutAccess
);

// Single accessFactor on each line — no duplicate accessKey in metadata.
check(
  "no duplicate access multiplier fields on demolition meta",
  demo?.labourMinimum?.accessFactor === 1.1 &&
    Object.keys(demo?.labourMinimum ?? {}).filter((k) =>
      k.toLowerCase().includes("access")
    ).length <= 3
);

// ─── Distinction documented in code comments / helpers ───────
check(
  "bathroom calculator does not import getLabourAdjustmentFactor",
  !read("lib/estimate/calculators/bathroom.ts").includes(
    "getLabourAdjustmentFactor"
  )
);
check(
  "formatLabourMinimumDisplay no longer emits Access factor:",
  !read("lib/estimate/commercial-realism.ts").includes(
    "Access factor:"
  )
);
check(
  "demolition calculator no longer emits Access factor: formula",
  !read("lib/estimate/calculators/demolition.ts").includes(
    "Access factor:"
  )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
