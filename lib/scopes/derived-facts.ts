import { factDedupeKey } from "@/lib/ai/mappers";
import {
  buildFactLookup,
  factHasValue,
  getFactValue,
  roundToTwoDecimals,
  toPositiveNumber,
  type ProjectFactRecord,
} from "@/lib/scopes/fact-values";

export type DerivedFactCandidate = {
  work_area_id: string;
  key: string;
  label: string;
  value: number;
  unit: string;
  source: "derived";
};

export type WorkAreaRef = {
  id: string;
  type: string;
};

export function deriveFactsForProject(params: {
  workAreas: WorkAreaRef[];
  projectFacts: ProjectFactRecord[];
}): DerivedFactCandidate[] {
  const lookup = buildFactLookup(params.projectFacts);
  const derived: DerivedFactCandidate[] = [];

  for (const workArea of params.workAreas) {
    if (workArea.type === "deck") {
      const length = toPositiveNumber(
        getFactValue(lookup, workArea.id, "deck.length_m")
      );
      const width = toPositiveNumber(
        getFactValue(lookup, workArea.id, "deck.width_m")
      );

      if (length && width) {
        const existing = lookup.get(`${workArea.id}:deck.area_m2`);
        const canDerive =
          !existing ||
          existing.source === "ai_extracted" ||
          existing.source === "derived";

        if (canDerive && existing?.source !== "user") {
          derived.push({
            work_area_id: workArea.id,
            key: "deck.area_m2",
            label: "Deck area",
            value: roundToTwoDecimals(length * width),
            unit: "m²",
            source: "derived",
          });
        }
      }
    }

    if (workArea.type === "pergola") {
      const length = toPositiveNumber(
        getFactValue(lookup, workArea.id, "pergola.length_m")
      );
      const width = toPositiveNumber(
        getFactValue(lookup, workArea.id, "pergola.width_m")
      );

      if (length && width) {
        const existing = lookup.get(`${workArea.id}:pergola.area_m2`);
        const canDerive =
          !existing ||
          existing.source === "ai_extracted" ||
          existing.source === "derived";

        if (canDerive && existing?.source !== "user") {
          derived.push({
            work_area_id: workArea.id,
            key: "pergola.area_m2",
            label: "Pergola area",
            value: roundToTwoDecimals(length * width),
            unit: "m²",
            source: "derived",
          });
        }
      }
    }

    if (workArea.type === "retaining_wall") {
      const existingHeight = lookup.get(
        `${workArea.id}:retaining_wall.height_m`
      );
      if (existingHeight?.source === "user" || factHasValue(existingHeight?.value)) {
        // still derive backfill volume when dimensions exist
      } else {
        const heightHigh = toPositiveNumber(
          getFactValue(lookup, workArea.id, "retaining_wall.height_high_m")
        );
        const heightLow = toPositiveNumber(
          getFactValue(lookup, workArea.id, "retaining_wall.height_low_m")
        );

        if (heightHigh !== null && heightLow !== null) {
          derived.push({
            work_area_id: workArea.id,
            key: "retaining_wall.height_m",
            label: "Average retaining wall height",
            value: roundToTwoDecimals((heightHigh + heightLow) / 2),
            unit: "m",
            source: "derived",
          });
        }
      }

      const backfillLength =
        toPositiveNumber(
          getFactValue(lookup, workArea.id, "retaining_wall.backfill_length_m")
        ) ??
        toPositiveNumber(
          getFactValue(lookup, workArea.id, "retaining_wall.length_m")
        );
      const backfillHeight =
        toPositiveNumber(
          getFactValue(lookup, workArea.id, "retaining_wall.backfill_height_m")
        ) ??
        toPositiveNumber(
          getFactValue(lookup, workArea.id, "retaining_wall.height_m")
        );
      const backfillDepth = toPositiveNumber(
        getFactValue(lookup, workArea.id, "retaining_wall.backfill_depth_m")
      );

      if (backfillLength && backfillHeight && backfillDepth) {
        derived.push({
          work_area_id: workArea.id,
          key: "retaining_wall.backfill_volume_m3",
          label: "Backfill volume",
          value: roundToTwoDecimals(
            backfillLength * backfillHeight * backfillDepth
          ),
          unit: "m³",
          source: "derived",
        });
      }
    }
  }

  return derived;
}

export function mergeDerivedFactsIntoRecords(
  projectFacts: ProjectFactRecord[],
  derivedFacts: DerivedFactCandidate[]
): ProjectFactRecord[] {
  const merged = [...projectFacts];

  for (const derived of derivedFacts) {
    const index = merged.findIndex(
      (fact) =>
        fact.work_area_id === derived.work_area_id && fact.key === derived.key
    );

    if (index === -1) {
      merged.push({
        key: derived.key,
        work_area_id: derived.work_area_id,
        value: derived.value,
        source: derived.source,
      });
      continue;
    }

    const existing = merged[index];
    if (existing.source === "user") {
      continue;
    }

    merged[index] = {
      ...existing,
      value: derived.value,
      source: derived.source,
    };
  }

  return merged;
}

export type DerivedFactDisplay = {
  workAreaId: string;
  label: string;
  text: string;
};

export function buildDerivedFactDisplays(
  projectFacts: ProjectFactRecord[]
): DerivedFactDisplay[] {
  const displays: DerivedFactDisplay[] = [];

  for (const fact of projectFacts) {
    if (fact.source !== "derived" || !fact.work_area_id || !factHasValue(fact.value)) {
      continue;
    }

    if (fact.key === "deck.area_m2" && typeof fact.value === "number") {
      displays.push({
        workAreaId: fact.work_area_id,
        label: "Calculated deck area",
        text: `${fact.value} m²`,
      });
      continue;
    }

    if (fact.key === "pergola.area_m2" && typeof fact.value === "number") {
      displays.push({
        workAreaId: fact.work_area_id,
        label: "Calculated pergola area",
        text: `${fact.value} m²`,
      });
      continue;
    }

    if (
      fact.key === "retaining_wall.height_m" &&
      typeof fact.value === "number"
    ) {
      displays.push({
        workAreaId: fact.work_area_id,
        label: "Calculated average height",
        text: `${fact.value} m`,
      });
      continue;
    }

    if (
      fact.key === "retaining_wall.backfill_volume_m3" &&
      typeof fact.value === "number"
    ) {
      displays.push({
        workAreaId: fact.work_area_id,
        label: "Calculated backfill volume",
        text: `${fact.value} m³`,
      });
    }
  }

  return displays;
}

export function factRecordDedupeKey(
  workAreaId: string | null,
  key: string
): string {
  return factDedupeKey(workAreaId, key);
}
