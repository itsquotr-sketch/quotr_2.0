import { getCombinedLabourAccessFactor } from "@/lib/estimate/adjustments";
import { getBooleanFact, getNumberFact, getStringFact, round2 } from "@/lib/estimate/facts";
import { createLabourLineItem, createRateLineItem } from "@/lib/estimate/line-items";
import { findCompanyProductivityRate } from "@/lib/estimate/productivity";
import { rateUnitsMatch, resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { baseConfidence } from "@/lib/estimate/summary";
import { resolveLegacyWorkAreaAccess } from "@/lib/project-conditions/legacy-adapter";
import { pergolaScope } from "@/lib/scopes/templates/pergola";
import { PERGOLA_SCOPE_GAP, pergolaFrameKey, pergolaPackageKey, pergolaPackageRequired, pergolaPostKey } from "@/lib/estimate/pergola-specification";
import type { CalculatorResult, EstimateContext, EstimateWorkArea, LineItemCategory } from "@/lib/estimate/types";

export const PERGOLA_CALCULATOR_CONSUMED_FACTS = pergolaScope.questions.map(q => q.factKey);

/** Physical quantities only. Legacy m² frame and footing allowances never enter new estimates. */
export function calculatePergola(context: EstimateContext, workArea: EstimateWorkArea): CalculatorResult {
  const lineItems: CalculatorResult["lineItems"] = [];
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions: string[] = [];
  const n = (key: string) => getNumberFact(context.facts, workArea.id, `pergola.${key}`);
  const s = (key: string) => getStringFact(context.facts, workArea.id, `pergola.${key}`) ?? "";
  const b = (key: string) => getBooleanFact(context.facts, workArea.id, `pergola.${key}`);
  const gap = (text: string) => { missingInfo.push(`${workArea.name}: ${PERGOLA_SCOPE_GAP} ${text}`); };
  const positive = (key: string) => { const value = n(key); return value !== null && value > 0 ? value : null; };
  const whole = (key: string) => { const value = n(key); return value !== null && value >= 0 && Number.isInteger(value) ? value : null; };
  const length = positive("length_m"), width = positive("width_m");
  const area = length && width ? round2(length * width) : null;
  const material = s("material");
  const layout = s("attached");
  const roof = s("roof_type");
  const packageRequired = pergolaPackageRequired(material, roof);
  const fullPackage = s("package_mode") === "Supply and installation";
  const supplyPackage = s("package_mode") === "Supply only";
  const enclosed = /enclosed/i.test(layout);
  const attached = (/attach|wall.mount/i.test(layout) && !/unattached/i.test(layout)) || (enclosed && b("house_attachment") === true);
  const labourAdjustment = getCombinedLabourAccessFactor({ constraints: context.constraints,
    workAreaAccess: resolveLegacyWorkAreaAccess({ constraints: context.constraints, facts: context.facts, workAreaId: workArea.id, workAreaType: "pergola" }) });

  const rateLine = (key: string, label: string, quantity: number, unit: string, category: LineItemCategory = "materials", notes = "", component = key) => {
    const rateType = category === "subcontractor" ? "subcontractor" : "material";
    const rate = resolveRate({ rates: context.rates, rateType, itemKey: key, workAreaType: "pergola", unit,
      fallbackCostRate: 0, fallbackSellRate: 0, organisationSettings: context.organisationSettings });
    const company = context.rates.some(r => r.active && r.item_key === key && r.rate_type === rateType &&
      r.cost_rate !== null && r.cost_rate >= 0 && rateUnitsMatch(r.unit, unit));
    const priced = company && Number.isFinite(rate.costRate) && rate.costRate >= 0;
    if (!priced) gap(`Add the ${label.toLowerCase()} company cost (${unit}).`);
    lineItems.push(createRateLineItem({ workAreaId: workArea.id, workAreaName: workArea.name, label, category,
      quantity, unit, costRate: priced ? rate.costRate : 0, sellRate: priced ? rate.sellRate : 0,
      rateSource: priced ? rate.sourceLabel : "Pricing required", rateSourceType: priced ? "user_rate" : "missing",
      itemKey: key, componentKey: component, notes: `${notes}${priced ? "" : " Pricing required. No component cost is assumed."}`.trim(),
      sortOrder: lineItems.length + 1, organisationSettings: context.organisationSettings }));
  };
  const labour = (task: string, label: string, quantity: number, unit: string, notes = "") => {
    const key = `pergola.measured.${task}.hours_per_${unit}`;
    const productivity = findCompanyProductivityRate(context.rates, key, unit);
    const hourly = resolveLabourRate({ rates: context.rates, organisationSettings: context.organisationSettings,
      trade: task === "hole_dig" || task === "concrete_place" || task === "removal" ? "labourer" : "carpenter" });
    const hours = productivity?.cost_rate;
    const valid = hours !== null && hours !== undefined && Number.isFinite(hours) && hours > 0;
    if (!valid) gap(`Add ${label.toLowerCase()} productivity (hours/${unit}) in Rates.`);
    if (!(hourly.costRate > 0)) gap(`Add the hourly labour cost for ${label.toLowerCase()}.`);
    lineItems.push(createLabourLineItem({ workAreaId: workArea.id, workAreaName: workArea.name, label,
      quantity, unit, productivityHoursPerUnit: valid ? hours : 0,
      labourCostRate: hourly.costRate, labourSellRate: hourly.sellRate, adjustmentFactor: labourAdjustment,
      rateSource: valid && hourly.costRate > 0 ? hourly.sourceLabel : "Pricing required",
      rateSourceType: valid && hourly.costRate > 0 ? hourly.sourceType : "missing",
      productivitySourceType: valid ? "user_rate" : "missing", itemKey: key, componentKey: key,
      notes: `${notes} ${valid ? "Company productivity." : "Pricing required: formation / installation hours are not assumed."}`.trim(),
      sortOrder: lineItems.length + 1, organisationSettings: context.organisationSettings }));
  };
  const result = () => ({ lineItems, missingInfo: [...new Set(missingInfo)], assumptions, exclusions, confidence: baseConfidence(missingInfo.length) });

  if (!area) gap("Confirm positive length and width. No assumed area or deck area is used.");
  if (!/^(Timber|Aluminium|Steel)$/i.test(material)) gap("Confirm pergola material.");
  if (!["Wall-mounted (attached)", "Freestanding", "Semi-enclosed or enclosed"].includes(layout)) gap("Confirm the mounting / enclosure layout.");
  if (!["Louvred", "Fixed / permanent", "Open-rafter / slat"].includes(roof)) gap("Confirm roof arrangement.");
  if (s("engineering_or_consent_status") !== "Confirmed") gap("Confirm the structural design and consent basis.");
  if (attached && b("attachment_confirmed") !== true) gap("House attachment, flashing and existing structure are not confirmed.");
  if (enclosed && b("house_attachment") === null) gap("Confirm whether this enclosed layout is connected to an existing building.");
  if (enclosed) gap("Enclosure walls, doors, glazing and services require separately measured and priced work areas. This pergola takeoff does not price them.");
  if (!positive("height_m")) gap("Confirm above-ground post height.");
  if (whole("post_count") === null) gap("Confirm the integer upright post count.");

  if (packageRequired) {
    if (!fullPackage && !supplyPackage) gap("Confirm subcontract supply only or supply and installation, including package coverage.");
    else if (area) {
      rateLine(pergolaPackageKey(material, roof, s("package_mode")), `${/louvr/i.test(roof) ? "Louvred" : material} pergola · ${s("package_mode").toLowerCase()}`, area, "m2", "subcontractor",
        "Complete selected frame, roof and supports. Confirm supplier exclusions. Contractor fixings are separate only when specified.");
      if (supplyPackage) labour("kit_install", "Supplied pergola installation", area, "m2");
    }
  } else if (material === "Timber" && roof) {
    const count = whole("post_count"), height = positive("height_m");
    const species = s("timber_type"), section = s("post_section"), treatment = s("post_treatment");
    const foundation = s("foundation_method");
    const embedded = foundation === "Embedded in concrete", fixed = foundation === "Fixed to existing base";
    if (count === null) gap("Confirm the integer upright post count.");
    if (!height) gap("Confirm above-ground post height.");
    if (!species) gap("Confirm timber species.");
    if (!section || !treatment) gap("Confirm post section and treatment.");
    if (section === "Custom" && b("post_specification") !== true) gap("Confirm the custom post specification and rate basis.");
    if (!embedded && !fixed) gap("Confirm the post support method. Holes and anchors are not assumed.");
    if (b("treatment_confirmed") !== true) gap("Confirm treatment suitability for the selected post exposure and structural function.");
    const waste = n("waste_percent");
    const wasteKnown = waste !== null && waste >= 0 && waste <= 100;
    if (!wasteKnown) gap("Confirm timber supply waste (0 is valid).");
    const supplyFactor = wasteKnown ? 1 + waste / 100 : 1;
    if (!wasteKnown) assumptions.push("Timber quantities shown are net requirements; purchase waste is unresolved.");
    const embedment = embedded ? positive("embedment_m") : fixed ? 0 : null;
    if (embedded && !embedment) gap("Confirm post embedment before calculating full post lengths.");
    if (count !== null && count > 0 && height) {
      labour("post_install", "Upright post installation", round2(count * height), "lm", "Above-ground installed post length; below-ground setting is covered by the excavation and concreting tasks.");
      if (embedment !== null && species && section && treatment && (section !== "Custom" || b("post_specification") === true)) {
        rateLine(pergolaPostKey(species, section, treatment), `Pergola posts · ${species} · ${section} · ${treatment}`,
          round2(count * (height + embedment) * supplyFactor), "lm", "materials",
          `${count} × (${height} m above ground + ${embedment} m embedment); supply waste ${wasteKnown ? `${waste}% once` : "unresolved"}.`);
      }
      if (fixed) {
        if (b("base_confirmed") !== true) gap("Existing base and anchor design not confirmed.");
        else {
          rateLine("pergola.measured.anchor.each", "Post base / anchor sets", count, "each");
          labour("anchor_install", "Post anchor installation", count, "each");
        }
      }
      if (embedded) {
        const diameter = positive("hole_diameter_m"), depth = positive("hole_depth_m");
        if (!diameter || !depth || !["Soil", "Clay", "Rock", "Mixed"].includes(s("ground")) || !["Hand", "Auger", "Machine"].includes(s("excavation_method"))) gap("Confirm hole dimensions, ground and excavation method.");
        else if (embedment !== null && embedment > depth) gap("Post embedment exceeds hole depth. Check the foundation dimensions.");
        else labour("hole_dig", "Post-hole excavation", count, "hole", `${diameter} m diameter × ${depth} m deep; ${s("ground")}; ${s("excavation_method")}.`);
        if (!["Retained on site", "Removed"].includes(s("spoil"))) gap("Confirm excavation spoil handling.");
        if (s("spoil") === "Removed") gap("Excavation spoil cartage and disposal require a separate quantity and price.");
        let bags = whole("concrete_bags");
        const yieldM3 = positive("bag_yield_m3");
        const postWidth = section === "100x100" ? 0.1 : section === "125x125" ? 0.125 : null;
        if (bags === null && diameter && depth && embedment !== null && yieldM3 && postWidth && embedment <= depth) {
          const volume = (Math.PI * (diameter / 2) ** 2 * depth - postWidth ** 2 * embedment) * count;
          if (volume > 0 && diameter > postWidth * Math.SQRT2) {
            bags = Math.ceil(volume / yieldM3);
            assumptions.push(`Concrete: ${volume.toFixed(4)} m³ net of embedded timber ÷ ${yieldM3} m³/bag; round up once to ${bags} bags. No concrete waste assumed.`);
          }
        }
        if (bags !== null && bags > 0) {
          rateLine("pergola.measured.concrete.bag", "Post concrete", bags, "bag");
          labour("concrete_place", "Post concreting", bags, "bag");
        } else gap("Confirm concrete bag total or compatible hole dimensions, embedment and selected bag yield.");
      }
    }
    const frameSection = s("frame_section"), frameLayout = s("frame_layout");
    let beams: number | null = null, rafters: number | null = null;
    if (b("frame_design_confirmed") !== true) gap("Confirm member sizes, spans, layout and connections before framing takeoff.");
    else if (frameLayout === "Measured member totals") { beams = positive("beam_lm"); rafters = positive("rafter_lm"); }
    else if (frameLayout === "Rectangular perimeter with internal infill" && length && width) {
      const spacing = positive("rafter_spacing_mm"), direction = s("rafter_direction");
      if (spacing && spacing >= 50 && (direction === "Span width" || direction === "Span length")) {
        const run = direction === "Span width" ? length : width;
        const span = direction === "Span width" ? width : length;
        const rafterCount = Math.max(0, Math.ceil(Number((run / (spacing / 1000)).toFixed(8))) - 1);
        if (rafterCount <= 10000) {
          beams = 2 * (length + width); rafters = rafterCount * span;
          assumptions.push(`Confirmed rectangular perimeter: 2 × (${length} + ${width}) = ${beams} lm; ${rafterCount} rafters spanning ${span} m at maximum ${spacing} mm centres, inside the perimeter. End members and an attached ledger are counted in the perimeter once. Nominal member lengths; use measured totals for a cut / joint schedule.`);
        }
      }
    }
    if (!beams || rafters === null) gap("Confirm beam and rafter totals, or a rectangular layout, span direction and rafter spacing.");
    if (!frameSection || (frameSection === "Custom" && b("frame_specification") !== true)) gap("Confirm the beam / rafter member specification and rate basis.");
    else if (beams && rafters !== null && species) {
      const frameKey = pergolaFrameKey(species, frameSection);
      rateLine(frameKey, `Perimeter beams · ${species} · ${frameSection}`, round2(beams * supplyFactor), "lm", "materials", `Net ${round2(beams)} lm; waste ${wasteKnown ? waste : "unresolved"}%.`, "pergola.perimeter_timber");
      if (rafters > 0) rateLine(frameKey, `Rafters / infill · ${species} · ${frameSection}`, round2(rafters * supplyFactor), "lm", "materials", `Net ${round2(rafters)} lm; waste ${wasteKnown ? waste : "unresolved"}%.`, "pergola.rafter_timber");
      labour("frame_install", "Perimeter and rafter installation", round2(beams + rafters), "lm", "Labour on net installed length, no supply waste.");
    }
    if (roof === "Open-rafter / slat" && b("top_slats_included") === null) gap("Confirm whether additional top slats are required above the structural rafters.");
    if (roof === "Fixed / permanent" || (roof === "Open-rafter / slat" && b("top_slats_included") === true)) {
      const roofCodes: Record<string, string> = { Polycarbonate: "polycarbonate", Acrylic: "acrylic", "Shade fabric": "shade_fabric", Slats: "slats", Colorsteel: "colorsteel", Other: "other" };
      const roofArea = positive("roof_area_m2"), covering = roof === "Open-rafter / slat" ? "slats" : roofCodes[s("roofing_type")];
      if (covering && roofArea && b("roof_spec_confirmed") === true) {
        rateLine(`pergola.measured.roof.${covering}.m2`, `${roof === "Open-rafter / slat" ? "Additional top slats" : s("roofing_type")} roof covering`, roofArea, "m2", "materials", "Actual selected covering area; product coverage, pitch, overhangs and waste confirmed separately.");
        labour("roof_install", "Roof covering installation", roofArea, "m2");
      } else gap("Confirm roof product, actual covering area, coverage and waste.");
    }
    if (roof === "Open-rafter / slat") assumptions.push("Open rafters are included in the framing takeoff. Additional top slats are a separate covering quantity and installation task when requested.");
  }

  const fixings = whole("fixings_count");
  if (fixings === null) gap("Confirm separately supplied fixing sets, or enter 0 when package fixings cover them.");
  else if (fixings > 0) rateLine("pergola.measured.fixings.each", "Contractor fixing / bracket sets", fixings, "each");
  if (attached && b("attachment_confirmed") === true && !packageRequired) {
    const attachmentLength = positive("attachment_lm");
    if (attachmentLength) rateLine("pergola.measured.attachment.lm", "House attachment / flashing", attachmentLength, "lm", "subcontractor", "Attachment and flashing work only; ledger timber is in the perimeter takeoff.");
    else gap("Confirm measured house attachment length.");
  }
  if (b("removal_included") === null) gap("Confirm existing pergola removal scope.");
  if (b("removal_included") === true) {
    const removalArea = positive("removal_area_m2");
    if (removalArea) labour("removal", "Existing pergola removal", removalArea, "m2");
    else gap("Measure the existing pergola removal area independently of the new structure.");
    gap("Existing pergola disposal and hazardous-materials work need separate scoped pricing; removal labour does not cover them.");
  }
  if (b("gutters_included") === null) gap("Confirm gutter scope.");
  if (b("gutters_included") === true) {
    const gutter = positive("gutter_lm");
    if (gutter) rateLine("pergola.measured.gutter.lm", "Pergola gutter", gutter, "lm");
    else gap("Confirm gutter length. No perimeter gutter allowance is assumed.");
    gap("Gutter installation, downpipes and drainage connection require separate scoped pricing; gutter material does not cover them.");
  }
  if (b("finish_required") === null) gap("Confirm painting / staining scope.");
  if (b("finish_required") === true) gap("Requested painting / staining requires a measured specification and separate price.");
  return result();
}
