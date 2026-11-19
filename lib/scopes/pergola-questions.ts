import { pergolaPackageRequired } from "@/lib/estimate/pergola-specification";
/** Return undefined for other work areas so their existing conditional rules apply. */
export function hidePergolaQuestion(key: string, value: (name: string) => unknown): boolean | undefined {
  if (!key.startsWith("pergola.")) return undefined;
  const name = key.slice(8);
  const text = (name: string) => String(value(name) ?? "");
  const yes = (name: string) => /^(true|yes)$/i.test(text(name));
  const material = text("material"), roof = text("roof_type");
  const pkg = pergolaPackageRequired(material, roof);
  const timber = material === "Timber" && !pkg;
  const embedded = text("foundation_method") === "Embedded in concrete";
  const fixed = text("foundation_method") === "Fixed to existing base";
  if (name === "package_mode") return !pkg;
  if (["timber_type", "post_section", "post_treatment", "treatment_confirmed", "foundation_method", "frame_section", "frame_layout", "frame_design_confirmed", "waste_percent"].includes(name)) return !timber;
  if (name === "post_specification") return !timber || text("post_section") !== "Custom";
  if (name === "frame_specification") return !timber || text("frame_section") !== "Custom";
  if (["rafter_spacing_mm", "rafter_direction"].includes(name)) return !timber || text("frame_layout") !== "Rectangular perimeter with internal infill";
  if (["beam_lm", "rafter_lm"].includes(name)) return !timber || text("frame_layout") !== "Measured member totals";
  if (["embedment_m", "hole_diameter_m", "hole_depth_m", "ground", "excavation_method", "spoil", "concrete_bags"].includes(name)) return !timber || !embedded;
  if (name === "bag_yield_m3") return !timber || !embedded || Number(value("concrete_bags")) > 0;
  if (name === "base_confirmed") return !timber || !fixed;
  if (name === "top_slats_included") return pkg || roof !== "Open-rafter / slat";
  if (name === "roofing_type") return pkg || roof !== "Fixed / permanent";
  if (["roof_area_m2", "roof_spec_confirmed"].includes(name)) return pkg || (roof !== "Fixed / permanent" && !(roof === "Open-rafter / slat" && yes("top_slats_included")));
  if (name === "house_attachment") return !/enclosed/i.test(text("attached"));
  if (["attachment_confirmed", "attachment_lm"].includes(name)) return !(/attach|wall.mount/i.test(text("attached")) || (/enclosed/i.test(text("attached")) && yes("house_attachment"))) || (name === "attachment_lm" && pkg);
  if (name === "enclosure_confirmed") return !/enclosed/i.test(text("attached"));
  if (["removal_area_m2", "removal_disposal_resolved"].includes(name)) return !yes("removal_included");
  if (["gutter_lm", "gutter_scope_resolved"].includes(name)) return !yes("gutters_included");
  if (name === "finish_scope_resolved") return !yes("finish_required");
  return false;
}

type ExtractedPergolaFact = {
  key: string;
  value: unknown;
  work_area_id?: string | null;
  work_area_type?: string | null;
};

/** A standard section is not a custom specification. Drop a Yes that the extractor attached to one. */
export function dropUngroundedPergolaConfirmations<T extends ExtractedPergolaFact>(
  facts: readonly T[]
): T[] {
  const customPost = new Set<string>();
  const customFrame = new Set<string>();
  for (const fact of facts) {
    const bucket = fact.work_area_id ?? fact.work_area_type ?? "";
    if (fact.key === "pergola.post_section" && fact.value === "Custom") customPost.add(bucket);
    if (fact.key === "pergola.frame_section" && fact.value === "Custom") customFrame.add(bucket);
  }
  return facts.filter((fact) => {
    const bucket = fact.work_area_id ?? fact.work_area_type ?? "";
    if (fact.key === "pergola.post_specification" && !customPost.has(bucket)) return false;
    if (fact.key === "pergola.frame_specification" && !customFrame.has(bucket)) return false;
    return true;
  });
}
