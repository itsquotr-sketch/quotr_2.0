import {
  normaliseAIExtraction,
  normaliseExtractedFactValue,
} from "../lib/scopes/normalise-extracted-facts";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

const samples: Array<{
  key: string;
  input: string | number | boolean;
  workAreaType: string;
  expected: string | number | boolean;
}> = [
  {
    key: "internal_walls.wall_lining_type",
    input: "13mm GIB",
    workAreaType: "internal_walls",
    expected: "Plasterboard",
  },
  {
    key: "internal_walls.plasterboard_type",
    input: "Aqualine",
    workAreaType: "internal_walls",
    expected: "Aqualine",
  },
  {
    key: "internal_walls.lining_sides",
    input: "both sides",
    workAreaType: "internal_walls",
    expected: "Both sides",
  },
  {
    key: "painting.coats_required",
    input: "two coats",
    workAreaType: "painting",
    expected: "2",
  },
  {
    key: "kitchen.cabinetry_client_supplied",
    input: "client supplying cabinetry",
    workAreaType: "kitchen",
    expected: true,
  },
  {
    key: "kitchen.plumbing_changes",
    input: "by others",
    workAreaType: "kitchen",
    expected: "None",
  },
  {
    key: "bathroom.demolition_required",
    input: "strip-out included",
    workAreaType: "bathroom",
    expected: true,
  },
  {
    key: "kitchen.cabinetry_type",
    input: "flatpack",
    workAreaType: "kitchen",
    expected: "Flatpack",
  },
  {
    key: "plastering.level",
    input: "Level 4",
    workAreaType: "plastering",
    expected: "Level 4",
  },
  {
    key: "plastering.sanding_included",
    input: "sand ready for paint",
    workAreaType: "plastering",
    expected: true,
  },
  {
    key: "painting.prep_level",
    input: "minor prep",
    workAreaType: "painting",
    expected: "Light",
  },
  {
    key: "deck.board_material",
    input: "kwila",
    workAreaType: "deck",
    expected: "Kwila",
  },
  {
    key: "deck.access_type",
    input: "no stairs",
    workAreaType: "deck",
    expected: "None",
  },
  {
    key: "deck.balustrade_required",
    input: "no balustrade",
    workAreaType: "deck",
    expected: false,
  },
  {
    key: "deck.board_width_mm",
    input: "140mm",
    workAreaType: "deck",
    expected: "140",
  },
  {
    key: "retaining_wall.fixing_type",
    input: "face fixed",
    workAreaType: "retaining_wall",
    expected: "Face-fixed",
  },
  {
    key: "retaining_wall.is_raking",
    input: "raking wall",
    workAreaType: "retaining_wall",
    expected: true,
  },
  {
    key: "deck.level",
    input: "ground level",
    workAreaType: "deck",
    expected: "Ground-level",
  },
  {
    key: "demolition.services_isolated",
    input: "services isolated by others",
    workAreaType: "demolition",
    expected: "By others",
  },
  {
    key: "demolition.hazardous_materials_risk",
    input: "possible asbestos",
    workAreaType: "demolition",
    expected: "Possible asbestos",
  },
  {
    key: "external_stairs.risers_count",
    input: "8-step stairs",
    workAreaType: "external_stairs",
    expected: 8,
  },
  {
    key: "bathroom.underfloor_heating_included",
    input: "no underfloor heating",
    workAreaType: "bathroom",
    expected: false,
  },
  {
    key: "deck.stairs_required",
    input: "no stairs",
    workAreaType: "deck",
    expected: false,
  },
  {
    key: "fence.gate_count",
    input: "0",
    workAreaType: "fence",
    expected: 0,
  },
  {
    key: "kitchen.plumbing_changes",
    input: "plumbing by others",
    workAreaType: "kitchen",
    expected: "None",
  },
  {
    key: "flooring.disposal_included",
    input: "disposal not included",
    workAreaType: "flooring",
    expected: false,
  },
];

for (const sample of samples) {
  const actual = normaliseExtractedFactValue(
    sample.key,
    sample.input,
    sample.workAreaType
  );
  assert(
    `${sample.key}: ${JSON.stringify(sample.input)} → ${JSON.stringify(sample.expected)}`,
    actual === sample.expected ||
      (typeof actual === "string" &&
        typeof sample.expected === "string" &&
        actual.toLowerCase() === sample.expected.toLowerCase())
  );
}

const extraction = normaliseAIExtraction({
  workAreas: [{ type: "bathroom", confidence: 0.9, rationale: "test" }],
  facts: [
    {
      work_area_type: "bathroom",
      key: "recommended_sell",
      label: "Sell",
      value: 9999,
      confidence: 0.5,
    },
    {
      work_area_type: "bathroom",
      key: "bathroom.waterproofing_included",
      label: "Waterproofing",
      value: true,
      confidence: 0.9,
    },
  ],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.9,
  warnings: [],
});

assert(
  "filters forbidden pricing keys",
  !extraction.facts.some((fact) => fact.key.includes("recommended_sell"))
);
assert(
  "keeps valid facts",
  extraction.facts.some((fact) => fact.key === "bathroom.waterproofing_included")
);

const deckAreaExtraction = normaliseAIExtraction({
  workAreas: [{ type: "deck", confidence: 0.9, rationale: "test" }],
  facts: [
    {
      work_area_type: "deck",
      key: "deck.area_m2",
      label: "Deck area",
      value: 36,
      confidence: 0.9,
    },
  ],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.9,
  warnings: [],
});

assert(
  "expands deck area into length and width dimensions",
  deckAreaExtraction.facts.some((fact) => fact.key === "deck.length_m" && fact.value === 6) &&
    deckAreaExtraction.facts.some((fact) => fact.key === "deck.width_m" && fact.value === 6)
);
assert(
  "drops derived deck.area_m2 from extraction output",
  !deckAreaExtraction.facts.some((fact) => fact.key === "deck.area_m2")
);

console.log("\nNormalisation checks complete.");
