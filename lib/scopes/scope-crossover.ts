import {
  buildFactLookup,
  factHasValue,
  getFactValue,
  type ProjectFactRecord,
} from "@/lib/scopes/fact-values";

export type WorkAreaRef = {
  id: string;
  type: string;
};

type CrossoverFactPatch = {
  work_area_id: string;
  key: string;
  label: string;
  value: string | number | boolean;
  source: "derived";
};

function upsertPatch(
  patches: CrossoverFactPatch[],
  patch: CrossoverFactPatch
): void {
  const exists = patches.some(
    (item) =>
      item.work_area_id === patch.work_area_id && item.key === patch.key
  );
  if (!exists) {
    patches.push(patch);
  }
}

function boolValue(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "Yes") return true;
  if (value === false || value === "false" || value === "No") return false;
  return null;
}

function isRemovalOnlyFlooring(lookup: ReturnType<typeof buildFactLookup>, workAreaId: string): boolean {
  const supplyScope = getFactValue(lookup, workAreaId, "flooring.supply_scope");
  if (
    typeof supplyScope === "string" &&
    supplyScope.toLowerCase().includes("removal")
  ) {
    return true;
  }
  const removal = boolValue(getFactValue(lookup, workAreaId, "flooring.existing_flooring_removal"));
  const flooringType = getFactValue(lookup, workAreaId, "flooring.type");
  return removal === true && !factHasValue(flooringType);
}

/**
 * Resolves scope ownership across work areas after recognition/fact extraction.
 * Prevents duplicate pricing and redundant questions.
 */
