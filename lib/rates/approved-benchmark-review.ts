/**
 * Owner-approved productivity from the 11 October 2026 benchmark workbook.
 * Person-hours per output unit. Not a sell rate.
 * Company and calibrated overrides still win in resolveProductivity.
 *
 * Workbook SHA-256: 11411f8a1de7df542a066998ef6a63b3db8adddfef7fd04783046abce4d7bf5b
 * Export retrieved: 2026-10-11T14:42:57+13:00 from the live Google Sheet.
 * Approved cost column formula is IF(ISNUMBER(current), ROUND(current, 2), "").
 * Do not apply a second 20% deduction.
 */
export const BENCHMARK_WORKBOOK_SHA256 =
  "11411f8a1de7df542a066998ef6a63b3db8adddfef7fd04783046abce4d7bf5b";
export const BENCHMARK_WORKBOOK_EXPORTED_AT = "2026-10-11T14:42:57+13:00";

export type ApprovedProductivity = {
  readonly hoursPerUnit: number;
  readonly unit: string;
  readonly workbookRow: number;
  readonly plain: string;
};

export const APPROVED_PRODUCTIVITY: Record<string, ApprovedProductivity> = {
  "painting.labour_hours_per_m2": { hoursPerUnit: 0.12, unit: "m2", workbookRow: 7, plain: "1 person 7.2 minutes per m2" },
  "internal_walls.lining.aqualine.hours_per_sheet": { hoursPerUnit: 0.5, unit: "sheet", workbookRow: 8, plain: "2 people 15 minutes per sheet" },
  "internal_walls.lining.barrierline.hours_per_sheet": { hoursPerUnit: 0.5, unit: "sheet", workbookRow: 9, plain: "2 people 15 minutes per sheet" },
  "internal_walls.lining.braceline.hours_per_sheet": { hoursPerUnit: 0.5, unit: "sheet", workbookRow: 10, plain: "2 people 15 minutes per sheet" },
  "internal_walls.lining.fyreline.hours_per_sheet": { hoursPerUnit: 0.5, unit: "sheet", workbookRow: 11, plain: "2 people 15 minutes per sheet" },
  "internal_walls.lining.noiseline.hours_per_sheet": { hoursPerUnit: 0.5, unit: "sheet", workbookRow: 12, plain: "2 people 15 minutes per sheet" },
  "internal_walls.lining.standard_gib.hours_per_sheet": { hoursPerUnit: 0.5, unit: "sheet", workbookRow: 13, plain: "2 people 15 minutes per sheet" },
  "internal_walls.lining.weatherline.hours_per_sheet": { hoursPerUnit: 0.5, unit: "sheet", workbookRow: 14, plain: "2 people 15 minutes per sheet" },
  "internal_walls.cornice.install.hours_per_lm": { hoursPerUnit: 0.1, unit: "lm", workbookRow: 15, plain: "2 people 3 minutes" },
  "internal_walls.skirting.install.hours_per_lm": { hoursPerUnit: 0.1, unit: "lm", workbookRow: 16, plain: "2 people 3 minutes" },
  "internal_walls.insulation.install.hours_per_m2": { hoursPerUnit: 0.06666666666666667, unit: "m2", workbookRow: 17, plain: "1 person 4 minutes" },
  "bathroom.lining.ceiling.install.hours_per_m2": { hoursPerUnit: 0.25, unit: "m²", workbookRow: 18, plain: "2 people 7.5 minutes" },
  "bathroom.lining.wall.install.hours_per_m2": { hoursPerUnit: 0.5 / (2.4 * 1.2), unit: "m2", workbookRow: 105, plain: "Owner 11 Oct 2026: 0.5 h per 2.88 m² GIB sheet. Workbook 0.29 is fibre cement, not this key." },
  "bathroom.lining.wall.fibre_cement.hours_per_m2": { hoursPerUnit: 0.29, unit: "m2", workbookRow: 105, plain: "Owner 11 Oct 2026: fibre cement 0.29 h/m² from the Hardies row." },
  "bathroom.demolition.ceiling.hours_per_m2": { hoursPerUnit: 0.2, unit: "m²", workbookRow: 19, plain: "1 person 12 minutes" },
  "ceilings.grid.install.hours_per_m2": { hoursPerUnit: 0.18, unit: "m2", workbookRow: 20, plain: "1 person 10.8 minutes per m2" },
  "ceilings.bulkhead.lining.install.hours_per_sheet": { hoursPerUnit: 0.25, unit: "sheet", workbookRow: 21, plain: "2 people 7.5 minutes" },
  "ceilings.bulkhead.framing.steel.install.hours_per_lm": { hoursPerUnit: 0.2, unit: "lm", workbookRow: 22, plain: "1 person 12 minutes" },
  "ceilings.bulkhead.framing.timber.install.hours_per_lm": { hoursPerUnit: 0.2, unit: "lm", workbookRow: 23, plain: "1 person 12 minutes" },
  "ceilings.steel.crossover_clip.install.hours_per_each": { hoursPerUnit: 0.015, unit: "each", workbookRow: 24, plain: "1 person 0.9 minutes per each" },
  "ceilings.steel.dropper.install.hours_per_each": { hoursPerUnit: 0.1, unit: "each", workbookRow: 25, plain: "1 person 6 minutes per each" },
  "ceilings.steel.furring_channel.install.hours_per_lm": { hoursPerUnit: 0.08, unit: "lm", workbookRow: 26, plain: "1 person 4.8 minutes per lm" },
  "ceilings.insulation.install.hours_per_m2": { hoursPerUnit: 0.06666666666666667, unit: "m2", workbookRow: 27, plain: "1 person 4 minutes" },
  "ceilings.steel.perimeter_track.install.hours_per_lm": { hoursPerUnit: 0.08, unit: "lm", workbookRow: 28, plain: "1 person 4.8 minutes per lm" },
  "ceilings.plasterboard.install.hours_per_sheet": { hoursPerUnit: 0.4166666666666667, unit: "sheet", workbookRow: 29, plain: "2 people 12.5 minutes" },
  "ceilings.plywood.install.hours_per_sheet": { hoursPerUnit: 1.1666666666666667, unit: "sheet", workbookRow: 30, plain: "2 people 35 minutes" },
  "ceilings.steel.primary_channel.install.hours_per_lm": { hoursPerUnit: 0.1, unit: "lm", workbookRow: 31, plain: "1 person 6 minutes per lm" },
  "ceilings.tile.install.hours_per_each": { hoursPerUnit: 0.025, unit: "each", workbookRow: 32, plain: "1 person 1.5 minutes per each" },
  "ceilings.timber_framing.install.hours_per_lm": { hoursPerUnit: 0.3333333333333333, unit: "lm", workbookRow: 33, plain: "2 people 10 minutes" },
  "ceilings.timber_lining.install.hours_per_lm": { hoursPerUnit: (2 * 5) / 60, unit: "lm", workbookRow: 34, plain: "Owner 11 Oct 2026: two people for five minutes per lm" },
  "doors.prehung.install.hours_per_door": { hoursPerUnit: 1.5, unit: "door", workbookRow: 35, plain: "1 person 1.5 hours" },
  "doors.replacement_leaf.install.hours_per_door": { hoursPerUnit: 2, unit: "door", workbookRow: 36, plain: "1 person 2 hours" },
  "doors.hardware.install.hours_per_set": { hoursPerUnit: 1.5, unit: "set", workbookRow: 37, plain: "1 person 1.5 hours" },
  "flooring.carpet.remove.hours_per_m2": { hoursPerUnit: 0.06666666666666667, unit: "m2", workbookRow: 38, plain: "1 person 4 minutes" },
  "flooring.tile.remove.hours_per_m2": { hoursPerUnit: 0.20833333333333334, unit: "m2", workbookRow: 39, plain: "1 person 12.5 minutes" },
  "flooring.substrate.remove.hours_per_m2": { hoursPerUnit: 0.3, unit: "m2", workbookRow: 40, plain: "1 person 18 minutes per m2" },
  "flooring.substrate.install.hours_per_sheet": { hoursPerUnit: 0.5, unit: "sheet", workbookRow: 41, plain: "2 people 15 minutes" },
  "flooring.hardwood.remove.hours_per_m2": { hoursPerUnit: 0.25, unit: "m2", workbookRow: 42, plain: "1 person 15 minutes" },
  "flooring.vinyl_plank.remove.hours_per_m2": { hoursPerUnit: 0.1, unit: "m2", workbookRow: 43, plain: "1 person 6 minutes" },
  "cladding.timber.bevelback.install.hours_per_lm": { hoursPerUnit: 0.11666666666666667, unit: "lm", workbookRow: 44, plain: "2 people 3.5 minutes" },
  "cladding.timber.bevelback.remove.hours_per_m2": { hoursPerUnit: 0.08333333333333333, unit: "m2", workbookRow: 45, plain: "1 person 5 minutes" },
  "cladding.timber.board_and_batten.batten.install.hours_per_lm": { hoursPerUnit: 0.16666666666666666, unit: "lm", workbookRow: 46, plain: "2 people 5 minutes" },
  "cladding.timber.board_and_batten.remove.hours_per_m2": { hoursPerUnit: 0.08333333333333333, unit: "m2", workbookRow: 47, plain: "1 person 5 minutes" },
  "cladding.timber.board_and_batten.sheet_board.install.hours_per_m2": { hoursPerUnit: 0.16666666666666666, unit: "m2", workbookRow: 48, plain: "2 people 5 minutes" },
  "cladding.cavity.install.hours_per_m2": { hoursPerUnit: 0.03333333333333333, unit: "m2", workbookRow: 49, plain: "1 person 2 minutes" },
  "cladding.fibre_cement.weatherboard.install.hours_per_lm": { hoursPerUnit: 0.11666666666666667, unit: "lm", workbookRow: 50, plain: "2 people 3.5 minutes" },
  "cladding.fibre_cement.weatherboard.remove.hours_per_m2": { hoursPerUnit: 0.08333333333333333, unit: "m2", workbookRow: 51, plain: "1 person 5 minutes" },
  "cladding.wall_underlay.install.hours_per_m2": { hoursPerUnit: 0.03333333333333333, unit: "m2", workbookRow: 52, plain: "2 people 1 minute" },
  "cladding.rigid_air_barrier.install.hours_per_m2": { hoursPerUnit: 0.03333333333333333, unit: "m2", workbookRow: 53, plain: "1 person 2 minutes" },
  "cladding.timber.rusticated.install.hours_per_lm": { hoursPerUnit: 0.11666666666666667, unit: "lm", workbookRow: 54, plain: "2 people 3.5 minutes" },
  "cladding.timber.rusticated.remove.hours_per_m2": { hoursPerUnit: 0.08333333333333333, unit: "m2", workbookRow: 55, plain: "1 person 5 minutes" },
  "cladding.timber.vertical_shiplap.install.hours_per_lm": { hoursPerUnit: 0.11666666666666667, unit: "lm", workbookRow: 56, plain: "2 people 3.5 minutes" },
  "cladding.timber.vertical_shiplap.remove.hours_per_m2": { hoursPerUnit: 0.08333333333333333, unit: "m2", workbookRow: 57, plain: "1 person 5 minutes" },
  "deck.demolition_hours_per_m2": { hoursPerUnit: 0.4166666666666667, unit: "m²", workbookRow: 59, plain: "2 people 12.5 minutes" },
  "deck.base_labour_hours_per_m2": { hoursPerUnit: 1.2, unit: "m²", workbookRow: 60, plain: "1 person 72 minutes per m²" },
  "deck.post_hole_concrete.place.hours_per_bag": { hoursPerUnit: 0.06666666666666667, unit: "bag", workbookRow: 61, plain: "1 person 4 minutes" },
  "deck.decking.install.hours_per_lm": { hoursPerUnit: 0.06666666666666667, unit: "lm", workbookRow: 62, plain: "1 person 4 minutes" },
  "deck.decking.install.hours_per_m2": { hoursPerUnit: 35 / 60, unit: "m²", workbookRow: 63, plain: "Owner 11 Oct 2026: one person for 35 minutes per m²" },
  "deck.elevated_extra_hours_per_m2": { hoursPerUnit: 0.25, unit: "m²", workbookRow: 64, plain: "1 person 15 minutes per m²" },
  "deck.fascia.install.hours_per_lm": { hoursPerUnit: 0.1, unit: "lm", workbookRow: 65, plain: "1 person 6 minutes" },
  "deck.skirting.install.hours_per_lm": { hoursPerUnit: 0.13333333333333333, unit: "lm", workbookRow: 66, plain: "1 person 8 minutes" },
  "deck.posts.install.hours_per_ea": { hoursPerUnit: 1, unit: "ea", workbookRow: 67, plain: "1 person 1 hour" },
  "deck.steps.install.hours_per_m2": { hoursPerUnit: 4, unit: "m²", workbookRow: 68, plain: "1 person 240 minutes per m²" },
  "deck.substructure.install.hours_per_framing_lm": { hoursPerUnit: 0.16666666666666666, unit: "lm", workbookRow: 69, plain: "1 person 10 minutes" },
  "deck.substructure.install.hours_per_m2": { hoursPerUnit: 0.52, unit: "m²", workbookRow: 70, plain: "1 person 31.2 minutes per m²" },
  "fence.capping.hours_per_lm": { hoursPerUnit: 0.125, unit: "lm", workbookRow: 71, plain: "1 person 7.5 minutes" },
  "fence.post.install.hours_per_post": { hoursPerUnit: 1.8, unit: "post", workbookRow: 72, plain: "2 people 54 minutes" },
  "fence.post_hole_concrete.place.hours_per_bag": { hoursPerUnit: (2 * 2) / 60, unit: "bag", workbookRow: 73, plain: "Owner 11 Oct 2026: two people for two minutes per bag" },
  "fence.rail.install.hours_per_lm": { hoursPerUnit: 0.05, unit: "lm", workbookRow: 74, plain: "1 person 3 minutes" },
  "fence.board.horizontal.hours_per_lm": { hoursPerUnit: 0.05, unit: "lm", workbookRow: 75, plain: "1 person 3 minutes" },
  "fence.section.install.hours_per_section": { hoursPerUnit: 0.5, unit: "section", workbookRow: 76, plain: "2 people 15 minutes" },
  "fence.gate.install.hours_per_gate": { hoursPerUnit: 3.5, unit: "gate", workbookRow: 77, plain: "1 person 3.5 hours" },
  "fence.board.vertical.hours_per_lm": { hoursPerUnit: 0.041666666666666664, unit: "lm", workbookRow: 78, plain: "1 person 2.5 minutes" },
  "retaining_wall.sleeper.sleepers.install.hours_per_ea": { hoursPerUnit: 0.22, unit: "ea", workbookRow: 79, plain: "1 person 13.2 minutes per ea" },
  "retaining_wall.drainage.install.hours_per_lm": { hoursPerUnit: 0.15, unit: "lm", workbookRow: 81, plain: "1 person 9 minutes per lm" },
  "retaining_wall.masonry.block_lay.hours_per_m2": { hoursPerUnit: 1.8, unit: "m2", workbookRow: 82, plain: "1 person 108 minutes per m2" },
  "retaining_wall.masonry.core_fill.hours_per_m3": { hoursPerUnit: 0.85, unit: "m3", workbookRow: 83, plain: "1 person 51 minutes per m3" },
  "retaining_wall.masonry.footing.concrete.hours_per_m3": { hoursPerUnit: 1.2, unit: "m3", workbookRow: 84, plain: "1 person 72 minutes per m3" },
  "retaining_wall.masonry.rebar.install.hours_per_lm": { hoursPerUnit: 0.08, unit: "lm", workbookRow: 85, plain: "1 person 4.8 minutes per lm" },
  "retaining_wall.masonry.subbase.compact.hours_per_m2": { hoursPerUnit: 0.15, unit: "m2", workbookRow: 86, plain: "1 person 9 minutes per m2" },
  "retaining_wall.masonry.waterproofing.hours_per_m2": { hoursPerUnit: 0.28, unit: "m2", workbookRow: 87, plain: "1 person 16.8 minutes per m2" },
  "retaining_wall.backfill.hours_per_m3": { hoursPerUnit: 0.5, unit: "m3", workbookRow: 88, plain: "2 people 15 minutes" },
  "retaining_wall.excavation.machine.hours_per_m3": { hoursPerUnit: 0.4166666666666667, unit: "m3", workbookRow: 90, plain: "1 machine/person 25 minutes" },
  "retaining_wall.excavation.manual.hours_per_m3": { hoursPerUnit: 4, unit: "m3", workbookRow: 91, plain: "2 people 2 hours" },
  "retaining_wall.post_hole_concrete.place.hours_per_bag": { hoursPerUnit: 0.1, unit: "bag", workbookRow: 92, plain: "1 person 6 minutes" },
  "retaining_wall.post_hole_concrete.place.hours_per_m3": { hoursPerUnit: 3.5, unit: "m3", workbookRow: 93, plain: "1 person 210 minutes per m3" },
  "retaining_wall.sleeper.concrete.place.hours_per_hole": { hoursPerUnit: 0.12, unit: "hole", workbookRow: 94, plain: "1 person 7.2 minutes per hole" },
  "retaining_wall.sleeper.posts.install.hours_per_ea": { hoursPerUnit: 0.95, unit: "ea", workbookRow: 95, plain: "1 person 57 minutes per ea" },
  "retaining_wall.timber.face_boards.install.hours_per_m2": { hoursPerUnit: 0.3333333333333333, unit: "m2", workbookRow: 96, plain: "2 people 10 minutes" },
  "retaining_wall.timber.piles.install.hours_per_ea": { hoursPerUnit: 0.4166666666666667, unit: "ea", workbookRow: 97, plain: "2 people 12.5 minutes" },
  "retaining_wall.timber.concrete.place.hours_per_hole": { hoursPerUnit: 0.12, unit: "hole", workbookRow: 98, plain: "1 person 7.2 minutes per hole" },
  "bathroom.fixture.accessories.install.hours_each": { hoursPerUnit: 0.5, unit: "each", workbookRow: 100, plain: "1 person 30 minutes per each" },
  "bathroom.demolition.floor_finish.hours_per_m2": { hoursPerUnit: 0.25, unit: "m²", workbookRow: 101, plain: "1 person 15 minutes per m²" },
  "bathroom.floor_substrate.install.hours_per_m2": { hoursPerUnit: 0.9166666666666666, unit: "m²", workbookRow: 102, plain: "1 person 55 minutes" },
  "bathroom.framing.install.hours_per_lm": { hoursPerUnit: 0.11666666666666667, unit: "lm", workbookRow: 103, plain: "1 person 7 minutes" },
  "bathroom.tile_underlay.install.hours_per_m2": { hoursPerUnit: 0.9166666666666666, unit: "m²", workbookRow: 104, plain: "1 person 55 minutes" },
  "bathroom.demolition.wall_lining.hours_per_m2": { hoursPerUnit: 0.08333333333333333, unit: "m²", workbookRow: 106, plain: "1 person 5 minutes" },
  "bathroom.demolition.fixture.hours_each": { hoursPerUnit: 0.06666666666666667, unit: "each", workbookRow: 107, plain: "1 person 4 minutes" },
  "bathroom.fixture.mirror.install.hours_each": { hoursPerUnit: 0.5833333333333334, unit: "each", workbookRow: 108, plain: "1 person 35 minutes" },
  "bathroom.demolition.shower.hours_each": { hoursPerUnit: 1.5, unit: "each", workbookRow: 109, plain: "1 person 90 minutes per each" },
  "bathroom.fixture.shower_enclosure.install.hours_each": { hoursPerUnit: 3, unit: "each", workbookRow: 110, plain: "1 person 180 minutes per each" },
  "bathroom.demolition.toilet.hours_each": { hoursPerUnit: 0.16666666666666666, unit: "each", workbookRow: 111, plain: "1 person 10 minutes" },
  "bathroom.demolition.vanity.hours_each": { hoursPerUnit: 0.3333333333333333, unit: "each", workbookRow: 112, plain: "2 people 10 minutes" },
  "bathroom.fixture.vanity.install.hours_each": { hoursPerUnit: 4, unit: "each", workbookRow: 113, plain: "2 people 2 hours" },
};

