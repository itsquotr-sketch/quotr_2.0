/**
 * COMPANY DNA-01 — versioned crew/time calibration catalogue.
 * Must match supabase/migrations/052_company_productivity_calibration.sql seed.
 * Server RPC is authority; this copy drives UX and static verification.
 */

export const COMPANY_DNA_WORK_AREA_TYPES = [
  "deck",
  "fence",
  "retaining_wall",
] as const;

export type CompanyDnaWorkAreaType =
  (typeof COMPANY_DNA_WORK_AREA_TYPES)[number];

export type CompanyDnaTaskDefinition = {
  calibrationTaskKey: string;
  scenarioVersion: string;
  workAreaType: CompanyDnaWorkAreaType;
  productivityRateKey: string;
  label: string;
  prompt: string;
  scenarioSummary: string;
  referenceQuantity: number;
  referenceUnit: string;
  authorityQuantity: number;
  authorityUnit: string;
  benchmarkProductivity: number;
  rateLabel: string;
  isHighImpact: boolean;
  sortOrder: number;
};

export const COMPANY_DNA_TASKS: readonly CompanyDnaTaskDefinition[] = [
  {
    calibrationTaskKey: "deck.framing.v1",
    scenarioVersion: "1",
    workAreaType: "deck",
    productivityRateKey: "deck.substructure.install.hours_per_framing_lm",
    label: "Deck framing",
    prompt:
      "Think about a fairly normal 20 m² deck with good access, ground-level / low height, and standard timber framing.",
    scenarioSummary:
      "20 m² timber deck · ground-level / low · normal access · standard framing",
    referenceQuantity: 20,
    referenceUnit: "m2",
    authorityQuantity: 80,
    authorityUnit: "lm",
    benchmarkProductivity: 0.13,
    rateLabel: "Substructure framing (labour-h / framing lm)",
    isHighImpact: true,
    sortOrder: 10,
  },
  {
    calibrationTaskKey: "deck.decking.v1",
    scenarioVersion: "1",
    workAreaType: "deck",
    productivityRateKey: "deck.decking.install.hours_per_lm",
    label: "Decking installation",
    prompt:
      "Think about laying decking on a fairly normal 20 m² deck with good access and standard boards.",
    scenarioSummary:
      "20 m² timber deck · normal access · standard decking boards",
    referenceQuantity: 20,
    referenceUnit: "m2",
    authorityQuantity: 142.8571,
    authorityUnit: "lm",
    benchmarkProductivity: 0.077,
    rateLabel: "Decking installation (labour-h / decking lm)",
    isHighImpact: true,
    sortOrder: 20,
  },
  {
    calibrationTaskKey: "deck.posts.v1",
    scenarioVersion: "1",
    workAreaType: "deck",
    productivityRateKey: "deck.posts.install.hours_per_ea",
    label: "Piles / posts",
    prompt:
      "Think about setting piles or posts for a fairly normal 20 m² ground-level deck with good access.",
    scenarioSummary: "20 m² timber deck · 9 supports · normal access",
    referenceQuantity: 20,
    referenceUnit: "m2",
    authorityQuantity: 9,
    authorityUnit: "ea",
    benchmarkProductivity: 0.2,
    rateLabel: "Pile/post installation (hours/ea)",
    isHighImpact: true,
    sortOrder: 30,
  },
  {
    calibrationTaskKey: "deck.demolition.v1",
    scenarioVersion: "1",
    workAreaType: "deck",
    productivityRateKey: "deck.demolition_hours_per_m2",
    label: "Existing deck removal",
    prompt:
      "Think about taking up an existing 20 m² timber deck with good access.",
    scenarioSummary:
      "20 m² existing timber deck · normal access · strip and remove",
    referenceQuantity: 20,
    referenceUnit: "m2",
    authorityQuantity: 20,
    authorityUnit: "m2",
    benchmarkProductivity: 0.35,
    rateLabel: "Deck demolition (hours/m²)",
    isHighImpact: false,
    sortOrder: 40,
  },
  {
    calibrationTaskKey: "fence.posts.v1",
    scenarioVersion: "1",
    workAreaType: "fence",
    productivityRateKey: "fence.post.install.hours_per_post",
    label: "Fence posts",
    prompt:
      "Think about setting posts for a fairly normal 20 lm timber paling fence, 1.8 m high, straight run, good access.",
    scenarioSummary:
      "20 lm · 1.8 m timber paling · 13 posts · normal access · straight run",
    referenceQuantity: 20,
    referenceUnit: "lm",
    authorityQuantity: 13,
    authorityUnit: "post",
    benchmarkProductivity: 0.7,
    rateLabel: "Fence post installation",
    isHighImpact: true,
    sortOrder: 10,
  },
  {
    calibrationTaskKey: "fence.boards.v1",
    scenarioVersion: "1",
    workAreaType: "fence",
    productivityRateKey: "fence.board.vertical.hours_per_lm",
    label: "Fence palings",
    prompt:
      "Think about hanging palings on a fairly normal 20 lm × 1.8 m timber paling fence with good access.",
    scenarioSummary:
      "20 lm · 1.8 m timber paling · vertical boards · normal access",
    referenceQuantity: 20,
    referenceUnit: "lm",
    authorityQuantity: 241.2,
    authorityUnit: "lm",
    benchmarkProductivity: 0.05,
    rateLabel: "Vertical paling installation",
    isHighImpact: true,
    sortOrder: 20,
  },
  {
    calibrationTaskKey: "fence.rails.v1",
    scenarioVersion: "1",
    workAreaType: "fence",
    productivityRateKey: "fence.rail.install.hours_per_lm",
    label: "Fence rails",
    prompt:
      "Think about fixing rails on a fairly normal 20 lm × 1.8 m timber paling fence with good access.",
    scenarioSummary:
      "20 lm · 1.8 m timber paling · 3 rails · normal access",
    referenceQuantity: 20,
    referenceUnit: "lm",
    authorityQuantity: 60,
    authorityUnit: "lm",
    benchmarkProductivity: 0.08,
    rateLabel: "Fence rail installation",
    isHighImpact: true,
    sortOrder: 30,
  },
  {
    calibrationTaskKey: "retaining_wall.piles.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey: "retaining_wall.timber.piles.install.hours_per_ea",
    label: "Retaining wall piles",
    prompt:
      "Think about setting timber piles for a fairly normal 10 lm × 1.0 m timber retaining wall with good access.",
    scenarioSummary:
      "10 lm · 1.0 m timber retaining · 10 piles · normal access",
    referenceQuantity: 10,
    referenceUnit: "lm",
    authorityQuantity: 10,
    authorityUnit: "ea",
    benchmarkProductivity: 0.85,
    rateLabel: "Timber pile installation (hours/ea)",
    isHighImpact: true,
    sortOrder: 10,
  },
  {
    calibrationTaskKey: "retaining_wall.face.v1",
    scenarioVersion: "1",
    workAreaType: "retaining_wall",
    productivityRateKey:
      "retaining_wall.timber.face_boards.install.hours_per_m2",
    label: "Retaining wall face boards",
    prompt:
      "Think about fixing face boards on a fairly normal 10 lm × 1.0 m timber retaining wall once the piles are in.",
    scenarioSummary:
      "10 lm · 1.0 m timber retaining · 10 m² face · piles already in · normal access",
    referenceQuantity: 10,
    referenceUnit: "lm",
    authorityQuantity: 10,
    authorityUnit: "m2",
    benchmarkProductivity: 0.55,
    rateLabel: "Timber face-board installation (hours/m²)",
    isHighImpact: true,
    sortOrder: 20,
  },
] as const;

export const COMPANY_DNA_WORK_AREA_LABELS: Record<
  CompanyDnaWorkAreaType,
  string
> = {
  deck: "Deck",
  fence: "Fence",
  retaining_wall: "Retaining wall",
};

export function getCompanyDnaTask(
  taskKey: string
): CompanyDnaTaskDefinition | undefined {
  return COMPANY_DNA_TASKS.find((task) => task.calibrationTaskKey === taskKey);
}

export function listCompanyDnaTasksForWorkArea(
  workAreaType: string
): CompanyDnaTaskDefinition[] {
  return COMPANY_DNA_TASKS.filter((task) => task.workAreaType === workAreaType);
}

export function orderCompanyDnaWorkAreas(
  preferredWorkAreaTypes: string[]
): CompanyDnaWorkAreaType[] {
  const preferred = preferredWorkAreaTypes.filter((type): type is CompanyDnaWorkAreaType =>
    COMPANY_DNA_WORK_AREA_TYPES.includes(type as CompanyDnaWorkAreaType)
  );
  const rest = COMPANY_DNA_WORK_AREA_TYPES.filter(
    (type) => !preferred.includes(type)
  );
  return [...preferred, ...rest];
}
