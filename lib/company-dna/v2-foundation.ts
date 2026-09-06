/**
 * DNA-V2B — task-level foundation catalogue.
 *
 * V1 `COMPANY_DNA_TASKS` is unchanged and remains the live hub / Rates list.
 * These rows are the non-UI coverage expansion for existing estimator keys.
 * They must not appear in V1 DNA UX or compact Rates DNA summaries.
 *
 * Hosted RPC save still requires a DB catalogue row (FK). V2B does not add
 * migration 054. New keys are code-side until a data seed is approved.
 */
import {
  COMPANY_DNA_TASKS,
  getCompanyDnaTask,
  type CompanyDnaTaskDefinition,
  type CompanyDnaWorkAreaType,
} from "@/lib/company-dna/catalogue";
import { companyDnaWorkAreaStatusV2 } from "@/lib/company-dna/derive";
import { DECK_CONCRETE_PRODUCTIVITY_KEY } from "@/lib/estimate/deck-scope-2c";
import {
  DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY,
  DECK_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
} from "@/lib/estimate/deck-productivity";
import { FENCE_PRODUCTIVITY_KEYS } from "@/lib/estimate/fence-productivity";
import {
  RW_EXCAVATION_MACHINE_HOURS_KEY,
  RW_EXCAVATION_MANUAL_HOURS_KEY,
} from "@/lib/estimate/retaining-wall-family-coverage";
import { RW_PRODUCTIVITY_KEYS } from "@/lib/estimate/retaining-wall-productivity";

export type CompanyDnaPriorityTier = 1 | 2 | 3;

export type CompanyDnaFoundationTask = CompanyDnaTaskDefinition & {
  priorityTier: CompanyDnaPriorityTier;
  workIncluded: string;
  workExcluded: string;
  normalAssumptions: string;
  exposeInCurrentUi: boolean;
  catalogueGeneration: "v1" | "v2b";
  /** Honest method this calibration represents. Null = not method-split. */
  baselineMethod: "machine-assisted" | "manual" | "hand-holes" | null;
};

const NORMAL_ACCESS =
  "Normal residential access · materials close to the workface · competent crew · normal tools · no unusual weather or after-hours limits";

function v2Task(
  task: Omit<
    CompanyDnaFoundationTask,
    "whyItMatters" | "exposeInCurrentUi" | "catalogueGeneration" | "isHighImpact"
  > & {
    whyItMatters?: string;
  }
): CompanyDnaFoundationTask {
  return {
    ...task,
    whyItMatters:
      task.whyItMatters ??
      "Quotr uses this to estimate how many labour hours your crew needs for this task.",
    exposeInCurrentUi: false,
    catalogueGeneration: "v2b",
    isHighImpact: task.priorityTier === 1,
  };
}

const V1_BOUNDARIES: Record<
  string,
  Pick<
    CompanyDnaFoundationTask,
    "workIncluded" | "workExcluded" | "normalAssumptions" | "priorityTier" | "baselineMethod"
  >
