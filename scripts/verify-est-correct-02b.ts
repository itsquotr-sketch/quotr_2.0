/**
 * EST-CORRECT-02B — mature Work Area Details completeness
 * (Deck, Fence, Retaining Wall, Bathroom).
 *
 * Run: npx --yes tsx scripts/verify-est-correct-02b.ts
 *
 * No paid AI. No Production. No merge to main.
 */
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  detailsAskClassForFact,
  isDetailsOwnedWhenUnresolved,
} from "../lib/assistant/question-ownership";
import { evaluateClarifyEstimateReadiness } from "../lib/assistant/readiness/clarify-estimate";
import { composeRefineView } from "../lib/assistant/refine/compose";
import type { RefineCandidate } from "../lib/assistant/refine/types";
import { isUnresolvedCaptureValue } from "../lib/estimate/disclosed-assumptions";
import { fenceFactIsRelevant } from "../lib/estimate/fence-question-relevance";
import { retainingWallFactIsRelevant } from "../lib/estimate/retaining-wall-question-relevance";
import type { EstimateFact } from "../lib/estimate/types";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function fact(
  key: string,
  workAreaId: string,
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

const CONSUMED_PCS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
] as const;

function composeSurfaces(params: {
  workAreas: { id: string; type: string; name: string; status: "confirmed" }[];
  facts: EstimateFact[];
  constraints?: { key: string; value: unknown; source?: string | null }[];
  briefText: string;
}) {
  const constraints =
    params.constraints ??
    CONSUMED_PCS.map((row) => ({ key: row.key, value: row.value }));
  const plan = composeJobPlan({
    workAreas: params.workAreas,
    facts: params.facts,
    constraints,
    briefText: params.briefText,
  });
  const clarifyInput = {
    stage: "quality" as const,
    briefText: params.briefText,
    qualityLevel: "standard",
    workAreas: params.workAreas,
    facts: params.facts,
    constraints,
    jobPlan: plan,
  };
  const clarify = composeClarifyView(clarifyInput);
  const refine = composeRefineView({
    briefText: params.briefText,
    qualityLevel: "standard",
    workAreas: params.workAreas,
    facts: params.facts,
    constraints,
    jobPlan: {
      cards: plan.cards.map((card) => ({
        workAreaId: card.workAreaId,
        workAreaType: card.workAreaType,
        name: card.name,
        notConfirmed: card.notConfirmed,
      })),
    },
  });
  const readiness = evaluateClarifyEstimateReadiness(clarifyInput);
  return { clarify, plan, refine, readiness };
}

function refineRows(view: ReturnType<typeof composeRefineView>): RefineCandidate[] {
  return [...view.highValue, ...view.advanced];
}

function detailsFactKeys(view: ReturnType<typeof composeClarifyView>): string[] {
  return [...view.candidates, ...view.deferred]
    .map((row) => row.factKey)
    .filter((key): key is string => Boolean(key));
}

function initialFactKeys(view: ReturnType<typeof composeClarifyView>): string[] {
  return [...view.candidates, ...view.deferred]
    .filter(isInitialCaptureQuestion)
    .map((row) => row.factKey)
    .filter((key): key is string => Boolean(key));
}

function hasUnresolvedRefine(
  view: ReturnType<typeof composeRefineView>,
  factKey: string
): boolean {
  return refineRows(view).some(
    (row) => row.factKey === factKey && isUnresolvedCaptureValue(row.currentValue)
  );
}

function hasResolvedRefineEdit(
  view: ReturnType<typeof composeRefineView>,
  factKey: string
): boolean {
  return refineRows(view).some(
    (row) =>
      row.factKey === factKey && !isUnresolvedCaptureValue(row.currentValue)
  );
}

const DECK_WA = {
  id: "d1",
  type: "deck",
  name: "Deck",
  status: "confirmed" as const,
};
const FENCE_WA = {
  id: "f1",
  type: "fence",
  name: "Fence",
  status: "confirmed" as const,
};
const RW_WA = {
  id: "rw1",
  type: "retaining_wall",
  name: "Retaining wall",
  status: "confirmed" as const,
};
const BATH_WA = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom",
  status: "confirmed" as const,
};

