/** Area-priced pergola rows written before the measured calculator. */

export const MEASURED_PERGOLA_UPGRADE_EXPLANATION =
  "This pergola was priced by area. Updating it builds the measured breakdown and may ask for more details. The Pricing draft keeps its current total until you apply the update.";

const LEGACY_AREA_LABELS = new Set(["Pergola labour", "Pergola frame/materials"]);

export function isLegacyAreaPricedPergolaLine(input: {
  readonly label?: string | null;
  readonly notes?: string | null;
  readonly componentKey?: string | null;
  readonly materialBuildUps?: readonly { readonly key?: string | null }[] | null;
}): boolean {
  const component = input.componentKey ?? "";
  if (component.startsWith("pergola.")) return false;
  if (input.materialBuildUps?.some((row) => row.key === "pergola_area")) return true;
  const notes = input.notes ?? "";
  if (notes.includes("pergola_area")) return true;
  return LEGACY_AREA_LABELS.has((input.label ?? "").trim());
}
