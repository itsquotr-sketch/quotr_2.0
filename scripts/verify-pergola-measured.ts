import { measuredPergolaRateKey } from "../lib/rates/pergola-stale";
import { listMaterialsPageCatalogueEntries } from "../lib/rates/material-registry";
import { subcontractRatesCatalogue } from "../lib/rates/rates-workspace-summary";
import { listRegisteredProductivityCatalogueEntries } from "../lib/rates/productivity-registry";
/** Measured pergola commercial contract. All prices here are test fixtures, not benchmarks. */
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { PERGOLA_MEASURED_RATE_CATALOGUE } from "../lib/rates/pergola-catalogue";
import { pergolaFrameKey, pergolaPostKey } from "../lib/estimate/pergola-specification";
import { hidePergolaQuestion } from "../lib/scopes/pergola-questions";
import { normaliseAIExtraction } from "../lib/scopes/normalise-extracted-facts";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { detailsSectionForCandidate } from "../lib/assistant/clarify/details-groups";
import { parseClarifyNumber, parsePositiveClarifyNumber } from "../lib/assistant/clarify/numeric";
import type { ClarifyCandidate } from "../lib/assistant/clarify/types";
import { pergolaScope } from "../lib/scopes/templates/pergola";
import { classifyReviewNotice, issuesFromEstimateRecord } from "../lib/assistant/presentation/estimate-issues";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { getComponentStarterRatesForWorkType } from "../lib/setup/starter-rates";
import type { EstimateContext, EstimateWorkArea } from "../lib/estimate/types";
import type { OrganisationRate } from "../components/setup/types";

let passed = 0, failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (ok) passed++; else failed++;
}
const area: EstimateWorkArea = { id: "pergola-1", type: "pergola", name: "Pergola", sort_order: 1 };
const settings = { allow_benchmark_rates: true, default_margin_percent: 20, default_contingency_percent: 0, prefer_user_rates: true } as EstimateContext["organisationSettings"];
const base: Record<string, unknown> = {
  material: "Timber", attached: "Freestanding", roof_type: "Open-rafter / slat",
  length_m: 4, width_m: 3, height_m: 2.4, post_count: 4,
  timber_type: "Treated Pine", post_section: "100x100", post_treatment: "H5",
  treatment_confirmed: true, foundation_method: "Embedded in concrete", embedment_m: 0.6,
  hole_diameter_m: 0.3, hole_depth_m: 0.7, ground: "Soil", excavation_method: "Hand", spoil: "Retained on site", bag_yield_m3: 0.01,
  frame_section: "140x45 H3.2", frame_layout: "Rectangular perimeter with internal infill", frame_design_confirmed: true,
  rafter_spacing_mm: 450, rafter_direction: "Span width", waste_percent: 10, top_slats_included: false,
  fixings_count: 8, removal_included: false, gutters_included: false, finish_required: false, engineering_or_consent_status: "Confirmed",
};
function rate(key: string, type: string, unit: string, cost: number, sell: number | null = null): OrganisationRate {
  return { id: key, rate_type: type, item_key: key, work_area_type: "pergola", trade: null, label: key, unit, cost_rate: cost, sell_rate: sell, markup_percent: null, active: true };
}
const fixtureRates: OrganisationRate[] = PERGOLA_MEASURED_RATE_CATALOGUE.map(entry =>
  rate(entry.item_key, entry.rate_type, entry.unit, entry.rate_type === "productivity" ? 0.1 : 10));
