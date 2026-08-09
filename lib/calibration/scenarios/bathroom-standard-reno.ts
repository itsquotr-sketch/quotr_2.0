import type { CalibrationScenario } from "@/lib/calibration/types";

/** STANDARD BATHROOM RENOVATION — bounded, NZ contractor language. */
export const BATHROOM_STANDARD_RENO_V1: CalibrationScenario = {
  id: "bathroom.standard_reno.v1",
  version: "1",
  workAreaType: "bathroom",
  title: "Standard bathroom renovation",
  summary:
    "~8 m² bathroom soft strip, waterproofing, tiled wet areas, client-supplied vanity/toilet.",
  jobBrief:
    "Renovate an existing approximately 8 m² bathroom. Soft strip existing finishes and fittings. New tiled floor and wall wet areas. New waterproofing. Client supplies vanity and toilet. Plumbing and electrical modifications required. Standard residential access.",
  facts: [
    { key: "bathroom.area_m2", value: 8 },
    { key: "bathroom.renovation_type", value: "full renovation" },
    { key: "bathroom.demolition_required", value: true },
    { key: "bathroom.tile_extent", value: "Floor and wet-area walls" },
    { key: "bathroom.tiling_included", value: true },
    { key: "bathroom.waterproofing_included", value: true },
    { key: "bathroom.waterproofing_required", value: true },
    { key: "bathroom.fixtures_client_supplied", value: true },
    { key: "bathroom.includes_vanity", value: true },
    { key: "bathroom.includes_toilet", value: true },
    { key: "bathroom.includes_shower", value: true },
    { key: "bathroom.plumbing_changes", value: "modifications required" },
    { key: "bathroom.electrical_changes", value: "modifications required" },
    { key: "bathroom.access", value: "Standard" },
    { key: "bathroom.finish_level", value: "standard" },
  ],
  constraints: [
    { key: "access", label: "Access", value: "Standard residential" },
  ],
  scopeItems: [
    "Soft strip / demolition",
    "Waterproofing",
    "Floor and wet-area tiling",
    "Plumbing modifications",
    "Electrical modifications",
    "Client-supplied vanity and toilet (install labour)",
  ],
  questions: [
    {
      id: "labour_hours",
      label: "How many builder/own labour hours would you normally allow?",
      kind: "number",
      unit: "hours",
    },
    {
      id: "subcontractors_cost",
      label: "Plumbing + electrical trade allowances (combined cost)?",
      help: "What you expect to pay / allow for those trades.",
      kind: "number",
      unit: "$",
    },
    {
      id: "materials_cost",
      label: "Waterproofing, tiling and other materials allowance (cost)?",
      kind: "number",
      unit: "$",
    },
    {
      id: "other_cost",
      label: "Any other direct costs?",
      help: "Waste, hire, small items — optional.",
      kind: "number",
      unit: "$",
      optional: true,
    },
    {
      id: "expected_total_cost",
      label: "What would you expect this job to cost your business in total?",
      help: "Optional if component lines already cover it.",
      kind: "number",
      unit: "$",
      optional: true,
    },
    {
      id: "expected_sell",
      label: "What would you normally quote this job for?",
      kind: "number",
      unit: "$",
    },
    {
      id: "confidence",
      label: "How confident are you in these numbers?",
      kind: "confidence",
    },
    {
      id: "notes",
      label: "Anything else Quotr should know?",
      kind: "text",
      optional: true,
    },
  ],
};