> = {
  "deck.framing.v1": {
    priorityTier: 1,
    baselineMethod: null,
    workIncluded:
      "Cut, set and fix bearers, joists and rim; ordinary handling at the workface",
    workExcluded:
      "Pile/post install, hole digging, concrete, decking, fascia, off-workface carting",
    normalAssumptions: `${NORMAL_ACCESS} · ground-level / low deck · posts already in`,
  },
  "deck.decking.v1": {
    priorityTier: 1,
    baselineMethod: null,
    workIncluded:
      "Measure, cut, lay and fix decking boards; ordinary handling at the workface",
    workExcluded:
      "Framing, posts, fascia, steps, demolition, waste as labour (waste is procurement)",
    normalAssumptions: `${NORMAL_ACCESS} · framing already in · standard boards`,
  },
  "deck.posts.v1": {
    priorityTier: 1,
    baselineMethod: "hand-holes",
    workIncluded:
      "Set-out, hole excavation, hole prep, position, cut/set, plumb, ordinary workface handling",
    workExcluded: "Concrete mix/place, framing, decking, spoil export off site",
    normalAssumptions: `${NORMAL_ACCESS} · ground-level · normal soil · not pouring concrete`,
  },
  "deck.demolition.v1": {
    priorityTier: 2,
    baselineMethod: null,
    workIncluded: "Strip an existing timber deck; ordinary handling at the workface",
    workExcluded:
      "New construction; skip-bin cartage as a separate labour task; substructure replacement allowances",
    normalAssumptions: `${NORMAL_ACCESS} · strip the deck — not necessarily loading a bin off site`,
  },
  "fence.posts.v1": {
    priorityTier: 1,
    baselineMethod: "hand-holes",
    workIncluded:
      "Set-out, ordinary hand hole, normal-soil handling, set/plumb/brace",
    workExcluded: "Concrete, rails, palings, demolition, off-site spoil",
    normalAssumptions: `${NORMAL_ACCESS} · 1.8 m paling · straight run · normal soil · not pouring concrete`,
  },
  "fence.boards.v1": {
    priorityTier: 1,
    baselineMethod: null,
    workIncluded: "Cut, hang and fix vertical palings; ordinary handling",
    workExcluded: "Posts, rails, capping, horizontal slats",
    normalAssumptions: `${NORMAL_ACCESS} · posts and rails already in`,
  },
  "fence.rails.v1": {
    priorityTier: 1,
    baselineMethod: null,
    workIncluded: "Cut and fix rails; ordinary handling",
    workExcluded: "Posts, palings, capping",
    normalAssumptions: `${NORMAL_ACCESS} · posts already in · 3 rails`,
  },
  "retaining_wall.piles.v1": {
    priorityTier: 1,
    baselineMethod: "machine-assisted",
    workIncluded:
      "Set-out, attend machine-dug hole, place, align, plumb, ordinary handling",
    workExcluded:
      "Bulk excavation, concrete, spoil export, mini-excavator hire, fully manual digging",
    normalAssumptions: `${NORMAL_ACCESS} · digger can reach the workface · your attendance, not the hire clock`,
  },
  "retaining_wall.face.v1": {
    priorityTier: 1,
    baselineMethod: null,
    workIncluded: "Cut, place, level and fix face boards; ordinary handling",
    workExcluded: "Piles, drainage, bulk excavation, cartage",
    normalAssumptions: `${NORMAL_ACCESS} · piles already in`,
  },
};

export const COMPANY_DNA_V1_FOUNDATION_TASKS: readonly CompanyDnaFoundationTask[] =
  COMPANY_DNA_TASKS.map((task) => {
    const extra = V1_BOUNDARIES[task.calibrationTaskKey];
    if (!extra) {
      throw new Error(`DNA-V2B missing V1 boundary for ${task.calibrationTaskKey}`);
    }
    return {
      ...task,
      ...extra,
      exposeInCurrentUi: true,
      catalogueGeneration: "v1" as const,
    };
  });

/**
 * New honest catalogue rows. Estimator already consumes each productivity key.
 * Deck steps are deferred (h/m² tread is too misleading for builder calibration).
 */
