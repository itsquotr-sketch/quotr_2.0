/**
 * DOORS-06-R1 — nested Doors Quote location grammar.
 *
 * Run: npx --yes tsx scripts/verify-doors-06-r1-quote-location.ts
 *
 * No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOORS_QUOTE_CUSTOM_INSTALL_INCLUDED,
  DOORS_QUOTE_CUSTOM_SUPPLY_EXCLUDED,
  DOORS_QUOTE_SPECIALIST_PENDING,
} from "../lib/estimate/doors-quote";
import { DOORS_PORTIONS_FACT_KEY, type DoorPortion } from "../lib/estimate/doors-portions";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";

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

function countPhrase(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  while (from <= lowerHay.length - lowerNeedle.length) {
    const at = lowerHay.indexOf(lowerNeedle, from);
    if (at < 0) break;
    count += 1;
    from = at + lowerNeedle.length;
  }
  return count;
}

function ordinary(patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    id: patch.id ?? "door-set-ordinary-1",
    label: patch.label ?? null,
    installation_type: "prehung_internal",
    leaf_construction: "hollow_core",
    height_mm: 1980,
    width_mm: 810,
    quantity: 1,
    hardware_included: true,
    other_description: null,
    height_authority: "extracted",
    specialist_kind: null,
    ...patch,
  };
}

function quoteFacts(portions: readonly DoorPortion[]) {
  return [
    {
      key: DOORS_PORTIONS_FACT_KEY,
      label: "Door sets",
      value: JSON.stringify(portions),
    },
  ];
}

function doorsQuote(portions: readonly DoorPortion[]) {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "doors",
    name: "Doors",
    facts: quoteFacts(portions),
  });
}

const labelledPrehung = doorsQuote([
  ordinary({
    id: "fixture-f",
    label: "Bedroom doors",
    quantity: 2,
    hardware_included: true,
  }),
]);
const labelledReplacement = doorsQuote([
  ordinary({
    id: "ensuite-leaf",
    label: "Ensuite door",
    installation_type: "replacement_leaf",
    leaf_construction: "solid_core",
    height_mm: 2200,
    width_mm: 910,
    quantity: 1,
    hardware_included: false,
  }),
]);
const unlabelled = doorsQuote([ordinary({ id: "no-loc", label: null, quantity: 1 })]);
const customQuote = doorsQuote([
  ordinary({
    id: "custom-1",
    leaf_construction: "other",
    other_description: "cedar veneer",
    hardware_included: true,
  }),
]);
const specialistQuote = doorsQuote([
  {
    id: "door-set-specialist-1",
    label: "Plant room",
    installation_type: "other_unsupported",
    leaf_construction: null,
    height_mm: null,
    width_mm: null,
    quantity: 1,
    hardware_included: null,
    other_description: "fire-rated acoustic access-control door",
    specialist_kind: "fire_rated",
  },
]);
const legacyCopy = buildWorkAreaQuoteDescriptionDraft({
  type: "doors",
  name: "Doors",
  facts: [
    { key: "doors.count", label: "Door count", value: "3" },
    { key: "doors.door_type", label: "Door type", value: "Hollow core" },
  ],
});

const INTERNAL_LEAKS = [
  /\bpricing required\b/i,
  /UNSUPPORTED_SPECIALIST/,
  /prehung_internal/,
  /replacement_leaf/,
  /other_unsupported/,
  /fire_rated/,
  /\$\s*[\d,]/,
  /\bbenchmark\b/i,
  /person-hours?/i,
];

console.log("=== DOORS-06-R1 location grammar ===\n");

check(
  "1. labelled prehung copy contains the label exactly once",
  labelledPrehung.startsWith("Bedroom doors:") &&
    countPhrase(labelledPrehung, "Bedroom doors") === 1 &&
    /Supply and install 2 × 1980 × 810 mm hollow-core prehung internal door sets, including standard timber jambs, stops and hinges/.test(
      labelledPrehung
    )
);
check(
  "2. labelled replacement copy contains the label exactly once",
  labelledReplacement.startsWith("Ensuite door:") &&
    countPhrase(labelledReplacement, "Ensuite door") === 1 &&
    /Supply and fit 1 × 2200 × 910 mm solid-core replacement internal door leaf to the existing retained frame\/jamb/.test(
      labelledReplacement
    )
);
check(
  "3. no `to the ensuite to the existing` construction",
  !/to the ensuite to the existing/i.test(labelledReplacement) &&
    !/to the \w+ to the existing/i.test(labelledReplacement)
);
check(
  "4. no duplicated location phrase",
  !/to the bedrooms/i.test(labelledPrehung) &&
    !/to the ensuite/i.test(labelledReplacement) &&
    countPhrase(labelledPrehung, "bedroom") === 1 &&
    countPhrase(labelledReplacement, "ensuite") === 1
);
check(
  "5. unlabelled copy remains grammatically correct",
  /Supply and install 1 × 1980 × 810 mm hollow-core prehung internal door set, including a standard timber jamb, stops and hinges/.test(
    unlabelled
  ) && !unlabelled.startsWith(":") && !/to the /.test(unlabelled.split(".")[0] ?? "")
);
check(
  "6. singular grammar remains correct",
  /prehung internal door set, including a standard timber jamb/.test(unlabelled) &&
    !/1 ×[\s\S]*door sets/.test(unlabelled)
);
check(
  "7. plural grammar remains correct",
  /prehung internal door sets, including standard timber jambs/.test(labelledPrehung)
);
check(
  "8. hardware wording remains unchanged",
  /Includes a standard latch\/lever hardware allowance and installation for each door/.test(
    labelledPrehung
  ) && /Existing door hardware will be reused/.test(labelledReplacement)
);
check(
  "9. custom-material wording remains safe",
  customQuote.includes(DOORS_QUOTE_CUSTOM_INSTALL_INCLUDED) &&
    customQuote.includes(DOORS_QUOTE_CUSTOM_SUPPLY_EXCLUDED) &&
    !/supply of the custom door leaf is included/i.test(customQuote)
);
check(
  "10. specialist wording remains safe",
  specialistQuote.includes(DOORS_QUOTE_SPECIALIST_PENDING) &&
    specialistQuote.startsWith("Plant room:") &&
    !/to the plant room/i.test(specialistQuote) &&
    !/supply and install[\s\S]*specialist/i.test(specialistQuote)
);
check(
  "11. no internal commercial details leak",
  ![labelledPrehung, labelledReplacement, unlabelled, customQuote, specialistQuote].some(
    (text) => INTERNAL_LEAKS.some((pattern) => pattern.test(text))
  )
);
check(
  "12. legacy flat Doors copy remains unchanged",
  /internal door\(s\)/.test(legacyCopy) &&
    /frames, hardware and associated finishing/.test(legacyCopy) &&
    read("lib/work-areas/quote-description.ts").includes(
      "function buildDoorsDraft"
    ) &&
    read("lib/estimate/doors-quote.ts").includes("hasNestedDoorsPortionsFact")
);

if (failed > 0) {
  console.log(`\nDOORS-06-R1 FAILED: ${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`\nDOORS-06-R1 PASSED: ${passed} passed, ${failed} failed`);
