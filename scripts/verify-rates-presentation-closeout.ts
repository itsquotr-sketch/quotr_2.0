/**
 * Rates presentation closeout — stale catalogue copy vs resolver status.
 *
 * Run: npx --yes tsx scripts/verify-rates-presentation-closeout.ts
 *
 * Does not change approved money. Does not rewrite company rates.
 */
import { dnaRatesBenchmarkCopy } from "../lib/company-dna/copy";
import { getCompanyDnaFoundationTask } from "../lib/company-dna/v2-foundation";
import { DECK_CONCRETE_PLACE_HOURS_PER_BAG } from "../lib/estimate/deck-scope-2c";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { classifyMaterialPresentation } from "../lib/rates/material-presentation-map";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean) {
  if (ok) {
    passed += 1;
    console.log(`ok  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

const paint = getCatalogueEntry("painting.wall.m2");
const paintCopy = paint ? classifyMaterialPresentation(paint).familyDescription ?? "" : "";
check("wall paint catalogue cost stays $4.93/m²", paint?.defaultCostRate === 4.93);
check(
  "wall paint family copy follows the approved benchmark",
  paintCopy.includes("$4.93/m²") &&
    !paintCopy.includes("Pricing Required until a company rate exists")
);

const acoustic = getCatalogueEntry("insulation.wall.acoustic.m2");
const acousticCopy = acoustic
  ? classifyMaterialPresentation(acoustic).familyDescription ?? ""
  : "";
check("acoustic insulation cost stays $13.51/m²", acoustic?.defaultCostRate === 13.51);
check(
  "acoustic family copy names the approved cost and keeps fire-acoustic unpriced",
  acousticCopy.includes("$13.51/m²") &&
    acousticCopy.includes("Fire-and-acoustic") &&
    acousticCopy.includes("Pricing Required until a company rate exists")
);

const level5 = getCatalogueEntry("stopping.plasterboard.level5.m2");
const level5Copy = level5
  ? classifyMaterialPresentation(level5).familyDescription ?? ""
  : "";
check(
  "level 5 stopping stays Pricing Required",
  level5?.defaultCostRate == null &&
    level5Copy.includes("Pricing Required until a company rate exists")
);

const concrete = getCatalogueEntry("deck.post_hole_concrete.place.hours_per_bag");
check(
  "deck concrete catalogue copy matches the approved bag rate",
  concrete?.defaultCostRate === DECK_CONCRETE_PLACE_HOURS_PER_BAG &&
    (concrete.description ?? "").includes("0.06666666666666667") &&
    !(concrete.description ?? "").includes("starter 0.16")
);

const posts = getCatalogueEntry("deck.posts.install.hours_per_ea");
check(
  "pile description does not claim hole excavation is included",
  posts?.defaultCostRate === 1 &&
    (posts.description ?? "").includes("separate Pricing Required line") &&
    !(posts.description ?? "").includes("Includes normal set-out, hole excavation")
);

const deckingTask = getCompanyDnaFoundationTask("deck.decking.v1");
const deckingCopy = deckingTask ? dnaRatesBenchmarkCopy(deckingTask) : null;
check(
  "decking task display keeps 0.077 as comparison only",
  deckingTask?.benchmarkProductivity === 0.077 &&
    deckingCopy?.value.includes("35 minutes/m²") === true &&
    (deckingCopy?.note ?? "").includes("company calibration saved on deck.decking.install.hours_per_lm")
);

const concreteTask = getCompanyDnaFoundationTask("deck.concrete.v1");
check(
  "deck concrete task benchmark is the approved rate",
  concreteTask?.benchmarkProductivity === DECK_CONCRETE_PLACE_HOURS_PER_BAG
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