/**
 * Workbook says Review required and supplies no person-hours.
 * Deck hole excavation is a separate provisional operation
 * (deck.hole.excavate.hours_per_hole), not a second concrete rate.
 * It is not listed here. A company or calibrated hours-per-hole wins.
 */
export const UNRESOLVED_PRODUCTIVITY_KEYS = [
  "retaining_wall.excavation.hours_per_m3",
] as const;

/**
 * No live, historical, calibration, or company-override money consumer.
 * Live deck concrete is hours per bag. Live sleeper install is 0.22 h/ea.
 * Kept so an existing company row can still be read. Not an owner decision.
 */
export const DORMANT_PRODUCTIVITY_KEYS = [
  "deck.concrete.place.hours_per_hole",
  "retaining_wall.sleeper.sleepers.install.hours_per_m2",
] as const;

/**
 * Row 99's 4.5 is person-hours per m² of a complete bathroom strip-out,
 * not hours per bath. It is intentionally absent from APPROVED_PRODUCTIVITY
 * for bathroom.demolition.bath.hours_each.
 */
export const BATHROOM_COMPLETE_STRIP_HOURS_PER_M2 = 4.5;
export const BATHROOM_COMPLETE_STRIP_KEY =
  "bathroom.demolition.complete_strip.hours_per_m2" as const;
