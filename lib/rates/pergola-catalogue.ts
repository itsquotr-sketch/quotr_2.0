import type { RateCatalogueEntry } from "@/lib/rates/types";
import { PERGOLA_TIMBERS, pergolaPostKey, pergolaFrameKey } from "@/lib/estimate/pergola-specification";
const entry = (item_key: string, label: string, unit: string, rate_type = "material"): RateCatalogueEntry => ({
  item_key, label, unit, rate_type, work_area_type: "pergola", recommended: false,
  category: rate_type === "productivity" ? "labour" : rate_type === "subcontractor" ? "subcontractor" : "material",
  calculatorSupport: "used_now", description: "Measured pergola component. Enter a company cost or productivity. No legacy area-package fallback.",
});
export const PERGOLA_MEASURED_RATE_CATALOGUE: RateCatalogueEntry[] = [
  ...PERGOLA_TIMBERS.filter(s => s !== "Not sure").flatMap(species => [
    ...["100x100", "125x125", "Custom"].flatMap(size => ["H3.2", "H4", "H5", "Design specified"].map(treatment =>
      entry(pergolaPostKey(species, size, treatment), `Pergola posts · ${species} · ${size} · ${treatment}`, "lm"))),
    ...["140x45 H3.2", "Custom"].map(section => entry(pergolaFrameKey(species, section), `Pergola framing · ${species} · ${section}`, "lm")),
  ]),
  ...["aluminium", "steel", "louvred"].flatMap(material => ["supply", "supply_install"].map(mode =>
    entry(`pergola.measured.package.${material}.${mode}.m2`, `Pergola ${material} · ${mode === "supply" ? "supply only" : "supply and installation"}`, "m2", "subcontractor"))),
  ...["polycarbonate", "acrylic", "shade_fabric", "slats", "colorsteel", "other"].map(roof =>
    entry(`pergola.measured.roof.${roof}.m2`, `Pergola covering · ${roof.replaceAll("_", " ")}`, "m2")),
  entry("pergola.measured.fixings.each", "Pergola contractor fixings / brackets", "each"),
  entry("pergola.measured.anchor.each", "Pergola post base / anchor set", "each"),
  entry("pergola.measured.concrete.bag", "Pergola selected bagged concrete", "bag"),
  entry("pergola.measured.gutter.lm", "Pergola gutter", "lm"),
  entry("pergola.measured.attachment.lm", "Pergola house attachment / flashing", "lm", "subcontractor"),
  ...([
    ["post_install", "Post installation", "lm"], ["frame_install", "Frame and rafter installation", "lm"],
    ["hole_dig", "Post-hole excavation for confirmed ground and method", "hole"],
    ["concrete_place", "Post concreting", "bag"], ["anchor_install", "Post anchor installation", "each"],
    ["kit_install", "Supplied pergola installation", "m2"], ["roof_install", "Roof covering installation", "m2"],
    ["removal", "Existing pergola removal", "m2"],
  ] as const).map(([key, label, unit]) => entry(`pergola.measured.${key}.hours_per_${unit}`, label, unit, "productivity")),
];