export function applyScopeCrossoverResolution(params: {
  workAreas: WorkAreaRef[];
  projectFacts: ProjectFactRecord[];
}): ProjectFactRecord[] {
  const patches: CrossoverFactPatch[] = [];
  const confirmedTypes = new Set(params.workAreas.map((wa) => wa.type));
  const lookup = buildFactLookup(params.projectFacts);

  const paintingWorkArea = params.workAreas.find((wa) => wa.type === "painting");
  const demolitionWorkArea = params.workAreas.find((wa) => wa.type === "demolition");
  const flooringWorkArea = params.workAreas.find((wa) => wa.type === "flooring");
  const kitchenWorkArea = params.workAreas.find((wa) => wa.type === "kitchen");
  const doorsWorkArea = params.workAreas.find((wa) => wa.type === "doors");
  const internalWallsWorkArea = params.workAreas.find(
    (wa) => wa.type === "internal_walls"
  );

  if (flooringWorkArea) {
    if (isRemovalOnlyFlooring(lookup, flooringWorkArea.id)) {
      upsertPatch(patches, {
        work_area_id: flooringWorkArea.id,
        key: "flooring.supply_scope",
        label: "Flooring supply scope",
        value: "Removal only",
        source: "derived",
      });
      upsertPatch(patches, {
        work_area_id: flooringWorkArea.id,
        key: "flooring.existing_flooring_removal",
        label: "Existing flooring removal",
        value: true,
        source: "derived",
      });
    }
  }

  if (kitchenWorkArea) {
    const clientSupplied = boolValue(
      getFactValue(lookup, kitchenWorkArea.id, "kitchen.cabinetry_client_supplied")
    );
    if (clientSupplied === true) {
      upsertPatch(patches, {
        work_area_id: kitchenWorkArea.id,
        key: "kitchen.cabinetry_included",
        label: "Cabinetry included",
        value: true,
        source: "derived",
      });
    }
  }

  if (doorsWorkArea) {
    const clientSupplied = boolValue(
      getFactValue(lookup, doorsWorkArea.id, "doors.client_supplied")
    );
    if (clientSupplied === true) {
      upsertPatch(patches, {
        work_area_id: doorsWorkArea.id,
        key: "doors.supply_scope",
        label: "Door supply scope",
        value: "Install only",
        source: "derived",
      });
    }
  }

  if (kitchenWorkArea && demolitionWorkArea) {
    upsertPatch(patches, {
      work_area_id: kitchenWorkArea.id,
      key: "kitchen.demolition_required",
      label: "Demolition required",
      value: false,
      source: "derived",
    });
  }

  if (paintingWorkArea) {
    if (internalWallsWorkArea) {
      upsertPatch(patches, {
        work_area_id: internalWallsWorkArea.id,
        key: "internal_walls.painting_included",
        label: "Painting included",
        value: false,
        source: "derived",
      });
    }
    if (doorsWorkArea) {
      upsertPatch(patches, {
        work_area_id: doorsWorkArea.id,
        key: "doors.painting_included",
        label: "Door painting included",
        value: false,
        source: "derived",
      });
    }
  }

  if (internalWallsWorkArea && paintingWorkArea) {
    const lining = getFactValue(
      lookup,
      internalWallsWorkArea.id,
      "internal_walls.lining_type"
    );
    const liningSides = getFactValue(
      lookup,
      internalWallsWorkArea.id,
      "internal_walls.lining_sides"
    );
    const hasGib =
      (typeof lining === "string" &&
        /gib|plasterboard|drywall/i.test(lining)) ||
      liningSides != null;

    if (hasGib && !confirmedTypes.has("plastering")) {
      const plasteringWorkArea = params.workAreas.find(
        (wa) => wa.type === "plastering"
      );
      if (plasteringWorkArea) {
        const length = getFactValue(
          lookup,
          internalWallsWorkArea.id,
          "internal_walls.length_lm"
        );
        const height = getFactValue(
          lookup,
          internalWallsWorkArea.id,
          "internal_walls.height_m"
        );
        const sides =
          typeof liningSides === "string" &&
          liningSides.toLowerCase().includes("both")
            ? 2
            : 1;
        if (length && height) {
          upsertPatch(patches, {
            work_area_id: plasteringWorkArea.id,
            key: "plastering.area_m2",
            label: "Plastering area",
            value: Number(length) * Number(height) * sides,
            source: "derived",
          });
        }
        upsertPatch(patches, {
          work_area_id: plasteringWorkArea.id,
          key: "plastering.level",
          label: "Plastering level",
          value: "Level 4",
          source: "derived",
        });
      }
    }
  }

  if (demolitionWorkArea) {
    const carting =
      getFactValue(lookup, demolitionWorkArea.id, "demolition.carting_distance_m") ??
      params.workAreas
        .map((wa) => getFactValue(lookup, wa.id, `${wa.type}.carting_distance_m`))
        .find((value) => value != null);

    if (carting != null) {
      upsertPatch(patches, {
        work_area_id: demolitionWorkArea.id,
        key: "demolition.disposal_included",
        label: "Disposal included",
        value: true,
        source: "derived",
      });
      upsertPatch(patches, {
        work_area_id: demolitionWorkArea.id,
        key: "demolition.carting_distance_m",
        label: "Carting distance",
        value: Number(carting),
        source: "derived",
      });
    }
  }

  if (flooringWorkArea && demolitionWorkArea) {
    upsertPatch(patches, {
      work_area_id: flooringWorkArea.id,
      key: "flooring.disposal_included",
      label: "Flooring disposal included",
      value: false,
      source: "derived",
    });
  }

  if (patches.length === 0) {
    return params.projectFacts;
  }

  const next = [...params.projectFacts];
  for (const patch of patches) {
    const index = next.findIndex(
      (fact) =>
        fact.key === patch.key && fact.work_area_id === patch.work_area_id
    );
    if (index >= 0) {
      const existing = next[index]!;
      if (existing.source === "user") continue;
      next[index] = {
        ...existing,
        value: patch.value,
        source: patch.source,
      };
    } else {
      next.push({
        key: patch.key,
        work_area_id: patch.work_area_id,
        value: patch.value,
        source: patch.source,
      });
    }
  }

  return next;
}
