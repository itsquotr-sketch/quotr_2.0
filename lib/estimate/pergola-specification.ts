/** Physical pergola options. Sizes and spacing are estimating inputs, never span design. */
export const PERGOLA_TIMBERS = ["Treated Pine", "Hardwood", "Kwila", "Macrocarpa", "Cedar", "Other", "Not sure"];
export const PERGOLA_LAYOUTS = ["Wall-mounted (attached)", "Freestanding", "Semi-enclosed or enclosed", "Not sure"];
export const PERGOLA_ROOFS = ["Louvred", "Fixed / permanent", "Open-rafter / slat", "Not sure"];
export const PERGOLA_PACKAGES = ["Supply only", "Supply and installation", "Not sure"];
export function pergolaPackageRequired(material: string, roof: string): boolean {
  return /alumini?um|steel/i.test(material) || /louvr/i.test(roof);
}
export function pergolaPostKey(species: string, size: string, treatment: string): string {
  return `pergola.measured.post.${species.toLowerCase().replaceAll(" ", "_")}.${size.toLowerCase()}.${treatment.toLowerCase()}.lm`;
}
export function pergolaFrameKey(species: string, section: string): string {
  return `pergola.measured.frame.${species.toLowerCase().replaceAll(" ", "_")}.${section.toLowerCase().replaceAll(" ", "_")}.lm`;
}
export function pergolaPackageKey(material: string, roof: string, ownership: string): string {
  const family = /louvr/i.test(roof) ? "louvred" : material.toLowerCase();
  return `pergola.measured.package.${family}.${ownership === "Supply only" ? "supply" : "supply_install"}.m2`;
}

export const PERGOLA_SCOPE_GAP = "Pergola scope unresolved:";