function overlayFacts(base: EstimateFact[], extra: EstimateFact[] = []): EstimateFact[] {
  const map = new Map(base.map((row) => [row.key, row]));
  for (const row of extra) map.set(row.key, row);
  return [...map.values()];
}

function deckCore(extra: EstimateFact[] = []): EstimateFact[] {
  return overlayFacts(
    [fact("deck.length_m", "d1", 5), fact("deck.width_m", "d1", 4)],
    extra
  );
}

function fenceCore(extra: EstimateFact[] = []): EstimateFact[] {
  return overlayFacts(
    [
      fact("fence.length_m", "f1", 18),
      fact("fence.height_m", "f1", 1.8),
      fact("fence.system", "f1", "Timber paling — vertical board"),
      fact("fence.timber_species", "f1", "Radiata Pine"),
      fact("fence.board_thickness_mm", "f1", "150 × 19mm"),
      fact("fence.post_spacing_m", "f1", 1.8),
      fact("fence.gate_included", "f1", false, "user"),
      fact("fence.top_capping", "f1", false, "user"),
    ],
    extra
  );
}

function fenceReadyFacts(extra: EstimateFact[] = []): EstimateFact[] {
  return fenceCore([
    fact("fence.demolition_required", "f1", false, "user"),
    fact("fence.finish_required", "f1", false, "user"),
    ...extra,
  ]);
}

function rwMasonry(extra: EstimateFact[] = []): EstimateFact[] {
  return overlayFacts(
    [
      fact("retaining_wall.material", "rw1", "Concrete masonry / Besser"),
      fact("retaining_wall.length_m", "rw1", 12),
      fact("retaining_wall.height_m", "rw1", 1.2),
      fact("retaining_wall.excavation_required", "rw1", false, "user"),
      fact("retaining_wall.drainage_required", "rw1", false, "user"),
      fact("retaining_wall.backfill_included", "rw1", false, "user"),
      fact("retaining_wall.surcharge", "rw1", "None"),
    ],
    extra
  );
}

console.log("=== EST-CORRECT-02B mature Work Area Details completeness ===\n");

console.log("--- DECK ---\n");

const deckA = composeSurfaces({
  workAreas: [DECK_WA],
  facts: deckCore([fact("deck.substructure_included", "d1", false)]),
  briefText: "Reuse the existing 5 by 4 metre deck framing.",
});
check(
  "A existing substructure → substructure_condition in Details",
  detailsFactKeys(deckA.clarify).includes("deck.substructure_condition")
);
check(
  "A substructure_condition is Details-owned, not unresolved Refine",
  isDetailsOwnedWhenUnresolved("deck", "deck.substructure_condition") &&
    !hasUnresolvedRefine(deckA.refine, "deck.substructure_condition")
);

const deckB = composeSurfaces({
  workAreas: [DECK_WA],
  facts: deckCore([
    fact("deck.substructure_included", "d1", false),
    fact("deck.existing_deck_removal", "d1", false),
  ]),
  briefText: "Reuse the existing 5 by 4 metre deck framing.",
});
check(
  "B pile replacement relevant → asked before Ready",
  detailsFactKeys(deckB.clarify).includes(
    "deck.pile_or_post_replacement_required"
  ) &&
    initialFactKeys(deckB.clarify).includes(
      "deck.pile_or_post_replacement_required"
    ) &&
    deckB.readiness.ready === false
);
check(
  "B pile replacement is not an unresolved Refine question",
  !hasUnresolvedRefine(deckB.refine, "deck.pile_or_post_replacement_required")
);

const deckC = composeSurfaces({
  workAreas: [DECK_WA],
  facts: deckCore([
    fact("deck.substructure_included", "d1", false, "user"),
    fact("deck.existing_deck_removal", "d1", false, "user"),
    fact("deck.substructure_condition", "d1", "good_existing", "user"),
    fact("deck.pile_or_post_replacement_required", "d1", false, "user"),
  ]),
  briefText: "Reuse the existing 5 by 4 metre deck framing. Piles are sound.",
});
check(
  "C known brief values are not re-asked",
  !detailsFactKeys(deckC.clarify).includes("deck.substructure_condition") &&
    !detailsFactKeys(deckC.clarify).includes(
      "deck.pile_or_post_replacement_required"
    )
);
check(
  "C resolved Deck facts may be edited in Refine",
  hasResolvedRefineEdit(deckC.refine, "deck.substructure_condition") &&
    hasResolvedRefineEdit(deckC.refine, "deck.pile_or_post_replacement_required")
);