export const COMPANY_DNA_V2B_NEW_TASKS: readonly CompanyDnaFoundationTask[] = [
  v2Task({
    calibrationTaskKey: "deck.fascia.v1",
    scenarioVersion: "1",
    workAreaType: "deck",
    productivityRateKey: DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY,
    label: "Fascia / edge boards",
    prompt:
      "How would your crew normally fix about 18 lm of fascia / edge boards on a normal deck?",
    scenarioSummary:
      "18 lm fascia · one course · ground-level / low · normal access · framing already in",
    referenceQuantity: 18,
    referenceUnit: "lm",
    authorityQuantity: 18,
    authorityUnit: "lm",
    benchmarkProductivity: 0.45,
    rateLabel: "Fascia installation (hours/lm)",
    sortOrder: 50,
    priorityTier: 2,
    baselineMethod: null,
    workIncluded:
      "Cut, fit and fix fascia / edge boards; ordinary handling at the workface",
    workExcluded:
      "Full-height skirting, decking, framing, posts, abnormal carry, off-site carting",
    normalAssumptions: `${NORMAL_ACCESS} · exposed perimeter, not height-driven screening`,
  }),
  v2Task({
    calibrationTaskKey: "deck.skirting.v1",
    scenarioVersion: "1",
    workAreaType: "deck",
    productivityRateKey: DECK_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
    label: "Full-height deck skirting",
    prompt:
      "How would your crew normally fit about 18 lm of full-height deck skirting / screening?",
    scenarioSummary:
      "18 lm full-height skirting · explicit screening scope · normal access",
    referenceQuantity: 18,
    referenceUnit: "lm",
    authorityQuantity: 18,
    authorityUnit: "lm",
    benchmarkProductivity: 0.45,
    rateLabel: "Full-height deck skirting / screening (labour-h / lm)",
    sortOrder: 60,
    priorityTier: 3,
    baselineMethod: null,
    workIncluded:
      "Cut, fit and fix full-height skirting / screening; ordinary handling",
    workExcluded: "Fascia / edge boards, decking, framing, inferred-from-elevation scope",
    normalAssumptions: `${NORMAL_ACCESS} · explicit skirting scope — not inferred from elevation`,
  }),
  v2Task({
    calibrationTaskKey: "deck.concrete.v1",
    scenarioVersion: "1",
    workAreaType: "deck",
    productivityRateKey: DECK_CONCRETE_PRODUCTIVITY_KEY,
    label: "Deck post-hole concrete",
    prompt:
      "How would your crew normally mix and pour 20 bags of post-hole concrete (posts already set)?",
    scenarioSummary:
      "20 × 20 kg bags · posts already set · mix and place at the workface · normal access",
    referenceQuantity: 20,
    referenceUnit: "bag",
    authorityQuantity: 20,
    authorityUnit: "bag",
    benchmarkProductivity: 0.16,
    rateLabel: "Deck post-hole concrete placement (labour-h/bag)",
    sortOrder: 70,
    priorityTier: 2,
    baselineMethod: null,
    workIncluded:
      "Bag handling at the workface, mixing, placing, basic finishing",
    workExcluded: "Hole excavation, post setting, off-site carting",
    normalAssumptions: `${NORMAL_ACCESS} · posts already set`,
  }),
  v2Task({
    calibrationTaskKey: "fence.boards.horizontal.v1",
    scenarioVersion: "1",
    workAreaType: "fence",
    productivityRateKey: FENCE_PRODUCTIVITY_KEYS.horizontalSlatsLm,
    label: "Horizontal fence slats",
    prompt:
      "How would your crew normally hang horizontal slats on 18 lm of 1.8 m timber fence (posts already in)?",
    scenarioSummary:
      "18 lm · 1.8 m · ~11 courses · 198 slat-lm · 150 mm boards · 10 mm gaps · normal access",
    referenceQuantity: 18,
    referenceUnit: "lm",
    authorityQuantity: 198,
    authorityUnit: "lm",
    benchmarkProductivity: 0.06,
    rateLabel: "Horizontal slat installation (labour-h/slat-lm)",
    sortOrder: 40,
    priorityTier: 2,
    baselineMethod: null,
    workIncluded: "Cut, hang and fix horizontal slats; ordinary handling",
    workExcluded: "Vertical palings, posts, rails, capping",
    normalAssumptions: `${NORMAL_ACCESS} · posts already in · not a vertical paling fence`,
  }),
  v2Task({
    calibrationTaskKey: "fence.capping.v1",
    scenarioVersion: "1",
    workAreaType: "fence",
    productivityRateKey: FENCE_PRODUCTIVITY_KEYS.cappingLm,
    label: "Fence capping",
    prompt: "How would your crew normally fit 18 lm of fence capping?",
    scenarioSummary: "18 lm capping · 1.8 m paling · posts and palings already in · normal access",
    referenceQuantity: 18,
    referenceUnit: "lm",
    authorityQuantity: 18,
    authorityUnit: "lm",
    benchmarkProductivity: 0.08,
    rateLabel: "Fence capping installation (labour-h/lm)",
    sortOrder: 50,
    priorityTier: 3,
    baselineMethod: null,
    workIncluded: "Cut and fix capping; ordinary handling",
    workExcluded: "Posts, rails, palings, gates",
    normalAssumptions: `${NORMAL_ACCESS} · palings already hung`,
  }),
  v2Task({
    calibrationTaskKey: "fence.gate.v1",
    scenarioVersion: "1",
    workAreaType: "fence",
    productivityRateKey: FENCE_PRODUCTIVITY_KEYS.gateInstall,
    label: "Timber gate",
    prompt:
      "How would your crew normally build and hang one timber fence gate (frame, hinges and latch)?",
    scenarioSummary:
      "1 timber gate · frame assembly, hang, hinges/latch · normal access · palings stay on paling labour",
    referenceQuantity: 1,
    referenceUnit: "gate",
    authorityQuantity: 1,
    authorityUnit: "gate",
    benchmarkProductivity: 2,
    rateLabel: "Timber gate fabrication & installation (labour-h/gate)",
    sortOrder: 60,
    priorityTier: 3,
    baselineMethod: null,
    workIncluded: "Frame assembly, hanging, hinges/latch, alignment",
    workExcluded: "Face palings/slats (stay on board labour), package gate allowance",
    normalAssumptions: `${NORMAL_ACCESS} · posts already in`,
  }),
  v2Task({
    calibrationTaskKey: "fence.concrete.v1",
    scenarioVersion: "1",
    workAreaType: "fence",
    productivityRateKey: FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag,
    label: "Fence post-hole concrete",
    prompt:
      "How would your crew normally mix and pour 20 bags of fence post-hole concrete (posts already set)?",
    scenarioSummary:
      "20 × 20 kg bags · posts already set · mix and place at the workface · normal access",
    referenceQuantity: 20,
    referenceUnit: "bag",
    authorityQuantity: 20,
    authorityUnit: "bag",
    benchmarkProductivity: 0.06,
    rateLabel: "Fence post-hole concrete placement (labour-h/bag)",
    sortOrder: 70,
    priorityTier: 2,
    baselineMethod: null,
    workIncluded:
      "Bag handling at the workface, mixing and placing",
    workExcluded: "Hole digging, post setting, off-site carting",
    normalAssumptions: `${NORMAL_ACCESS} · posts already set`,
  }),
  v2Task({
    calibrationTaskKey: "fence.section.v1",
    scenarioVersion: "1",
    workAreaType: "fence",
    productivityRateKey: FENCE_PRODUCTIVITY_KEYS.sectionInstall,
    label: "Modular fence sections",
    prompt:
      "How would your crew normally hang 8 modular fence sections (posts already in)?",
    scenarioSummary:
      "8 installed sections · manufactured bays · posts already in · normal access",
    referenceQuantity: 8,
    referenceUnit: "section",
    authorityQuantity: 8,
    authorityUnit: "section",
    benchmarkProductivity: 0.35,
    rateLabel: "Modular fence section installation (labour-h/section)",
    sortOrder: 80,
    priorityTier: 2,
    baselineMethod: null,
    workIncluded:
      "Hang/fix manufactured sections including ordinary residual cut; ordinary handling",
    workExcluded: "Timber palings, timber rails, post-hole digging",
    normalAssumptions: `${NORMAL_ACCESS} · posts already in`,
  }),
  v2Task({
    calibrationTaskKey: "fence.demolition.v1",
    scenarioVersion: "1",
    workAreaType: "fence",
    productivityRateKey: "fence.demolition_hours_per_lm",
    label: "Existing fence removal",
    prompt:
      "How would your crew normally take down 18 lm of existing timber fence (strip the fence — not loading a bin off site)?",
    scenarioSummary:
      "18 lm strip-out · normal access · demolition labour only · disposal / cartage is separate money",
    referenceQuantity: 18,
    referenceUnit: "lm",
    authorityQuantity: 18,
    authorityUnit: "lm",
    benchmarkProductivity: 0.25,
    rateLabel: "Fence removal labour",
    sortOrder: 90,
    priorityTier: 3,
    baselineMethod: null,
    workIncluded: "Take down existing fence; ordinary handling at the workface",
    workExcluded:
      "Skip-bin / trailer cartage as labour; disposal $ allowance; new fence construction",
    normalAssumptions: `${NORMAL_ACCESS} · strip the run, not off-site dumping`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.excavation.machine.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_EXCAVATION_MACHINE_HOURS_KEY,
    label: "Machine excavation",
    prompt:
      "How would your crew normally excavate 4 m³ for a retaining wall with a mini-digger on a normal accessible site (your labour — not the hire clock)?",
    scenarioSummary:
      "4 m³ measured bulk cut · machine-assisted · digger can reach · crew attendance · normal soil",
    referenceQuantity: 4,
    referenceUnit: "m3",
    authorityQuantity: 4,
    authorityUnit: "m3",
    benchmarkProductivity: 0.45,
    rateLabel: "Retaining wall excavation — machine-assisted (labour-h/m³)",
    sortOrder: 30,
    priorityTier: 1,
    baselineMethod: "machine-assisted",
    workIncluded: "Crew attendance on machine bulk cut when volume is measured",
    workExcluded:
      "Pile/post holes, spoil export, mini-excavator hire, hand digging",
    normalAssumptions: `${NORMAL_ACCESS} · digger can reach · normal soil · not rock`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.excavation.manual.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_EXCAVATION_MANUAL_HOURS_KEY,
    label: "Manual excavation",
    prompt:
      "How would your crew normally hand-dig 4 m³ for a retaining wall when a digger cannot reach the workface?",
    scenarioSummary:
      "4 m³ measured bulk cut · no digger access · hand digging / barrow · normal soil",
    referenceQuantity: 4,
    referenceUnit: "m3",
    authorityQuantity: 4,
    authorityUnit: "m3",
    benchmarkProductivity: 1.6,
    rateLabel: "Retaining wall excavation — manual (labour-h/m³)",
    sortOrder: 40,
    priorityTier: 2,
    baselineMethod: "manual",
    workIncluded: "Manual bulk excavation when volume is measured",
    workExcluded: "Machine plant, pile/post holes, spoil export $",
    normalAssumptions: "No digger access · normal soil · not rock · materials still reasonably close",
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.drainage.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.drainageLm,
    label: "Drainage coil",
    prompt:
      "How would your crew normally lay 10 lm of drainage coil behind a retaining wall (piles already in)?",
    scenarioSummary:
      "10 lm novacoil · piles/posts in · ordinary joining and positioning · normal access",
    referenceQuantity: 10,
    referenceUnit: "lm",
    authorityQuantity: 10,
    authorityUnit: "lm",
    benchmarkProductivity: 0.15,
    rateLabel: "Drainage installation (hours/lm)",
    sortOrder: 50,
    priorityTier: 2,
    baselineMethod: null,
    workIncluded: "Lay novacoil, normal joining, positioning along the heel",
    workExcluded: "Drainage aggregate / backfill, bulk excavation, plant",
    normalAssumptions: `${NORMAL_ACCESS} · piles already in`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.backfill.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.backfillM3,
    label: "Drainage backfill",
    prompt:
      "How would your crew normally place 2 m³ of drainage metal behind a retaining wall?",
    scenarioSummary:
      "2 m³ drainage aggregate in place · shovel/barrow · no plate-compactor day · normal access",
    referenceQuantity: 2,
    referenceUnit: "m3",
    authorityQuantity: 2,
    authorityUnit: "m3",
    benchmarkProductivity: 0.55,
    rateLabel: "Retaining wall backfill (hours/m³)",
    sortOrder: 60,
    priorityTier: 2,
    baselineMethod: null,
    workIncluded:
      "Place, spread, and basic-consolidate drainage aggregate",
    workExcluded: "Novacoil laying, bulk excavation, mechanical plate-compactor hire",
    normalAssumptions: `${NORMAL_ACCESS} · drainage metal, not structural compacted fill`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.concrete.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.postHoleConcreteBag,
    label: "Retaining post-hole concrete",
    prompt:
      "How would your crew normally mix and pour 20 bags of retaining-wall post-hole concrete (piles already set)?",
    scenarioSummary:
      "20 × 20 kg bags · piles/posts already set · mix and place · normal access",
    referenceQuantity: 20,
    referenceUnit: "bag",
    authorityQuantity: 20,
    authorityUnit: "bag",
    benchmarkProductivity: 0.035,
    rateLabel: "Retaining wall — post-hole bagged concrete placement",
    sortOrder: 70,
    priorityTier: 3,
    baselineMethod: null,
    workIncluded: "Mix, place and consolidate bagged premix into post holes",
    workExcluded: "Hole digging, pile/post setting, plant, bulk excavation",
    normalAssumptions: `${NORMAL_ACCESS} · piles already set`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.sleeper.posts.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.sleeperPostsEa,
    label: "Steel sleeper posts",
    prompt:
      "How would your crew normally set 8 steel sleeper posts on a normal accessible site (digger on site — your attendance, not the hire clock)?",
    scenarioSummary:
      "8 H-section posts · machine-assisted holes · normal access · not pouring concrete",
    referenceQuantity: 8,
    referenceUnit: "ea",
    authorityQuantity: 8,
    authorityUnit: "ea",
    benchmarkProductivity: 0.95,
    rateLabel: "Steel post installation (hours/ea)",
    sortOrder: 80,
    priorityTier: 1,
    baselineMethod: "machine-assisted",
    workIncluded:
      "Set-out, attend machine hole, place H-section post, align, plumb, brace",
    workExcluded:
      "Bulk excavation, sleeper install, concrete placement, spoil export, mini-excavator hire, fully manual digging",
    normalAssumptions: `${NORMAL_ACCESS} · digger can reach · your attendance, not the hire clock`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.sleeper.sleepers.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.sleeperSleepersEa,
    label: "Concrete sleepers",
    prompt:
      "How would your crew normally set 20 concrete sleepers once the steel posts are in?",
    scenarioSummary:
      "20 sleepers · posts already in · lift, slot, pack/level · normal access",
    referenceQuantity: 20,
    referenceUnit: "ea",
    authorityQuantity: 20,
    authorityUnit: "ea",
    benchmarkProductivity: 0.22,
    rateLabel: "Concrete sleeper installation (hours/ea)",
    sortOrder: 90,
    priorityTier: 1,
    baselineMethod: null,
    workIncluded: "Lift, slot into H-post, pack/level, ordinary workface handling",
    workExcluded: "Post installation, concrete, drainage, bulk excavation, plant",
    normalAssumptions: `${NORMAL_ACCESS} · posts already in`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.masonry.subbase.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.masonrySubbaseM2,
    label: "Masonry sub-base",
    prompt:
      "How would your crew normally place and compact 8 m² of masonry footing sub-base?",
    scenarioSummary: "8 m² footing-base area · hand place/compact · prepared trench · normal access",
    referenceQuantity: 8,
    referenceUnit: "m2",
    authorityQuantity: 8,
    authorityUnit: "m2",
    benchmarkProductivity: 0.15,
    rateLabel: "Masonry sub-base compaction (hours/m²)",
    sortOrder: 100,
    priorityTier: 3,
    baselineMethod: null,
    workIncluded: "Place, level, and hand-compact sub-base under footing plan area",
    workExcluded: "Bulk excavation, footing pour, block laying, plant hire, spoil export",
    normalAssumptions: `${NORMAL_ACCESS} · trench base already prepared`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.masonry.footing.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.masonryFootingM3,
    label: "Masonry footing pour",
    prompt:
      "How would your crew normally place 1 m³ of masonry strip-footing concrete?",
    scenarioSummary: "1 m³ ready-mix footing · place, level, basic consolidate · normal access",
    referenceQuantity: 1,
    referenceUnit: "m3",
    authorityQuantity: 1,
    authorityUnit: "m3",
    benchmarkProductivity: 1.2,
    rateLabel: "Masonry footing concrete (hours/m³)",
    sortOrder: 110,
    priorityTier: 2,
    baselineMethod: null,
    workIncluded: "Receive/place ready-mix, level, basic consolidate footing",
    workExcluded: "Excavation, rebar design, sub-base, block laying, pump hire",
    normalAssumptions: `${NORMAL_ACCESS} · not bagged post-hole concrete`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.masonry.rebar.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.masonryRebarLm,
    label: "Masonry rebar",
    prompt:
      "How would your crew normally place 20 lm of stated masonry reinforcement?",
    scenarioSummary:
      "20 lm stated horizontal runs · no invented bar schedule · normal access",
    referenceQuantity: 20,
    referenceUnit: "lm",
    authorityQuantity: 20,
    authorityUnit: "lm",
    benchmarkProductivity: 0.08,
    rateLabel: "Masonry rebar installation (hours/lm)",
    sortOrder: 120,
    priorityTier: 3,
    baselineMethod: null,
    workIncluded: "Place stated horizontal reinforcement runs",
    workExcluded: "Fabricating an invented bar schedule, footing dig, block laying",
    normalAssumptions: `${NORMAL_ACCESS} · quantity already known from the job`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.masonry.block.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.masonryBlockM2,
    label: "Masonry block laying",
    prompt:
      "How would your crew normally lay 10 m² of masonry retaining blocks (self-perform, not a subcontractor)?",
    scenarioSummary:
      "10 m² face · standard hollow blocks · self-perform · normal access",
    referenceQuantity: 10,
    referenceUnit: "m2",
    authorityQuantity: 10,
    authorityUnit: "m2",
    benchmarkProductivity: 1.8,
    rateLabel: "Masonry block laying (hours/m²)",
    sortOrder: 130,
    priorityTier: 1,
    baselineMethod: null,
    workIncluded:
      "Set out, lay standard hollow blocks, level courses, ordinary handling",
    workExcluded:
      "Core fill, waterproofing, excavation, footing, plant, subcontract block laying",
    normalAssumptions: `${NORMAL_ACCESS} · self-perform only — not a subcontract rate`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.masonry.core_fill.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.masonryCoreFillM3,
    label: "Masonry core fill",
    prompt: "How would your crew normally place 1 m³ of masonry core fill / grout?",
    scenarioSummary: "1 m³ core fill · blocks already laid · basic consolidation · normal access",
    referenceQuantity: 1,
    referenceUnit: "m3",
    authorityQuantity: 1,
    authorityUnit: "m3",
    benchmarkProductivity: 0.85,
    rateLabel: "Masonry core fill (hours/m³)",
    sortOrder: 140,
    priorityTier: 3,
    baselineMethod: null,
    workIncluded: "Place core fill/grout into filled cores, basic consolidation",
    workExcluded: "Block laying, waterproofing, footing pour, rebar design",
    normalAssumptions: `${NORMAL_ACCESS} · blocks already laid`,
  }),
  v2Task({
    calibrationTaskKey: "retaining_wall.masonry.waterproof.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: RW_PRODUCTIVITY_KEYS.masonryWaterproofM2,
    label: "Masonry waterproofing",
    prompt:
      "How would your crew normally waterproof 10 m² of retaining-side masonry (self-perform)?",
    scenarioSummary:
      "10 m² retaining-side membrane · self-perform · not a subcontract · normal access",
    referenceQuantity: 10,
    referenceUnit: "m2",
    authorityQuantity: 10,
    authorityUnit: "m2",
    benchmarkProductivity: 0.28,
    rateLabel: "Masonry waterproofing (hours/m²)",
    sortOrder: 150,
    priorityTier: 3,
    baselineMethod: null,
    workIncluded:
      "Prepare retaining face, apply liquid or sheet membrane on the retaining side",
    workExcluded:
      "Drainage aggregate, novacoil, block laying, subcontract waterproofing",
    normalAssumptions: `${NORMAL_ACCESS} · self-perform only`,
  }),
];

