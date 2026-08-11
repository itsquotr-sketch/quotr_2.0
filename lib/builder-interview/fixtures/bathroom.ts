/**
 * Stage 3.2.1 — Bathroom renovation fixture.
 */

import type { BuilderInterviewInput } from "@/lib/builder-interview/types";

export function buildBathroomFixture(params?: {
  accessKnown?: boolean;
}): BuilderInterviewInput {
  const bathId = "wa-bath-1";
  const accessKnown = params?.accessKnown ?? true;

  return {
    project: { id: "proj-bath", qualityLevel: "standard" },
    workAreas: [
      {
        id: bathId,
        type: "bathroom",
        name: "Bathroom",
        status: "confirmed",
        sortOrder: 1,
      },
      {
        id: "wa-demo-bath",
        type: "demolition",
        name: "Bathroom strip-out",
        status: "confirmed",
        sortOrder: 0,
      },
    ],
    facts: [
      {
        key: "bathroom.area_m2",
        workAreaId: bathId,
        value: 6.5,
        source: "user",
      },
      {
        key: "bathroom.renovation_type",
        workAreaId: bathId,
        value: "Full renovation",
        source: "ai_extracted",
      },
      {
        key: "bathroom.fixtures_client_supplied",
        workAreaId: bathId,
        value: true,
        source: "user",
      },
      {
        key: "bathroom.plumbing_changes",
        workAreaId: bathId,
        value: "Yes",
        source: "user",
      },
      {
        key: "bathroom.electrical_changes",
        workAreaId: bathId,
        value: "Yes",
        source: "user",
      },
      // Substrate unknown — Scope Details owns waterproofing; interview may ask hazmat/services
    ],
    constraints: [
      {
        key: "occupied_site",
        value: "Yes",
        source: "user",
      },
      ...(accessKnown
        ? [
            {
              key: "site_access",
              value: "Moderate",
              source: "user" as const,
            },
          ]
        : []),
    ],
    existingAssumptions: [],
  };
}