const newDeck = composeSurfaces({
  workAreas: [DECK_WA],
  facts: deckCore([fact("deck.substructure_included", "d1", true)]),
  briefText: "Build a new 5 by 4 metre pine deck.",
});
check(
  "new substructure hides pile replacement and condition",
  !detailsFactKeys(newDeck.clarify).includes(
    "deck.pile_or_post_replacement_required"
  ) &&
    !detailsFactKeys(newDeck.clarify).includes("deck.substructure_condition") &&
    !initialFactKeys(newDeck.clarify).includes(
      "deck.pile_or_post_replacement_required"
    )
);

console.log("\n--- FENCE ---\n");

const fenceD = composeSurfaces({
  workAreas: [FENCE_WA],
  facts: fenceCore([fact("fence.demolition_required", "f1", true, "user")]),
  briefText: "18 m timber paling fence. Remove the existing fence.",
});
check(
  "D demolition_required = true → disposal_required is live",
  detailsFactKeys(fenceD.clarify).includes("fence.disposal_required") &&
    fenceFactIsRelevant("fence.disposal_required", {
      facts: fenceCore([fact("fence.demolition_required", "f1", true, "user")]),
      workAreaId: "f1",
    })
);
check(
  "D disposal is Details-owned, not unresolved Refine",
  isDetailsOwnedWhenUnresolved("fence", "fence.disposal_required") &&
    !hasUnresolvedRefine(fenceD.refine, "fence.disposal_required")
);

const fenceE = composeSurfaces({
  workAreas: [FENCE_WA],
  facts: fenceCore([fact("fence.demolition_required", "f1", false, "user")]),
  briefText: "18 m timber paling fence. No existing fence to remove.",
});
check(
  "E demolition_required = false → disposal hidden",
  !detailsFactKeys(fenceE.clarify).includes("fence.disposal_required") &&
    !initialFactKeys(fenceE.clarify).includes("fence.disposal_required") &&
    fenceFactIsRelevant("fence.disposal_required", {
      facts: fenceCore([fact("fence.demolition_required", "f1", false, "user")]),
      workAreaId: "f1",
    }) === false
);

const fenceF = composeSurfaces({
  workAreas: [FENCE_WA],
  facts: fenceCore([fact("fence.finish_required", "f1", false, "user")]),
  briefText: "18 m timber paling fence. No painting.",
});
check(
  "F finish_required = false → finish_type / finish_sides hidden",
  !detailsFactKeys(fenceF.clarify).includes("fence.finish_type") &&
    !detailsFactKeys(fenceF.clarify).includes("fence.finish_sides") &&
    !initialFactKeys(fenceF.clarify).includes("fence.finish_type") &&
    !initialFactKeys(fenceF.clarify).includes("fence.finish_sides")
);

const fenceG = composeSurfaces({
  workAreas: [FENCE_WA],
  facts: fenceCore([fact("fence.finish_required", "f1", true, "user")]),
  briefText: "18 m timber paling fence. Include painting.",
});
check(
  "G finish_required = true → required finish children appear",
  detailsFactKeys(fenceG.clarify).includes("fence.finish_type") &&
    detailsFactKeys(fenceG.clarify).includes("fence.finish_sides") &&
    initialFactKeys(fenceG.clarify).includes("fence.finish_type") &&
    initialFactKeys(fenceG.clarify).includes("fence.finish_sides") &&
    !hasUnresolvedRefine(fenceG.refine, "fence.finish_type") &&
    !hasUnresolvedRefine(fenceG.refine, "fence.finish_sides")
);

console.log("\n--- RETAINING WALL ---\n");

const rwH = composeSurfaces({
  workAreas: [RW_WA],
  facts: rwMasonry(),
  briefText: "12 m masonry retaining wall.",
});
check(
  "H masonry → block_laying_method resolved before Ready",
  detailsFactKeys(rwH.clarify).includes("retaining_wall.block_laying_method") &&
    initialFactKeys(rwH.clarify).includes(
      "retaining_wall.block_laying_method"
    ) &&
    rwH.readiness.ready === false &&
    !hasUnresolvedRefine(rwH.refine, "retaining_wall.block_laying_method")
);
check(
  "H subcontract scope hidden until subcontract path",
  !detailsFactKeys(rwH.clarify).includes(
    "retaining_wall.masonry.subcontract_scope"
  ) &&
    retainingWallFactIsRelevant("retaining_wall.masonry.subcontract_scope", {
      facts: rwMasonry(),
      workAreaId: "rw1",
    }) === false
);

