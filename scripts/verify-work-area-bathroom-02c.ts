/**
 * WA-BATHROOM-02C — consecutive Clarify numeric saves + vanity tiling leak.
 *
 * Run: npx --yes tsx scripts/verify-work-area-bathroom-02c.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { clarifyFieldIdentity } from "../lib/assistant/clarify/numeric";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { bathroomQuestionGroupVisible } from "../lib/estimate/bathroom-scope";
import type { EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

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

function wa(
  id: string,
  type: string,
  name: string
): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function composeWa(type: string, name: string, id: string, facts: EstimateFact[]) {
  const workAreas = [wa(id, type, name)];
  const plan = composeJobPlan({
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
    })),
    facts,
  });
  return {
    plan,
    clarify: composeClarifyView({
      stage: "quality",
      briefText: null,
      qualityLevel: "standard",
      workAreas,
      facts,
      constraints: [],
      jobPlan: plan,
    }),
  };
}

function tilingCopy(rows: readonly { statement?: string; factKey?: string | null }[]) {
  return rows.some(
    (row) =>
      row.factKey === "bathroom.tiling_included" ||
      /assuming tiling/i.test(String(row.statement || ""))
  );
}

console.log("=== WA-BATHROOM-02C ===\n");

console.log("--- Mechanism ---\n");
const valueField = read("components/assistant/clarify/ClarifyValueField.tsx");
const panel = read("components/assistant/clarify/ClarifyPanel.tsx");
const numeric = read("lib/assistant/clarify/numeric.ts");
check(
  "field identity helper exists",
  numeric.includes("export function clarifyFieldIdentity")
);
check(
  "ClarifyQuestion remounts on field identity",
  panel.includes("key={clarifyFieldIdentity(showing ?? current)}")
);
check(
  "ClarifyValueField remounts on candidate identity",
  panel.includes("key={clarifyFieldIdentity(candidate)}") &&
    valueField.includes("clarifyFieldIdentity(candidate)")
);
check(
  "duplicate-save token is per-field",
  valueField.includes("${fieldKey}:${parsed.value}")
);
check(
  "no bathroom-specific reload hack",
  !valueField.toLowerCase().includes("reload") &&
    !panel.toLowerCase().includes("window.location")
);

const lengthId = clarifyFieldIdentity({
  id: "hard:b1:bathroom.length_m",
  factKey: "bathroom.length_m",
});
const widthId = clarifyFieldIdentity({
  id: "hard:b1:bathroom.width_m",
  factKey: "bathroom.width_m",
});
check("length/width field identities differ", lengthId !== widthId);
check(
  "stale length token does not match width token",
  `${lengthId}:3` !== `${widthId}:3`
);

console.log("\n--- Bathroom consecutive numeric ---\n");
const bathOpen = composeWa("bathroom", "Bathroom", "b1", [
  fact("bathroom.job_scope", "b1", "full_renovation"),
]);
const openLength = bathOpen.clarify.candidates.find(
  (c) => c.factKey === "bathroom.length_m"
);
const openWidth = bathOpen.clarify.candidates.find(
  (c) => c.factKey === "bathroom.width_m"
);
check("full reno asks length and width together", Boolean(openLength && openWidth));
check(
  "open length/width ids differ",
  Boolean(openLength && openWidth) &&
    clarifyFieldIdentity(openLength!) !== clarifyFieldIdentity(openWidth!)
);
const bathAfterLength = composeWa("bathroom", "Bathroom", "b1", [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
]);
const nextAfterLength = bathAfterLength.clarify.candidates.find(
  (c) => c.factKey === "bathroom.width_m" || c.factKey === "bathroom.length_m"
);
check(
  "after length save, width is the remaining geometry question",
  nextAfterLength?.factKey === "bathroom.width_m"
);
check(
  "width identity is not the length identity",
  nextAfterLength != null &&
    openLength != null &&
    clarifyFieldIdentity(nextAfterLength) !== clarifyFieldIdentity(openLength)
);
check(
  "length is not re-asked after it is known",
  !bathAfterLength.clarify.candidates.some((c) => c.factKey === "bathroom.length_m")
);
const bathAfterBoth = composeWa("bathroom", "Bathroom", "b1", [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
]);
check(
  "after length+width, geometry HARD questions are gone",
  !bathAfterBoth.clarify.candidates.some(
    (c) => c.factKey === "bathroom.length_m" || c.factKey === "bathroom.width_m"
  ) && !bathAfterBoth.clarify.blocksEstimate
);

console.log("\n--- Vanity tiling assumption ---\n");
check(
  "vanity-only hides tiling question group",
  !bathroomQuestionGroupVisible("tiling", "vanity_only")
);
const vanity = composeWa("bathroom", "Bathroom", "b1", [
  fact("bathroom.job_scope", "b1", "vanity_only"),
]);
check(
  "Job Plan vanity has no tiling check",
  !vanity.plan.cards[0]!.notConfirmed.some(
    (item) => item.sourceFactKey === "bathroom.tiling_included"
  ) &&
    !vanity.plan.cards[0]!.included.some(
      (item) => item.sourceFactKey === "bathroom.tiling_included"
    )
);
check(
  "Clarify vanity does not ask tiling",
  !vanity.clarify.candidates.some((c) => c.factKey === "bathroom.tiling_included")
);
check(
  "Clarify vanity does not assume tiling",
  !tilingCopy(vanity.clarify.estimateNowAssumptions) &&
    !tilingCopy(vanity.clarify.assumptions)
);
const fullNoTile = composeWa("bathroom", "Bathroom", "b1", [
  fact("bathroom.job_scope", "b1", "full_renovation"),
]);
check(
  "mature full reno unanswered tiling is not an assumption",
  !tilingCopy(fullNoTile.clarify.estimateNowAssumptions) &&
    !tilingCopy(fullNoTile.clarify.assumptions)
);
const jobPlanSrc = read("lib/assistant/job-plan/adapters/bathroom.ts");
check(
  "Job Plan gates tiling on question-group visibility",
  jobPlanSrc.includes('bathroomQuestionGroupVisible("tiling", jobScope)')
);

console.log("\n--- Deck / Fence / Retaining numeric identities ---\n");
const deckOpen = composeWa("deck", "Deck", "d1", []);
const deckLength = deckOpen.clarify.candidates.find((c) => c.factKey === "deck.length_m");
const deckWidth = deckOpen.clarify.candidates.find((c) => c.factKey === "deck.width_m");
check("Deck still asks length", Boolean(deckLength));
check(
  "Deck length/width identities differ when both present",
  !deckWidth ||
    clarifyFieldIdentity(deckLength!) !== clarifyFieldIdentity(deckWidth)
);
const deckAfterLength = composeWa("deck", "Deck", "d1", [
  fact("deck.length_m", "d1", 6),
]);
const deckNext = deckAfterLength.clarify.candidates.find(
  (c) => c.factKey === "deck.width_m" || c.factKey === "deck.area_m2"
);
check(
  "Deck after length keeps a different remaining geometry identity",
  !deckNext ||
    (deckLength != null &&
      clarifyFieldIdentity(deckNext) !== clarifyFieldIdentity(deckLength))
);
check(
  "Deck still clarifies or is ready after one length",
  deckAfterLength.clarify.enoughToEstimate ||
    deckAfterLength.clarify.candidates.length > 0
);

const fenceOpen = composeWa("fence", "Fence", "f1", []);
const fenceLen = fenceOpen.clarify.candidates.find((c) => c.factKey === "fence.length_m");
const fenceHeight = fenceOpen.clarify.candidates.find(
  (c) => c.factKey === "fence.height_m"
);
check("Fence still asks length", Boolean(fenceLen));
check(
  "Fence length/height identities differ when both present",
  !fenceHeight ||
    clarifyFieldIdentity(fenceLen!) !== clarifyFieldIdentity(fenceHeight)
);

const rwOpen = composeWa("retaining_wall", "Retaining wall", "r1", []);
const rwLen = rwOpen.clarify.candidates.find(
  (c) => c.factKey === "retaining_wall.length_m"
);
const rwHeight = rwOpen.clarify.candidates.find(
  (c) => c.factKey === "retaining_wall.height_m"
);
check("Retaining still asks length", Boolean(rwLen));
check(
  "Retaining length/height identities differ when both present",
  !rwHeight ||
    clarifyFieldIdentity(rwLen!) !== clarifyFieldIdentity(rwHeight)
);

console.log("\n--- Policy ---\n");
const migrations = existsSync(join(process.cwd(), "supabase/migrations"))
  ? readdirSync(join(process.cwd(), "supabase/migrations"))
      .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
      .sort()
  : [];
check(
  "no migration 055",
  migrations.every((name) => !name.startsWith("055_")) &&
    migrations.some((name) => name.startsWith("054_"))
);
check(
  "wall-height / gross-wall persistence not redesigned here",
  !read("lib/estimate/bathroom-geometry.ts").includes("02C") &&
    !valueField.includes("wall_height")
);

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
