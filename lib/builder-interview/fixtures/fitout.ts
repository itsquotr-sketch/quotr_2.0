/**
 * Stage 3.2.1 — Commercial Fitout multi-WA stress fixture (7+ WAs).
 */

import type { BuilderInterviewInput } from "@/lib/builder-interview/types";

const FITOUT_WAS: Array<{ id: string; type: string; name: string; sortOrder: number }> =
  [
    { id: "wa-demo", type: "demolition", name: "Demolition", sortOrder: 1 },
    {
      id: "wa-walls",
      type: "internal_walls",
      name: "Internal walls",
      sortOrder: 2,
    },
    { id: "wa-ceil", type: "ceilings", name: "Ceilings", sortOrder: 3 },
    { id: "wa-doors", type: "doors", name: "Doors", sortOrder: 4 },
    { id: "wa-floor", type: "flooring", name: "Flooring", sortOrder: 5 },
    { id: "wa-paint", type: "painting", name: "Painting", sortOrder: 6 },
    { id: "wa-plast", type: "plastering", name: "Plastering", sortOrder: 7 },
  ];

export function buildCommercialFitoutFixture(params?: {
  /** When true, project logistics already answered */
  logisticsKnown?: boolean;
}): BuilderInterviewInput {
  const logisticsKnown = params?.logisticsKnown ?? true;

  return {
    project: { id: "proj-fitout", qualityLevel: "standard" },
    workAreas: FITOUT_WAS.map((wa) => ({
      ...wa,
      status: "confirmed" as const,
    })),
    facts: [
      // Granular details present — interview must DEFER these domains
      {
        key: "internal_walls.framing_type",
        workAreaId: "wa-walls",
        value: "Timber",
        source: "user",
      },
      {
        key: "doors.count",
        workAreaId: "wa-doors",
        value: 4,
        source: "user",
      },
      {
        key: "painting.coat_count",
        workAreaId: "wa-paint",
        value: 2,
        source: "default",
      },
    ],
    constraints: logisticsKnown
      ? [
          { key: "site_access", value: "Difficult", source: "user" },
          {
            key: "material_carry_distance",
            value: "10–30m",
            source: "user",
          },
          { key: "floor_level", value: "Upper floor", source: "user" },
          { key: "occupied_site", value: "Yes", source: "user" },
          { key: "working_hours", value: "Yes", source: "user" },
          { key: "parking_loading", value: "Moderate", source: "ai_extracted" },
        ]
      : [],
    existingAssumptions: [],
  };
}

export const FITOUT_WORK_AREA_TYPES = FITOUT_WAS.map((w) => w.type);