export const BATHROOM_COMPLETE_STRIP_WORKBOOK_ROW = 99;

/**
 * Row 105 plain language is Hardies / fibre cement (0.29 h/m²).
 * GIB uses the approved 0.5 h/sheet on a 2400×1200 sheet (2.88 m²).
 */
export const BATHROOM_FIBRE_CEMENT_WALL_LINING_HOURS_PER_M2 = 0.29;
export const BATHROOM_GIB_SHEET_HOURS = 0.5;
export const BATHROOM_GIB_SHEET_AREA_M2 = 2.4 * 1.2;
export const BATHROOM_GIB_WALL_LINING_HOURS_PER_M2 =
  BATHROOM_GIB_SHEET_HOURS / BATHROOM_GIB_SHEET_AREA_M2;

/**
 * Work Area Changes mention about 3 m³ loose spoil per 1 m³ bank.
 * That factor is not an approved Shared Decision. Do not apply it.
 */
/**
 * Owner decisions of 11 Oct 2026. They replace the workbook conversion for
 * these keys. The workbook export itself is unchanged.
 */
export const OWNER_PRODUCTIVITY_DECISIONS = [
  {
    date: "2026-10-11",
    key: "ceilings.timber_lining.install.hours_per_lm",
    unit: "lm",
    hoursPerUnit: (2 * 5) / 60,
    workbookRow: 34,
    workbookHoursPerUnit: 2,
    reason:
      "Two people for five minutes per linear metre. The ceiling calculator quantity is installed lm.",
  },
  {
    date: "2026-10-11",
    key: "fence.post_hole_concrete.place.hours_per_bag",
    unit: "bag",
    hoursPerUnit: (2 * 2) / 60,
    workbookRow: 73,
    workbookHoursPerUnit: 0.5,
    reason:
      "Two people for two minutes per 20 kg bag. One bag is one premix bag. Placement is not also charged on post installation, and there is no second mixing line.",
  },
  {
    date: "2026-10-11",
    key: "deck.decking.install.hours_per_m2",
    unit: "m2",
    hoursPerUnit: 35 / 60,
    workbookRow: 63,
    workbookHoursPerUnit: 0.06666666666666667,
    reason:
      "One person for 35 minutes per square metre. Detailed deck labour converts this by the selected board width onto the single installed-lm line.",
  },
  {
    date: "2026-10-11",
    key: "deck.decking.install.hours_per_lm",
    unit: "lm",
    hoursPerUnit: null,
    workbookRow: 62,
    workbookHoursPerUnit: 0.06666666666666667,
    status: "held_pending_owner_decision",
    reason:
      "The lm key is not given the m² factor. Installed lm = area / selected board width, so money uses h/m² × that width. The workbook lm value stays recorded and is not a second charge.",
  },
] as const;

