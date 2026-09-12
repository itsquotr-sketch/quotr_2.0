/**
 * EF02-FINAL-R4-A — Analyse constraint rollback is atomic per attempt.
 *
 * Run: npx --yes tsx scripts/verify-analyse-atomic-rollback-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyConstraintRollbackToStore,
  planConstraintRollback,
  rollbackThisAttemptAnalyseState,
  snapshotTouchedConstraints,
  type ConstraintPersistRow,
} from "../lib/assistant/analyse-persist-safety";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function row(
  key: string,
  value: unknown,
  source: string,
  extras?: Partial<ConstraintPersistRow>
): ConstraintPersistRow {
  return {
    id: extras?.id ?? `id-${key}`,
    key,
    label: extras?.label ?? key,
    value,
    source,
  };
}

function byKey(rows: readonly ConstraintPersistRow[], key: string) {
  return rows.find((item) => item.key === key) ?? null;
}

function simulateAttempt(params: {
  existing: ConstraintPersistRow[];
  writes: Array<{ key: string; value: unknown; source?: string }>;
  failAfter?: string;
}): {
  snapshots: ReturnType<typeof snapshotTouchedConstraints>;
  afterPartial: ConstraintPersistRow[];
  afterRollback: ConstraintPersistRow[];
} {
  const snapshots = snapshotTouchedConstraints(
    params.existing,
    params.writes.map((item) => item.key)
  );
  const store = new Map(params.existing.map((item) => [item.key, { ...item }]));
  for (const write of params.writes) {
    if (params.failAfter && write.key === params.failAfter) break;
    const prior = store.get(write.key);
    store.set(write.key, {
      id: prior?.id ?? `new-${write.key}`,
      key: write.key,
      label: write.key,
      value: write.value,
      source: write.source ?? "ai_extracted",
    });
  }
  const afterPartial = [...store.values()];
  const afterRollback = applyConstraintRollbackToStore(
    afterPartial,
    planConstraintRollback(snapshots)
  );
  return { snapshots, afterPartial, afterRollback };
}

console.log("=== EF02-FINAL-R4-A Analyse constraint rollback ===\n");

console.log("--- A. no previous constraints ---\n");
const a = simulateAttempt({
  existing: [],
  writes: [
    { key: "site_access", value: "Easy" },
    { key: "occupied_site", value: "No" },
  ],
  failAfter: "occupied_site",
});
check(
  "A: this-attempt site_access was written before failure",
  byKey(a.afterPartial, "site_access")?.value === "Easy"
);
check("A: neither remains after rollback", a.afterRollback.length === 0);

console.log("\n--- B. pre-existing user constraint ---\n");
const b = simulateAttempt({
  existing: [row("site_access", "Restricted", "user", { label: "Site access" })],
  writes: [{ key: "site_access", value: "Easy" }],
});
check(
  "B: Analyse overwrote to Easy / ai_extracted",
  byKey(b.afterPartial, "site_access")?.source === "ai_extracted" &&
    byKey(b.afterPartial, "site_access")?.value === "Easy"
);
check(
  "B: Restricted / user restored",
  byKey(b.afterRollback, "site_access")?.value === "Restricted" &&
    byKey(b.afterRollback, "site_access")?.source === "user" &&
    byKey(b.afterRollback, "site_access")?.label === "Site access"
);

console.log("\n--- C. pre-existing AI constraint ---\n");
const c = simulateAttempt({
  existing: [row("occupied_site", "Yes", "ai_extracted")],
  writes: [{ key: "occupied_site", value: "No" }],
});
check(
  "C: exact prior AI value/source restored",
  byKey(c.afterRollback, "occupied_site")?.value === "Yes" &&
    byKey(c.afterRollback, "occupied_site")?.source === "ai_extracted"
);

console.log("\n--- D. partial Promise.all ---\n");
const d = simulateAttempt({
  existing: [],
  writes: [
    { key: "site_access", value: "STALE_PARTIAL" },
    { key: "occupied_site", value: "STALE_PARTIAL" },
  ],
  failAfter: "occupied_site",
});
check(
  "D: first write succeeded before failure",
  byKey(d.afterPartial, "site_access")?.value === "STALE_PARTIAL" &&
    byKey(d.afterPartial, "occupied_site") == null
);
check(
  "D: all touched keys restored (neither leftover)",
  a.afterRollback.length === 0 &&
    d.afterRollback.length === 0 &&
    d.snapshots.length === 2
);

console.log("\n--- E. unrelated constraint unchanged ---\n");
const e = simulateAttempt({
  existing: [
    row("working_hours", "No", "user"),
    row("site_access", "Easy", "ai_extracted"),
  ],
  writes: [{ key: "site_access", value: "Restricted" }],
});
check(
  "E: untouched working_hours stays No / user",
  byKey(e.afterRollback, "working_hours")?.value === "No" &&
    byKey(e.afterRollback, "working_hours")?.source === "user"
);
check(
  "E: snapshots omit unrelated keys",
  e.snapshots.every((item) => item.key !== "working_hours")
);

console.log("\n--- F. Work Area / fact rollback still works ---\n");
const afterWa = rollbackThisAttemptAnalyseState({
  workAreas: [
    { id: "prior", type: "demolition", name: "Demolition", status: "confirmed" },
    { id: "new-1", type: "internal_walls", name: "Ground Floor Partitions", status: "suggested" },
    { id: "new-2", type: "internal_walls", name: "Upstairs Partitions", status: "suggested" },
  ],
  factWorkAreaIds: ["new-1", "new-2"],
  stage: "confirm_work_areas",
  insertedWorkAreaIds: ["new-1", "new-2"],
});
check(
  "F: this-attempt suggested Internal Walls are removed",
  afterWa.workAreas.length === 1 && afterWa.workAreas[0]?.id === "prior"
);
check("F: this-attempt facts are not left behind", afterWa.factWorkAreaIds.length === 0);
check("F: stage returns to brief", afterWa.stage === "brief");

console.log("\n--- G. retry after failure is clean ---\n");
const staleAttempt = simulateAttempt({
  existing: [row("working_hours", "No", "user")],
  writes: [
    { key: "site_access", value: "STALE_PARTIAL" },
    { key: "occupied_site", value: "STALE_PARTIAL" },
  ],
  failAfter: "occupied_site",
});
const retryWrites = [
  { key: "site_access", value: "Easy" },
  { key: "occupied_site", value: "No" },
];
const retrySnapshots = snapshotTouchedConstraints(
  staleAttempt.afterRollback,
  retryWrites.map((item) => item.key)
);
const retryStore = new Map(
  staleAttempt.afterRollback.map((item) => [item.key, { ...item }])
);
for (const write of retryWrites) {
  retryStore.set(write.key, {
    id: `retry-${write.key}`,
    key: write.key,
    label: write.key,
    value: write.value,
    source: "ai_extracted",
  });
}
const retryRows = [...retryStore.values()];
check(
  "G: failed attempt left no STALE_PARTIAL for retry to inherit",
  staleAttempt.afterRollback.every((item) => item.value !== "STALE_PARTIAL")
);
check(
  "G: retry writes Easy/No without inheriting stale conditions",
  byKey(retryRows, "site_access")?.value === "Easy" &&
    byKey(retryRows, "occupied_site")?.value === "No" &&
    byKey(retryRows, "working_hours")?.value === "No"
);
check(
  "G: retry snapshots see no prior stale rows",
  retrySnapshots.every((item) => item.prior == null || item.prior.value !== "STALE_PARTIAL")
);

console.log("\n--- Wiring ---\n");
const actionsSrc = read("lib/assistant/actions.ts");
const safetySrc = read("lib/assistant/analyse-persist-safety.ts");
check(
  "failPersist restores touched constraints then WAs",
  actionsSrc.includes("constraintSnapshots") &&
    actionsSrc.includes("snapshotTouchedConstraints") &&
    actionsSrc.includes("restoreTouchedConstraints")
);
check(
  "rollback failure is logged, user copy stays generic",
  actionsSrc.includes("constraint rollback failed") &&
    actionsSrc.includes("UNKNOWN_ANALYSIS_ERROR") &&
    !actionsSrc.includes("STALE_PARTIAL")
);
check(
  "Promise.all remains for constraint writes",
  actionsSrc.includes("await Promise.all(writes.map")
);
check(
  "user constraints are still not overwritten",
  actionsSrc.includes('existing?.source === "user"')
);
check(
  "safety module owns snapshot + restore plan",
  safetySrc.includes("snapshotTouchedConstraints") &&
    safetySrc.includes("planConstraintRollback")
);
check(
  "no new numbered migration in this phase",
  !actionsSrc.includes("058_") && !safetySrc.includes("058_")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
