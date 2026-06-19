export type EstimateSupport = "calculator" | "rough_allowance" | "not_supported";

export type ScopeCatalogueItem = {
  type: string;
  label: string;
  category: string;
  description: string;
  estimateSupport: EstimateSupport;
  defaultEnabled: boolean;
  suggestedRateTypes: string[];
};

export const SCOPE_CATALOGUE: ScopeCatalogueItem[] = [
  {
    type: "deck",
    label: "Deck",
    category: "External",
    description:
      "Timber/composite decks, stairs, balustrades, pergolas where relevant.",
    estimateSupport: "calculator",
    defaultEnabled: true,
    suggestedRateTypes: ["scope", "labour", "material", "allowance"],
  },
  {
    type: "retaining_wall",
    label: "Retaining wall",
    category: "External",
    description:
      "Timber retaining walls, excavation/backfill allowances, drainage assumptions.",
    estimateSupport: "calculator",
    defaultEnabled: true,
    suggestedRateTypes: ["scope", "labour", "material", "allowance"],
  },
  {
    type: "bathroom",
    label: "Bathroom renovation",
    category: "Renovation",
    description:
      "Bathroom renovations including demolition, waterproofing, tiling and fixtures.",
    estimateSupport: "calculator",
    defaultEnabled: true,
    suggestedRateTypes: ["scope", "labour", "subcontractor", "allowance"],
  },
  {
    type: "kitchen",
    label: "Kitchen renovation",
    category: "Renovation",
    description:
      "Kitchen renovations including demolition, cabinetry, plumbing/electrical allowances.",
    estimateSupport: "rough_allowance",
    defaultEnabled: true,
    suggestedRateTypes: ["scope", "subcontractor", "allowance"],
  },
  {
    type: "fence",
    label: "Fence",
    category: "External",
    description: "Timber fences, gates, demolition and access assumptions.",
    estimateSupport: "rough_allowance",
    defaultEnabled: true,
    suggestedRateTypes: ["scope", "labour", "material"],
  },
  {
    type: "pergola",
    label: "Pergola",
    category: "External",
    description: "Pergolas and simple outdoor structures.",
    estimateSupport: "rough_allowance",
    defaultEnabled: false,
    suggestedRateTypes: ["scope", "labour", "material", "allowance"],
  },
  {
    type: "external_stairs",
    label: "External Stairs",
    category: "External",
    description:
      "External timber stairs, landings, handrails and simple access stair allowances.",
    estimateSupport: "rough_allowance",
    defaultEnabled: true,
    suggestedRateTypes: ["scope", "labour", "material", "allowance"],
  },
  {
    type: "demolition",
    label: "Demolition / strip-out",
    category: "Preparation",
    description: "Demolition, strip-out, removal and disposal allowances.",
    estimateSupport: "rough_allowance",
    defaultEnabled: false,
    suggestedRateTypes: ["labour", "allowance"],
  },
  {
    type: "internal_walls",
    label: "Internal walls",
    category: "Interior fitout",
    description: "Timber/steel partitions, linings and internal wall scopes.",
    estimateSupport: "rough_allowance",
    defaultEnabled: false,
    suggestedRateTypes: ["scope", "labour", "material"],
  },
  {
    type: "ceilings",
    label: "Ceilings",
    category: "Interior fitout",
    description: "Plasterboard or grid/tile ceiling works.",
    estimateSupport: "rough_allowance",
    defaultEnabled: false,
    suggestedRateTypes: ["scope", "labour", "material"],
  },
  {
    type: "doors",
    label: "Doors",
    category: "Interior fitout",
    description: "Internal doors, hardware, frames and installation.",
    estimateSupport: "rough_allowance",
    defaultEnabled: false,
    suggestedRateTypes: ["scope", "labour", "material"],
  },
  {
    type: "flooring",
    label: "Flooring",
    category: "Finishes",
    description: "Flooring preparation and installation allowances.",
    estimateSupport: "rough_allowance",
    defaultEnabled: false,
    suggestedRateTypes: ["scope", "labour", "material"],
  },
  {
    type: "painting",
    label: "Painting",
    category: "Finishes",
    description: "Interior/exterior painting allowances.",
    estimateSupport: "rough_allowance",
    defaultEnabled: false,
    suggestedRateTypes: ["scope", "labour", "material"],
  },
];

export const SCOPE_CATEGORIES = [
  "External",
  "Renovation",
  "Preparation",
  "Interior fitout",
  "Finishes",
] as const;

export function getEstimateSupportLabel(
  support: EstimateSupport
): string {
  switch (support) {
    case "calculator":
      return "Estimate-ready";
    case "rough_allowance":
      return "Rough allowance";
    case "not_supported":
      return "Not supported yet";
  }
}