export const LOOSE_SPOIL_SWELL_FACTOR: number | null = null;
export const LOOSE_SPOIL_SWELL_STATUS = "held_for_owner_review" as const;
export const LOOSE_SPOIL_SWELL_NOTE =
  "Bank volume is the in-situ hole or excavation quantity. Loose spoil is not calculated: a roughly 3× swell was noted for owner review and is not an approved factor.";

export const PRODUCT_IDENTITY_CORRECTION_KEYS = new Set<string>([
  "sheet.plasterboard.aqualine.10mm.6000x1200.each",
  "sheet.plasterboard.aqualine.13mm.4800x1200.each",
  "sheet.plasterboard.aqualine.13mm.6000x1200.each",
  "sheet.plasterboard.barrierline.13mm.2400x1200.each",
  "sheet.plasterboard.barrierline.13mm.2700x1200.each",
  "sheet.plasterboard.barrierline.13mm.3000x1200.each",
  "sheet.plasterboard.barrierline.13mm.3600x1200.each",
  "sheet.plasterboard.barrierline.13mm.4800x1200.each",
  "sheet.plasterboard.barrierline.13mm.6000x1200.each",
  "sheet.plasterboard.barrierline.16mm.2400x1200.each",
  "sheet.plasterboard.barrierline.16mm.2700x1200.each",
  "sheet.plasterboard.barrierline.16mm.3000x1200.each",
  "sheet.plasterboard.barrierline.16mm.3600x1200.each",
  "sheet.plasterboard.barrierline.16mm.4800x1200.each",
  "sheet.plasterboard.barrierline.16mm.6000x1200.each",
  "sheet.plasterboard.braceline.10mm.6000x1200.each",
  "sheet.plasterboard.braceline.13mm.4800x1200.each",
  "sheet.plasterboard.braceline.13mm.6000x1200.each",
  "sheet.plasterboard.fyreline.13mm.4800x1200.each",
  "sheet.plasterboard.fyreline.13mm.6000x1200.each",
  "sheet.plasterboard.fyreline.16mm.3600x1200.each",
  "sheet.plasterboard.fyreline.16mm.4800x1200.each",
  "sheet.plasterboard.fyreline.16mm.6000x1200.each",
  "sheet.plasterboard.noiseline.10mm.6000x1200.each",
  "sheet.plasterboard.noiseline.13mm.4800x1200.each",
  "sheet.plasterboard.noiseline.13mm.6000x1200.each",
  "sheet.plasterboard.weatherline.10mm.2400x1200.each",
  "sheet.plasterboard.weatherline.10mm.3600x1200.each",
  "sheet.plasterboard.weatherline.10mm.4800x1200.each",
  "sheet.plasterboard.weatherline.10mm.6000x1200.each",
  "sheet.plasterboard.weatherline.13mm.2400x1200.each",
  "sheet.plasterboard.weatherline.13mm.3600x1200.each",
  "sheet.plasterboard.weatherline.13mm.4800x1200.each",
  "sheet.plasterboard.weatherline.13mm.6000x1200.each",
]);

export function approvedProductivityHours(
  key: string
): ApprovedProductivity | undefined {
  return APPROVED_PRODUCTIVITY[key];
}

export function isUnresolvedProductivityKey(key: string): boolean {
  return (UNRESOLVED_PRODUCTIVITY_KEYS as readonly string[]).includes(key);
}

export function isDormantProductivityKey(key: string): boolean {
  return (DORMANT_PRODUCTIVITY_KEYS as readonly string[]).includes(key);
}