/** Keys that remain estimator-consumed but are too misleading to calibrate in V2B. */
export const COMPANY_DNA_V2B_DEFERRED_KEYS = [
  "deck.steps.install.hours_per_m2",
] as const;

export const COMPANY_DNA_V2B_DEFERRED_REASONS: Record<
  (typeof COMPANY_DNA_V2B_DEFERRED_KEYS)[number],
  string
> = {
  "deck.steps.install.hours_per_m2":
    "Estimator still consumes hours per m² of tread area. A builder-facing h/step question would be a false calibration. DEFERRED pending estimator unit split.",
};

export const COMPANY_DNA_FOUNDATION_TASKS: readonly CompanyDnaFoundationTask[] = [
  ...COMPANY_DNA_V1_FOUNDATION_TASKS,
  ...COMPANY_DNA_V2B_NEW_TASKS,
];

export const COMPANY_DNA_EXCLUDED_FROM_V2 = {
  packageLumps: [
    "deck.base_labour_hours_per_m2",
    "fence.labour_hours_per_lm",
    "fence.gate_hours_allowance",
    "retaining_wall.base_labour_hours_per_face_m2",
    "retaining_wall.excavation_hours_per_face_m2",
    "retaining_wall.drainage_hours_per_m",
  ],
  conditionLike: ["deck.elevated_extra_hours_per_m2"],
  materialMovement: [] as string[],
  wasteCarting: [] as string[],
  cleanup: [] as string[],
  plantPrefix: "plant.",
} as const;