fixtureRates.push(rate("labour.carpenter.hour", "labour", "hour", 60), rate("labour.labourer.hour", "labour", "hour", 40));
function context(overrides: Record<string, unknown> = {}, rates = fixtureRates): EstimateContext {
  return { project: { id: "p", qualityLevel: "standard" }, confirmedWorkAreas: [area],
    facts: Object.entries({ ...base, ...overrides }).filter(([, value]) => value !== undefined).map(([key, value]) => ({ key: `pergola.${key}`, value, work_area_id: area.id })),
    constraints: [], rates, organisationSettings: settings, materialWastageSettings: null };
}
function run(overrides: Record<string, unknown> = {}, rates = fixtureRates) { return calculatePergola(context(overrides, rates), area); }
const line = (result: ReturnType<typeof run>, key: string) => result.lineItems.find(item => item.itemKey === key);
const task = (result: ReturnType<typeof run>, key: string) => line(result, `pergola.measured.${key}`);
const fixed = { foundation_method: "Fixed to existing base", base_confirmed: true };
const result = run();
check("complete confirmed timber fixture has no gap", result.missingInfo.length === 0);
check("post purchase includes embedment and waste once: 13.2 lm", line(result, pergolaPostKey("Treated Pine", "100x100", "H5"))?.quantity === 13.2);
const frames = result.lineItems.filter(item => item.itemKey === pergolaFrameKey("Treated Pine", "140x45 H3.2"));
check("perimeter timber 14 net / 15.4 purchased lm", frames[0]?.quantity === 15.4);
check("eight internal rafters x 3 m with waste = 26.4 lm", frames[1]?.quantity === 26.4);
check("framing labour is 38 net lm, not wasted timber", task(result, "frame_install.hours_per_lm")?.quantity === 38);
check("post installation uses 9.6 lm above ground", task(result, "post_install.hours_per_lm")?.quantity === 9.6);
check("hole labour counts four holes", task(result, "hole_dig.hours_per_hole")?.quantity === 4);
check("concrete deducts post displacement and rounds bags once", task(result, "concrete.bag")?.quantity === 18);
check("concreting hours follow bags", task(result, "concrete_place.hours_per_bag")?.labourHours === 1.8);
check("beams and rafters keep distinct commercial identities", frames[0]?.componentKey !== frames[1]?.componentKey);
check("all emitted component identities are distinct", new Set(result.lineItems.map(item => item.componentKey)).size === result.lineItems.length);
check("integrated estimator retains both timber components", calculateEstimate(context()).lineItems.filter(item => item.itemKey === pergolaFrameKey("Treated Pine", "140x45 H3.2")).length === 2);
check("spacing exact multiple has no extra rafter", task(run({ length_m: 4.5 }), "frame_install.hours_per_lm")?.quantity === 42);
check("alternate span direction changes rafter quantities", run({ rafter_direction: "Span length" }).lineItems.find(item => item.componentKey === "pergola.rafter_timber")?.quantity === 26.4);
check("measured member schedule replaces geometric takeoff", task(run({ frame_layout: "Measured member totals", beam_lm: 18, rafter_lm: 27 }), "frame_install.hours_per_lm")?.quantity === 45);
const anchored = run(fixed);
check("fixed bases emit no excavation or concrete", !anchored.lineItems.some(item => /hole_dig|concrete/.test(item.itemKey ?? "")));
check("fixed posts have no embedment", line(anchored, pergolaPostKey("Treated Pine", "100x100", "H5"))?.quantity === 10.56);
check("anchors counted separately", task(anchored, "anchor.each")?.quantity === 4);
check("unknown base does not invent anchors", !task(run({ ...fixed, base_confirmed: false }), "anchor.each"));
check("unknown holes keep independent frame visible", !!task(run({ hole_depth_m: undefined }), "frame_install.hours_per_lm"));
check("unknown concrete yield does not invent bag quantity", !task(run({ bag_yield_m3: undefined }), "concrete.bag"));
check("explicit bag total wins over calculated bags", task(run({ concrete_bags: 21 }), "concrete.bag")?.quantity === 21);
check("fractional post count stays unresolved", run({ post_count: 3.5 }).missingInfo.some(text => /integer upright/.test(text)));
check("unsupported post section receives no guessed price", run({ post_section: "Custom", post_specification: false }).lineItems.every(item => !/post\..*custom/.test(item.itemKey ?? "")));
check("unknown design withholds framing quantities", !task(run({ frame_design_confirmed: false }), "frame_install.hours_per_lm"));
check("unknown waste remains a visible gap", run({ waste_percent: undefined }).missingInfo.some(text => /supply waste/.test(text)));
check("negative waste not accepted", run({ waste_percent: -5 }).missingInfo.some(text => /supply waste/.test(text)));
check("no legacy area fallback", run({ length_m: undefined, width_m: undefined, area_m2: 99 }).missingInfo.some(text => /positive length and width/.test(text)));
const noRates = run({}, []);
check("missing new component costs do not fall back to old packages", noRates.lineItems.every(item => item.recommendedCost === 0));
check("missing productivity is labelled missing", task(noRates, "post_install.hours_per_lm")?.rateSourceType === "missing");
const legacy = run({}, [rate("pergola.material.timber.m2", "material", "m2", 9999), rate("scope.pergola.m2", "scope", "m2", 9999)]);
check("old company square-metre rates cannot charge new work", legacy.lineItems.every(item => item.recommendedCost === 0));
const roof = run({ roof_type: "Fixed / permanent", roofing_type: "Polycarbonate", roof_area_m2: 14, roof_spec_confirmed: true });
check("actual roof area overrides footprint", task(roof, "roof.polycarbonate.m2")?.quantity === 14);
check("roof installation uses actual roof area", task(roof, "roof_install.hours_per_m2")?.quantity === 14);
check("open rafters do not invent covering", !task(result, "roof.slats.m2"));
check("additional slats remain distinct from structural rafters", task(run({ top_slats_included: true, roof_area_m2: 12, roof_spec_confirmed: true }), "roof.slats.m2")?.quantity === 12);
for (const material of ["Aluminium", "Steel"]) {
  const supply = run({ material, package_mode: "Supply only" });
  const full = run({ material, package_mode: "Supply and installation" });
  check(`${material} supply-only charges one complete supply package`, supply.lineItems.filter(item => item.category === "subcontractor").length === 1);
  check(`${material} supply-only suppresses component materials except contractor fixings`, supply.lineItems.filter(item => item.category === "materials").every(item => item.itemKey === "pergola.measured.fixings.each"));
  check(`${material} supply-only keeps installation`, task(supply, "kit_install.hours_per_m2")?.quantity === 12);
  check(`${material} full package does not duplicate installation`, full.lineItems.every(item => item.category !== "labour"));
}
const louvred = run({ roof_type: "Louvred", package_mode: "Supply and installation", fixings_count: 0 });
check("louvred timber selection routes to subcontract instead of frame", louvred.lineItems.length === 1 && task(louvred, "package.louvred.supply_install.m2")?.quantity === 12);
check("unknown package mode does not invent subcontract", run({ material: "Steel", package_mode: "Not sure" }).lineItems.every(item => item.category !== "subcontractor"));
const attached = run({ attached: "Wall-mounted (attached)", attachment_confirmed: true, attachment_lm: 4 });
check("attachment flashing priced per confirmed length", task(attached, "attachment.lm")?.quantity === 4);
check("ledger timber stays in perimeter once", attached.lineItems.find(item => item.componentKey === "pergola.perimeter_timber")?.quantity === 15.4);
check("unknown attachment remains unresolved", run({ attached: "Wall-mounted (attached)" }).missingInfo.some(text => /House attachment/.test(text)));
check("semi-enclosure cannot be silently complete", run({ attached: "Semi-enclosed or enclosed", enclosure_confirmed: true }).missingInfo.some(text => /Enclosure walls/.test(text)));
check("removal uses its own measured area", task(run({ removal_included: true, removal_area_m2: 20 }), "removal.hours_per_m2")?.quantity === 20);
check("removal acknowledgement cannot erase disposal gap", run({ removal_included: true, removal_area_m2: 20, removal_disposal_resolved: true }).missingInfo.some(text => /disposal and hazardous/.test(text)));
check("gutters use measured length, not perimeter", task(run({ gutters_included: true, gutter_lm: 4 }), "gutter.lm")?.quantity === 4);
check("gutter material does not imply downpipe and installation price", run({ gutters_included: true, gutter_lm: 4, gutter_scope_resolved: true }).missingInfo.some(text => /downpipes/.test(text)));
const missingScope = run({ finish_required: true });
check("requested finish cannot silently disappear", missingScope.missingInfo.some(text => /painting \/ staining/.test(text)));
check("finish acknowledgement does not price the finish", run({ finish_required: true, finish_scope_resolved: true }).missingInfo.some(text => /painting \/ staining/.test(text)));
check("explicit zero fixings is a complete answer", !run({ fixings_count: 0 }).missingInfo.some(text => /fixing sets/.test(text)) && !task(run({ fixings_count: 0 }), "fixings.each"));
check("every unpriced scope message participates in completeness", missingScope.missingInfo.every(text => classifyReviewNotice(text) === "scope_gap"));
check("complete priced lines do not hide scope gap", issuesFromEstimateRecord({ lineItems: missingScope.lineItems, notices: missingScope.missingInfo }).scopeCoverageGapCount > 0);
const hidden = (name: string, values: Record<string, unknown>) => hidePergolaQuestion(`pergola.${name}`, key => values[key]);
check("metal package hides timber questions", hidden("post_section", { material: "Steel" }) === true);
check("fixed bases hide hole questions", hidden("hole_depth_m", { material: "Timber", foundation_method: "Fixed to existing base" }) === true);
check("open rafters hide fixed roof product question", hidden("roofing_type", base) === true);
check("slatted roof exposes covering quantity", hidden("roof_area_m2", { ...base, top_slats_included: true }) === false);
check("known bag total hides yield question", hidden("bag_yield_m3", { ...base, concrete_bags: 20 }) === true);
check("all questions permit a partial estimate", pergolaScope.questions.every(question => question.required === false));
check("new component catalogue has unique keys", new Set(PERGOLA_MEASURED_RATE_CATALOGUE.map(entry => entry.item_key)).size === PERGOLA_MEASURED_RATE_CATALOGUE.length);
check("onboarding offers component costs, never old area package", getComponentStarterRatesForWorkType("pergola").every(row => row.item_key.startsWith("pergola.measured.")));
function extracted(briefText: string) {
  return enrichExtractionFromBrief({ briefText, allowedTypes: ["pergola", "deck"], extraction: { workAreas: [], facts: [], assumptions: [], possibleConstraints: [], warnings: [], confidence: 0.5 } }).extraction;
}
check("attached timber does not become aluminium", extracted("Attached timber pergola.").facts.some(fact => fact.key === "pergola.material" && fact.value === "Timber"));
check("aluminium does not imply house attachment", !extracted("Aluminium pergola.").facts.some(fact => fact.key === "pergola.attached"));
check("unrelated steel does not set pergola material", !extracted("Timber deck on steel supports. Pergola material not confirmed.").facts.some(fact => fact.key === "pergola.material"));
check("hourly carpenter changes flag pergola estimates", measuredPergolaRateKey("labour.carpenter.hour"));
check("component cost changes flag pergola estimates", measuredPergolaRateKey("pergola.measured.concrete.bag"));
check("unrelated rates do not flag pergola estimates", !measuredPergolaRateKey("flooring.transition.strip"));
for (const entry of PERGOLA_MEASURED_RATE_CATALOGUE) {
  const visible = entry.rate_type === "productivity" ? listRegisteredProductivityCatalogueEntries() : entry.rate_type === "subcontractor" ? subcontractRatesCatalogue() : listMaterialsPageCatalogueEntries();
  check(`Rates exposes ${entry.item_key} in its editable section`, visible.some(row => row.item_key === entry.item_key));
}
function detailsFor(values: Record<string, unknown>) {
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas: [{ id: area.id, type: "pergola", name: "Pergola", status: "active" }],
    facts: Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => ({
      key: key.startsWith("pergola.") ? key : `pergola.${key}`,
      work_area_id: area.id,
      value,
    })),
    constraints: [],
    jobPlan: { cards: [] },
  });
}
const known = detailsFor(base);
const row = (view: ReturnType<typeof detailsFor>, name: string) => view.candidates.find(candidate => candidate.factKey === `pergola.${name}`);
const sectionLabels = (view: ReturnType<typeof detailsFor>) => view.groups.flatMap(group => group.sections.map(section => section.label));
check("known length stays visible and editable", row(known, "length_m")?.currentValue === 4 && row(known, "length_m")?.retainAnswered === true);
check("applicable hole questions stay visible for embedded posts", Boolean(row(known, "hole_depth_m")) && Boolean(row(known, "hole_diameter_m")));
check("fixed bases hide hole questions in Details", !row(detailsFor({ ...base, ...fixed }), "hole_depth_m") && Boolean(row(detailsFor({ ...base, ...fixed }), "base_confirmed")));
check("supplier packages hide timber component questions", !row(detailsFor({ material: "Aluminium", roof_type: "Louvred", package_mode: "Supply only", length_m: 4, width_m: 3, fixings_count: 0 }), "post_section") && Boolean(row(detailsFor({ material: "Aluminium", roof_type: "Louvred", package_mode: "Supply only", length_m: 4, width_m: 3, fixings_count: 0 }), "package_mode")));
const unresolved = detailsFor({ ...base, engineering_or_consent_status: "Not sure", length_m: undefined });
check("Not sure design basis stays unresolved and visible", row(unresolved, "engineering_or_consent_status")?.currentValue === "Not sure" && row(unresolved, "engineering_or_consent_status")?.assumable === false && row(unresolved, "engineering_or_consent_status")?.blocksEstimate === false);
check("missing applicable length stays in Details", row(unresolved, "length_m")?.currentValue == null);
check("explicit No stays visible", row(known, "removal_included")?.currentValue === "No");
check("explicit zero fixings stays visible", row(detailsFor({ ...base, fixings_count: 0 }), "fixings_count")?.currentValue === 0 && row(detailsFor({ ...base, fixings_count: 0 }), "fixings_count")?.allowZero === true);
check("enclosed layout can answer enclosure scope", Boolean(row(detailsFor({ ...base, attached: "Semi-enclosed or enclosed" }), "enclosure_confirmed")));
check("freestanding layout hides enclosure scope", !row(known, "enclosure_confirmed"));
check("removal Yes exposes disposal acknowledgement", Boolean(row(detailsFor({ ...base, removal_included: true }), "removal_disposal_resolved")));
check("gutter Yes exposes installation acknowledgement", Boolean(row(detailsFor({ ...base, gutters_included: true }), "gutter_scope_resolved")));
check("finish Yes exposes finish acknowledgement", Boolean(row(detailsFor({ ...base, finish_required: true }), "finish_scope_resolved")));
check("pergola questions do not block a partial estimate", known.candidates.filter(candidate => candidate.factKey?.startsWith("pergola.")).every(candidate => candidate.blocksEstimate === false && candidate.askClass === "ASSUME_IF_SKIPPED") && known.canEstimateNow === true && known.enoughToEstimate === true);
check("pergola Details are grouped", ["Dimensions", "Materials", "Structure", "Scope"].every(label => sectionLabels(known).includes(label)));
check("positive number parser still rejects zero", parsePositiveClarifyNumber("0").ok === false && parsePositiveClarifyNumber("4").ok === true);
check("fixing count parser accepts explicit zero", parseClarifyNumber("0", { allowZero: true }).ok === true && parseClarifyNumber("-1", { allowZero: true }).ok === false);
const deckOnly = composeClarifyView({
  stage: "quality",
  briefText: null,
  qualityLevel: "standard",
  workAreas: [{ id: "deck-1", type: "deck", name: "Deck", status: "active" }],
  facts: [],
  constraints: [],
  jobPlan: { cards: [] },
});
check("shared Details composition does not add pergola questions to a deck", deckOnly.candidates.every(candidate => !candidate.factKey?.startsWith("pergola.")));
check("deck length remains a dimensions question", detailsSectionForCandidate({ factKey: "deck.length_m", workAreaType: "deck", source: "scope_fact", writeTarget: "FACT", constraintKey: null } as ClarifyCandidate) === "dimensions");
const stripped = normaliseAIExtraction({
  workAreas: [{ type: "pergola", confidence: 0.9, rationale: "test" }],
  facts: [
    { work_area_type: "pergola", key: "pergola.post_section", label: "Post section", value: "100x100", confidence: 0.9 },
    { work_area_type: "pergola", key: "pergola.post_specification", label: "Custom post", value: "Yes", confidence: 0.9 },
    { work_area_type: "pergola", key: "pergola.frame_section", label: "Frame", value: "Custom", confidence: 0.9 },
    { work_area_type: "pergola", key: "pergola.frame_specification", label: "Custom frame", value: "Yes", confidence: 0.9 },
  ],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.9,
  warnings: [],
});
check("standard post does not keep a custom confirmation", !stripped.facts.some(fact => fact.key === "pergola.post_specification"));
check("custom frame confirmation is kept", stripped.facts.some(fact => fact.key === "pergola.frame_specification" && fact.value === "Yes"));
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
