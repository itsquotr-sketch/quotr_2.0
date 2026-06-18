export type StarterRateField = "cost_rate" | "sell_rate" | "markup_percent";

export type StarterRateRowDefinition = {
  item_key: string;
  rate_type: string;
  trade?: string;
  work_area_type?: string;
  label: string;
  unit: string;
  fields: StarterRateField[];
  section: "labour" | "scope";
};

export type EnabledWorkAreaInput = {
  work_area_type: string;
  enabled: boolean;
};

const BASE_STARTER_RATES: StarterRateRowDefinition[] = [
  {
    item_key: "labour.carpenter.hour",
    rate_type: "labour",
    trade: "carpenter",
    label: "Carpenter / builder hourly rate",
    unit: "hour",
    fields: ["cost_rate", "sell_rate"],
    section: "labour",
  },
  {
    item_key: "labour.labourer.hour",
    rate_type: "labour",
    trade: "labourer",
    label: "Labourer hourly rate",
    unit: "hour",
    fields: ["cost_rate", "sell_rate"],
    section: "labour",
  },
  {
    item_key: "allowance.subcontractor.default",
    rate_type: "allowance",
    label: "Default subcontractor allowance",
    unit: "allowance",
    fields: ["markup_percent"],
    section: "labour",
  },
];

const SCOPE_STARTER_RATES: Record<string, StarterRateRowDefinition> = {
  deck: {
    item_key: "scope.deck.m2",
    rate_type: "scope",
    work_area_type: "deck",
    label: "Deck rate per m²",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  retaining_wall: {
    item_key: "scope.retaining_wall.m2",
    rate_type: "scope",
    work_area_type: "retaining_wall",
    label: "Retaining wall rate per m² face area",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  bathroom: {
    item_key: "scope.bathroom.m2",
    rate_type: "scope",
    work_area_type: "bathroom",
    label: "Bathroom renovation rate per m²",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  kitchen: {
    item_key: "scope.kitchen.m2",
    rate_type: "scope",
    work_area_type: "kitchen",
    label: "Kitchen renovation rough rate per m²",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  fence: {
    item_key: "scope.fence.lm",
    rate_type: "scope",
    work_area_type: "fence",
    label: "Fence rate per lineal metre",
    unit: "lm",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  pergola: {
    item_key: "scope.pergola.m2",
    rate_type: "scope",
    work_area_type: "pergola",
    label: "Pergola rough rate per m²",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  demolition: {
    item_key: "scope.demolition.hour",
    rate_type: "scope",
    work_area_type: "demolition",
    label: "Demolition / strip-out hourly allowance",
    unit: "hour",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  internal_walls: {
    item_key: "scope.internal_walls.m2",
    rate_type: "scope",
    work_area_type: "internal_walls",
    label: "Internal walls rate per m²",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  ceilings: {
    item_key: "scope.ceilings.m2",
    rate_type: "scope",
    work_area_type: "ceilings",
    label: "Ceilings rate per m²",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  doors: {
    item_key: "scope.doors.each",
    rate_type: "scope",
    work_area_type: "doors",
    label: "Door supply/install allowance per door",
    unit: "each",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  flooring: {
    item_key: "scope.flooring.m2",
    rate_type: "scope",
    work_area_type: "flooring",
    label: "Flooring rate per m²",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
  painting: {
    item_key: "scope.painting.m2",
    rate_type: "scope",
    work_area_type: "painting",
    label: "Painting rate per m²",
    unit: "m2",
    fields: ["cost_rate", "sell_rate"],
    section: "scope",
  },
};

export function buildStarterRateRows(enabledWorkAreas: EnabledWorkAreaInput[]): {
  rows: StarterRateRowDefinition[];
  unsupportedTypes: string[];
} {
  const enabledTypes = enabledWorkAreas
    .filter((area) => area.enabled)
    .map((area) => area.work_area_type);

  const scopeRows: StarterRateRowDefinition[] = [];
  const unsupportedTypes: string[] = [];

  for (const workAreaType of enabledTypes) {
    const definition = SCOPE_STARTER_RATES[workAreaType];
    if (definition) {
      scopeRows.push(definition);
    } else {
      unsupportedTypes.push(workAreaType);
    }
  }

  return {
    rows: [...BASE_STARTER_RATES, ...scopeRows],
    unsupportedTypes,
  };
}

export function formatRateUnit(unit: string): string {
  switch (unit) {
    case "m2":
      return "per m²";
    case "lm":
      return "per lineal metre";
    case "hour":
      return "per hour";
    case "each":
      return "per door";
    case "allowance":
      return "markup %";
    default:
      return `per ${unit}`;
  }
}