export function getCompanyDnaFoundationTask(
  taskKey: string
): CompanyDnaFoundationTask | undefined {
  return COMPANY_DNA_FOUNDATION_TASKS.find(
    (task) => task.calibrationTaskKey === taskKey
  );
}

export function listCompanyDnaFoundationTasksForWorkArea(
  workAreaType: string
): CompanyDnaFoundationTask[] {
  return COMPANY_DNA_FOUNDATION_TASKS.filter(
    (task) => task.workAreaType === workAreaType
  );
}

export function listCompanyDnaTasksVisibleInCurrentUi(
  workAreaType?: string
): CompanyDnaFoundationTask[] {
  return COMPANY_DNA_FOUNDATION_TASKS.filter(
    (task) =>
      task.exposeInCurrentUi &&
      (workAreaType == null || task.workAreaType === workAreaType)
  );
}

export function listCompanyDnaTier1Tasks(
  workAreaType: CompanyDnaWorkAreaType
): CompanyDnaFoundationTask[] {
  return listCompanyDnaFoundationTasksForWorkArea(workAreaType).filter(
    (task) => task.priorityTier === 1
  );
}

export function companyDnaFoundationWorkAreaStatus(params: {
  workAreaType: CompanyDnaWorkAreaType;
  calibratedTaskKeys: Iterable<string>;
}): ReturnType<typeof companyDnaWorkAreaStatusV2> {
  const calibrated = new Set(params.calibratedTaskKeys);
  const tier1 = listCompanyDnaTier1Tasks(params.workAreaType);
  return companyDnaWorkAreaStatusV2({
    tier1Total: tier1.length,
    tier1Calibrated: tier1.filter((task) =>
      calibrated.has(task.calibrationTaskKey)
    ).length,
  });
}

/** V1 live lookup remains catalogue.ts. This only asserts a V1 key still exists. */
export function assertV1TaskUnchanged(taskKey: string): CompanyDnaTaskDefinition {
  const task = getCompanyDnaTask(taskKey);
  if (!task) {
    throw new Error(`V1 DNA task missing: ${taskKey}`);
  }
  return task;
}