const rwI = composeSurfaces({
  workAreas: [RW_WA],
  facts: rwMasonry([
    fact("retaining_wall.block_laying_method", "rw1", "Subcontract"),
  ]),
  briefText: "12 m masonry retaining wall. Subcontract block laying.",
});
check(
  "I subcontract path → masonry.subcontract_scope becomes relevant",
  detailsFactKeys(rwI.clarify).includes(
    "retaining_wall.masonry.subcontract_scope"
  ) &&
    initialFactKeys(rwI.clarify).includes(
      "retaining_wall.masonry.subcontract_scope"
    ) &&
    retainingWallFactIsRelevant("retaining_wall.masonry.subcontract_scope", {
      facts: rwMasonry([
        fact("retaining_wall.block_laying_method", "rw1", "Subcontract"),
      ]),
      workAreaId: "rw1",
    }) === true &&
    !hasUnresolvedRefine(rwI.refine, "retaining_wall.masonry.subcontract_scope")
);

const rwJ = composeSurfaces({
  workAreas: [RW_WA],
  facts: rwMasonry([
    fact("retaining_wall.block_laying_method", "rw1", "Self-perform"),
  ]),
  briefText: "12 m masonry retaining wall. Self-perform block laying.",
});
check(
  "J self-perform path → subcontract scope hidden",
  !detailsFactKeys(rwJ.clarify).includes(
    "retaining_wall.masonry.subcontract_scope"
  ) &&
    !initialFactKeys(rwJ.clarify).includes(
      "retaining_wall.masonry.subcontract_scope"
    )
);

const rwK = composeSurfaces({
  workAreas: [RW_WA],
  facts: rwMasonry([
    fact("retaining_wall.waterproofing_required", "rw1", true),
  ]),
  briefText: "12 m masonry retaining wall with waterproofing.",
});
check(
  "K waterproofing_required = true → waterproofing_type asked before Ready",
  detailsFactKeys(rwK.clarify).includes("retaining_wall.waterproofing_type") &&
    initialFactKeys(rwK.clarify).includes("retaining_wall.waterproofing_type") &&
    rwK.readiness.ready === false &&
    !hasUnresolvedRefine(rwK.refine, "retaining_wall.waterproofing_type")
);

const rwKHidden = composeSurfaces({
  workAreas: [RW_WA],
  facts: rwMasonry([
    fact("retaining_wall.waterproofing_required", "rw1", false),
  ]),
  briefText: "12 m masonry retaining wall. No waterproofing.",
});
check(
  "K waterproofing_required = false → waterproofing_type hidden",
  !detailsFactKeys(rwKHidden.clarify).includes(
    "retaining_wall.waterproofing_type"
  ) &&
    !initialFactKeys(rwKHidden.clarify).includes(
      "retaining_wall.waterproofing_type"
    )
);

console.log("\n--- BATHROOM ---\n");

const bathUnresolved = composeSurfaces({
  workAreas: [BATH_WA],
  facts: [
    fact("bathroom.job_scope", "b1", "New bathroom fitout"),
    fact("bathroom.length_m", "b1", 2.4),
    fact("bathroom.width_m", "b1", 1.8),
  ],
  briefText: "New bathroom fitout 2.4 by 1.8 metres.",
});
check(
  "L plumbing.level unresolved → Details-owned, not unresolved Refine",
  detailsFactKeys(bathUnresolved.clarify).includes("bathroom.plumbing.level") &&
    isDetailsOwnedWhenUnresolved("bathroom", "bathroom.plumbing.level") &&
    detailsAskClassForFact("bathroom", "bathroom.plumbing.level") ===
      "ASK_NOW" &&
    !hasUnresolvedRefine(bathUnresolved.refine, "bathroom.plumbing.level")
);
check(
  "M electrical.level unresolved → Details-owned, not unresolved Refine",
  detailsFactKeys(bathUnresolved.clarify).includes(
    "bathroom.electrical.level"
  ) &&
    isDetailsOwnedWhenUnresolved("bathroom", "bathroom.electrical.level") &&
    detailsAskClassForFact("bathroom", "bathroom.electrical.level") ===
      "ASK_NOW" &&
    !hasUnresolvedRefine(bathUnresolved.refine, "bathroom.electrical.level")
);
check(
  "nearby electrical.light_count is not a second interview while level is unresolved",
  !hasUnresolvedRefine(bathUnresolved.refine, "bathroom.electrical.light_count")
);

