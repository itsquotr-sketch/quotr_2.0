/**
 * Focused extraction cases for the complete-assembly proof.
 *
 * Run: npx tsx scripts/verify-complete-assembly-extraction.ts
 */
import { extractConstraintsFromBrief } from "../lib/ai/enrich-extraction";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import {
  applyFlooringFactWrite,
  FLOORING_PORTIONS_FACT_KEY,
  resolveFlooringPortions,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import type { EstimateFact } from "../lib/estimate/types";

const failures: string[] = [];

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`ok ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}`, detail ?? "");
}

function portions(brief: string): FlooringPortion[] {
  return extractFlooringPortionsFromBrief(brief);
}

function carry(brief: string): string | undefined {
  return extractConstraintsFromBrief(brief).find(
    (row) => row.key === "material_carry_distance"
  )?.value as string | undefined;
}

function underlayOf(brief: string): Array<boolean | null> {
  return portions(brief).map((row) => row.underlay_required);
}

function transitionsOf(brief: string): Array<boolean | null | undefined> {
  return portions(brief).map((row) => row.transitions_required ?? null);
}

check(
  "underlay required — proof sentence",
  underlayOf(
    "Supply and install laminate in one meeting room. Underlay is required."
  ).every((row) => row === true)
);
check(
  "underlay required — paraphrase needs underlay",
  underlayOf("Living room laminate, 20 m², needs underlay.").every(
    (row) => row === true
  )
);
check(
  "underlay required — paraphrase include underlay",
  underlayOf("Install carpet and include underlay in the lounge.").every(
    (row) => row === true
  )
);
check(
  "underlay excluded — no underlay",
  underlayOf("Straight-lay carpet tiles. No underlay. Ready substrate.").every(
    (row) => row === false
  )
);
check(
  "underlay excluded — underlay is not required",
  underlayOf(
    "Carpet tiles in the office. Underlay is not required. Adhesive fixing."
  ).every((row) => row === false)
);
check(
  "underlay excluded — excluding underlay",
  underlayOf("Hallway vinyl planks, excluding underlay.").every(
    (row) => row === false
  )
);
check(
  "transition strips requested — include transition strips",
  transitionsOf(
    "Bedroom 1 is 3.6m × 3.2m and gets carpet. Include underlay where appropriate, transition strips and 10% waste."
  ).every((row) => row === true)
);
check(
  "transition strips requested — paraphrase add transitions",
  transitionsOf("Office laminate. Add transition strips at the doorway.").every(
    (row) => row === true
  )
);
check(
  "transition strips excluded — no transition strips",
  transitionsOf(
    "Supply and install floating click-lock laminate. No transition strips."
  ).every((row) => row === false)
);
check(
  "transition strips excluded — without transitions",
  transitionsOf("Kitchen vinyl. Lay without transitions.").every(
    (row) => row === false
  )
);
check(
  "carry under 10 m — proof sentence",
  carry(
    "Easy access, materials carried under 10 m, the site is not occupied."
  ) === "< 10m"
);
check(
  "carry under 10 m — paraphrase short carry",
  carry("Materials have an under 10 m carry from the drop-off.") === "< 10m"
);
check(
  "carry 10–30 m — carried 25 m",
  carry("Materials are carried 25 m from the drop-off.") === "10–30m"
);
check(
  "carry 10–30 m — 10-30 m carry band",
  carry("Allow a 10–30 m carry for materials.") === "10–30m"
);

const mixed = portions(
  "Bedroom 1 is 3.6m × 3.2m and gets carpet with underlay. Hallway is 4.0m × 1.2m laminate, no transition strips."
);
const bedroom = mixed.find((row) => /bedroom/i.test(row.label ?? ""));
const hallway = mixed.find((row) => /hallway/i.test(row.label ?? ""));
check(
  "mixed-room wording keeps underlay on the carpet portion",
  mixed.length >= 2 &&
    bedroom?.underlay_required === true &&
    hallway?.underlay_required !== true,
  mixed.map((row) => [row.label, row.finish_type, row.specialist_kind, row.underlay_required, row.transitions_required])
);
check(
  "mixed-room wording keeps the excluded transition on the laminate portion",
  hallway?.transitions_required === false &&
    bedroom?.transitions_required !== true,
  mixed.map((row) => [row.label, row.transitions_required])
);

const mixedConflict = portions(
  "Bedroom 1 is 3.6m × 3.2m and gets carpet with underlay and transition strips. Hallway is 4.0m × 1.2m laminate, no transition strips."
);
const conflictBedroom = mixedConflict.find((row) =>
  /bedroom/i.test(row.label ?? "")
);
const conflictHallway = mixedConflict.find((row) =>
  /hallway/i.test(row.label ?? "")
);
check(
  "mixed positive and negative transitions stay on their own portions",
  conflictBedroom?.transitions_required === true &&
    conflictHallway?.transitions_required === false,
  mixedConflict.map((row) => [row.label, row.transitions_required])
);

const extracted = portions(
  "Office carpet tiles. Underlay is required. Include transition strips."
)[0];
let facts = [
  {
    id: "fact-1",
    project_id: "project",
    work_area_id: "flooring",
    key: FLOORING_PORTIONS_FACT_KEY,
    value: [extracted],
    source: "extracted",
  },
] as EstimateFact[];
facts = applyFlooringFactWrite({
  facts,
  workAreaId: "flooring",
  key: "flooring.portion.underlay_required",
  value: false,
  nestedItemId: extracted?.id,
});
const confirmed = resolveFlooringPortions({
  facts,
  workAreaId: "flooring",
}).portions[0];
const incoming = portions(
  "Office carpet tiles. Underlay is required. Include transition strips."
);
facts = applyFlooringFactWrite({
  facts,
  workAreaId: "flooring",
  key: FLOORING_PORTIONS_FACT_KEY,
  value: incoming,
  factSource: "ai_extracted",
});
const afterReanalyse = resolveFlooringPortions({
  facts,
  workAreaId: "flooring",
}).portions[0];
check(
  "re-extraction does not overwrite a confirmed underlay answer",
  confirmed?.underlay_required === false &&
    confirmed.underlay_authority === "user" &&
    afterReanalyse?.underlay_required === false &&
    afterReanalyse.underlay_authority === "user",
  afterReanalyse
);

if (failures.length > 0) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log("\nComplete-assembly extraction checks passed");
