/**
 * DECK-RATE-REF-01 — synthetic rate fixture.
 *
 * Same 5.20 × 3.10 geometry as DECK-REF-01. Exact SG8 H3.2 KD identities
 * so B2 can prove benchmark resolution without restamping DECK-REF-01.
 */
import type { EstimateFact } from "@/lib/estimate/types";

export const DECK_RATE_REF_01_LABEL = "DECK-RATE-REF-01";

export function deckRateRef01Facts(workAreaId: string): EstimateFact[] {
  return [
    { key: "deck.length_m", work_area_id: workAreaId, value: 5.2 },
    { key: "deck.width_m", work_area_id: workAreaId, value: 3.1 },
    { key: "deck.area_m2", work_area_id: workAreaId, value: 16.12 },
    { key: "deck.board_material", work_area_id: workAreaId, value: "Hardwood" },
    { key: "deck.board_width_mm", work_area_id: workAreaId, value: 140 },
    { key: "deck.height_m", work_area_id: workAreaId, value: 0.4 },
    { key: "deck.joist_section", work_area_id: workAreaId, value: "140x45" },
    { key: "deck.joist_centres_mm", work_area_id: workAreaId, value: 450 },
    {
      key: "deck.framing_treatment",
      work_area_id: workAreaId,
      value: "H3.2 SG8 KD",
    },
    { key: "deck.bearer_section", work_area_id: workAreaId, value: "190x45" },
    { key: "deck.bearer_row_count", work_area_id: workAreaId, value: 2 },
    { key: "deck.support_type", work_area_id: workAreaId, value: "Post" },
    { key: "deck.supports_per_bearer", work_area_id: workAreaId, value: 4 },
    { key: "deck.support_section", work_area_id: workAreaId, value: "90x90" },
    { key: "deck.footing_length_mm", work_area_id: workAreaId, value: 300 },
    { key: "deck.footing_width_mm", work_area_id: workAreaId, value: 300 },
    { key: "deck.footing_depth_mm", work_area_id: workAreaId, value: 450 },
  ];
}