const bathResolved = composeSurfaces({
  workAreas: [BATH_WA],
  facts: [
    fact("bathroom.job_scope", "b1", "New bathroom fitout"),
    fact("bathroom.length_m", "b1", 2.4),
    fact("bathroom.width_m", "b1", 1.8),
    fact("bathroom.plumbing.level", "b1", "Standard"),
    fact("bathroom.electrical.level", "b1", "Minor"),
  ],
  briefText: "New bathroom fitout 2.4 by 1.8 metres.",
});
check(
  "N after resolution Refine may edit plumbing/electrical without re-interview",
  !hasUnresolvedRefine(bathResolved.refine, "bathroom.plumbing.level") &&
    !hasUnresolvedRefine(bathResolved.refine, "bathroom.electrical.level") &&
    hasResolvedRefineEdit(bathResolved.refine, "bathroom.plumbing.level") &&
    hasResolvedRefineEdit(bathResolved.refine, "bathroom.electrical.level") &&
    !detailsFactKeys(bathResolved.clarify).includes("bathroom.plumbing.level") &&
    !detailsFactKeys(bathResolved.clarify).includes("bathroom.electrical.level")
);

console.log("\n--- READY / RELEVANCE ---\n");

const readyO = composeSurfaces({
  workAreas: [FENCE_WA],
  facts: fenceReadyFacts([fact("fence.finish_required", "f1", true, "user")]),
  briefText: "18 m timber paling fence. Include painting.",
});
check(
  "O newly relevant finish children keep Ready false until resolved",
  initialFactKeys(readyO.clarify).includes("fence.finish_type") &&
    initialFactKeys(readyO.clarify).includes("fence.finish_sides") &&
    readyO.readiness.ready === false
);

const readyOResolved = composeSurfaces({
  workAreas: [FENCE_WA],
  facts: fenceReadyFacts([
    fact("fence.finish_required", "f1", true, "user"),
    fact("fence.finish_type", "f1", "stain", "user"),
    fact("fence.finish_sides", "f1", "both_sides", "user"),
  ]),
  briefText: "18 m timber paling fence. Stain both sides.",
});
check(
  "O answering finish children removes them from the Ready stream",
  !initialFactKeys(readyOResolved.clarify).includes("fence.finish_type") &&
    !initialFactKeys(readyOResolved.clarify).includes("fence.finish_sides")
);

const readyP = composeSurfaces({
  workAreas: [FENCE_WA],
  facts: fenceReadyFacts(),
  briefText: "18 m timber paling fence. No painting.",
});
check(
  "P irrelevant finish children do not block Ready",
  !initialFactKeys(readyP.clarify).includes("fence.finish_type") &&
    !initialFactKeys(readyP.clarify).includes("fence.finish_sides") &&
    !initialFactKeys(readyP.clarify).includes("fence.disposal_required") &&
    readyP.readiness.diagnostics.unresolved.every(
      (row) =>
        row.factKey !== "fence.finish_type" &&
        row.factKey !== "fence.finish_sides" &&
        row.factKey !== "fence.disposal_required"
    )
);

const readyPDemo = composeSurfaces({
  workAreas: [FENCE_WA],
  facts: fenceReadyFacts([
    fact("fence.demolition_required", "f1", true, "user"),
  ]),
  briefText: "18 m timber paling fence. Remove existing fence.",
});
check(
  "O demolition child disposal keeps Ready false until resolved",
  initialFactKeys(readyPDemo.clarify).includes("fence.disposal_required") &&
    readyPDemo.readiness.ready === false
);

if (failed > 0) {
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(1);
}
console.log(`\n${passed} passed, ${failed} failed.`);
