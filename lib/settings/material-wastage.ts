export type MaterialWastageCategory =
  | "default"
  | "decking"
  | "sheet_material"
  | "flooring"
  | "paint"
  | "timber_framing";

export type MaterialWastageSettings = {
  defaultMaterialWastagePercent?: number | null;
  deckingWastagePercent?: number | null;
  sheetMaterialWastagePercent?: number | null;
  flooringWastagePercent?: number | null;
  paintWastagePercent?: number | null;
  timberFramingWastagePercent?: number | null;
};

const WASTAGE_MIN = 0;
const WASTAGE_MAX = 50;
const FALLBACK_DEFAULT_PERCENT = 10;

const CATEGORY_FIELD: Record<
  Exclude<MaterialWastageCategory, "default">,
  keyof MaterialWastageSettings
> = {
  decking: "deckingWastagePercent",
  sheet_material: "sheetMaterialWastagePercent",
  flooring: "flooringWastagePercent",
  paint: "paintWastagePercent",
  timber_framing: "timberFramingWastagePercent",
};

function clampWastagePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return FALLBACK_DEFAULT_PERCENT;
  }
  return Math.min(WASTAGE_MAX, Math.max(WASTAGE_MIN, value));
}

function readPercent(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }
  return clampWastagePercent(Number(value));
}

export function resolveMaterialWastage(
  settings: MaterialWastageSettings | null | undefined,
  category: MaterialWastageCategory
): number {
  if (category === "default") {
    return (
      readPercent(settings?.defaultMaterialWastagePercent) ??
      FALLBACK_DEFAULT_PERCENT
    );
  }

  const categoryValue = readPercent(settings?.[CATEGORY_FIELD[category]]);
  if (categoryValue != null) {
    return categoryValue;
  }

  return resolveMaterialWastage(settings, "default");
}
