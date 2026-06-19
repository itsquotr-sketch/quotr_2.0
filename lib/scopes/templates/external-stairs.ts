import type { ScopeDefinition } from "@/lib/scopes/types";

export const externalStairsScope: ScopeDefinition = {
  type: "external_stairs",
  label: "External Stairs",
  questions: [
    {
      key: "external_stairs.riser_count",
      label: "Number of risers",
      questionText: "Approximately how many risers are required?",
      inputType: "number",
      unit: "risers",
      required: true,
      priority: 10,
      factKey: "external_stairs.riser_count",
      workAreaType: "external_stairs",
      category: "measurement",
    },
    {
      key: "external_stairs.material",
      label: "Stair material",
      questionText: "What stair material should be allowed for?",
      inputType: "select",
      options: ["Timber", "Steel", "Concrete", "Not sure"],
      required: false,
      priority: 20,
      factKey: "external_stairs.material",
      workAreaType: "external_stairs",
      category: "scope",
    },
    {
      key: "external_stairs.handrail_required",
      label: "Handrail",
      questionText: "Is a handrail required?",
      inputType: "boolean",
      options: ["Yes", "No", "Not sure"],
      required: false,
      priority: 30,
      factKey: "external_stairs.handrail_required",
      workAreaType: "external_stairs",
      category: "scope",
    },
  ],
};
