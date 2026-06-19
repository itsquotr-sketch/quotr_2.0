import type { ScopeDefinition } from "@/lib/scopes/types";

/** Standalone demolition/strip-out scope — only used when demolition is a confirmed work area. */
export const demolitionScope: ScopeDefinition = {
  type: "demolition",
  label: "Demolition / strip-out",
  questions: [
    {
      key: "demolition.area_m2",
      label: "Demolition area",
      questionText: "What approximate area is being demolished or stripped out?",
      inputType: "number",
      unit: "m²",
      required: true,
      priority: 10,
      factKey: "demolition.area_m2",
      workAreaType: "demolition",
      category: "measurement",
    },
    {
      key: "demolition.waste_removal_required",
      label: "Waste removal",
      questionText: "Is waste removal/disposal included?",
      inputType: "boolean",
      options: ["Yes", "No", "Not sure"],
      required: true,
      priority: 20,
      factKey: "demolition.waste_removal_required",
      workAreaType: "demolition",
      category: "scope",
    },
    {
      key: "demolition.access",
      label: "Access",
      questionText: "How difficult is access for removal?",
      inputType: "select",
      options: ["Easy", "Moderate", "Difficult", "Not sure"],
      required: false,
      priority: 30,
      factKey: "demolition.access",
      workAreaType: "demolition",
      category: "risk",
    },
  ],
};
