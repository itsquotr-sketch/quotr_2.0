/**
 * EF02-D2 — Refine structured editor presentation.
 *
 * Presentation only. Does not rewrite D1 ownership / persistence tests.
 *
 * Run: npx --yes tsx scripts/verify-refine-structured-editor-r1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import type { RefineCandidate } from "../lib/assistant/refine/types";
import type { EstimateFact } from "../lib/estimate/types";
import {
  formatRefineCurrentValue,
  groupRefineCandidatesForDisplay,
  isUnsetRefineValue,
  refineSectionForCandidate,
} from "../components/assistant/refine/refine-presentation";

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

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function fact(
  key: string,
  workAreaId: string,
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

function synth(overrides: Partial<RefineCandidate> & { id: string }): RefineCandidate {
  return {
    group: "specification",
    tier: "high_value",
    workAreaId: "wa-1",
    workAreaName: "Deck",
    workAreaType: "deck",
    factKey: overrides.factKey ?? overrides.id,
    constraintKey: null,
    questionKey: overrides.factKey ?? overrides.id,
    label: overrides.label ?? "Label",
    question: overrides.question ?? "What is the full question prompt?",
    inputType: "select",
    writeTarget: "FACT",
    write: null,
    consumedByCalculator: true,
    ...overrides,
  };
}

function composeRefine(params: {
  workAreas: { id: string; type: string; name: string; status: "confirmed" }[];
  facts: EstimateFact[];
  constraints?: { key: string; value: unknown; source?: string | null }[];
  briefText: string;
}) {
  const constraints = params.constraints ?? [
    { key: "site_access", value: "Moderate" },
    { key: "material_carry_distance", value: "10–30m" },
    { key: "occupied_site", value: "No" },
    { key: "working_hours", value: "No" },
  ];
  const plan = composeJobPlan({
    workAreas: params.workAreas,
    facts: params.facts,
    constraints,
    briefText: params.briefText,
  });
  return composeRefineView({
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
}

console.log("=== EF02-D2 Refine structured editor ===\n");

const deckFacts = [
  fact("deck.length_m", "d1", 5),
  fact("deck.width_m", "d1", 4),
  fact("deck.height_m", "d1", 0.6, "assumption"),
  fact("deck.board_material", "d1", "Kwila"),
  fact("deck.existing_deck_removal", "d1", true),
  fact("deck.steps_included", "d1", false),
  fact("deck.substructure_included", "d1", true),
];
const deck = composeRefine({
  workAreas: [{ id: "d1", type: "deck", name: "Rear Deck", status: "confirmed" }],
  facts: deckFacts,
  briefText: "Build a new 5 by 4 metre kwila deck. No steps.",
});
const deckRows = [...deck.highValue, ...deck.advanced];
const height = deckRows.find((row) => row.factKey === "deck.height_m");
const material = deckRows.find((row) => row.factKey === "deck.board_material");
const removal = deckRows.find((row) => row.factKey === "deck.existing_deck_removal");

check(
  "resolved fact renders current value",
  formatRefineCurrentValue(material!) === "Kwila"
);
check(
  "assumed fact renders current value",
  height?.assumed === true &&
    Boolean(formatRefineCurrentValue(height)?.startsWith("0.6"))
);
check(
  "boolean include value is compact, not a question",
  formatRefineCurrentValue(removal!) === "Included" ||
    formatRefineCurrentValue(removal!) === "Yes"
);

const unsetOptional = synth({
  id: "optional-unset",
  factKey: "deck.skirting_included",
  label: "Skirting",
  question: "Is full-height deck skirting / screening included?",
  inputType: "boolean",
  currentValue: null,
  group: "scope",
});
check("optional unset field is Not set", isUnsetRefineValue(unsetOptional.currentValue));
check(
  "optional unset has no current-value string",
  formatRefineCurrentValue(unsetOptional) === null
);

check(
  "one semantic row per field",
  new Set(deckRows.map((row) => row.semanticKey ?? row.id)).size === deckRows.length
);

const deckGroups = groupRefineCandidatesForDisplay({ candidates: deckRows });
check(
  "Rear Deck is grouped by instance name",
  deckGroups.some(
    (group) => group.workAreaId === "d1" && group.workAreaName === "Rear Deck"
  )
);
const deckSectionIds = new Set(
  deckGroups
    .find((group) => group.workAreaId === "d1")
    ?.sections.map((section) => section.id) ?? []
);
check(
  "Deck uses C1 sections (Dimensions / Materials / Structure / Included Scope)",
  refineSectionForCandidate(height!) === "dimensions" &&
    refineSectionForCandidate(material!) === "materials" &&
    (deckSectionIds.has("dimensions") || deckSectionIds.has("materials") || deckSectionIds.has("structure") || deckSectionIds.has("scope"))
);

const pcKeys = deckGroups
  .filter((group) => group.kind === "project_conditions")
  .flatMap((group) => group.sections.flatMap((section) => section.candidates))
  .map((row) => row.constraintKey)
  .filter((key): key is string => Boolean(key));
check("Project Conditions appear once", pcKeys.length === new Set(pcKeys).size);
check(
  "Project Conditions are a project-level group",
  deckGroups.filter((group) => group.kind === "project_conditions").length === 1
);
check(
  "Project Conditions are not duplicated under Deck",
  !deckGroups.some(
    (group) =>
      group.workAreaId === "d1" &&
      group.sections.some((section) =>
        section.candidates.some((row) => row.constraintKey)
      )
  )
);

const twoBaths = composeRefine({
  workAreas: [
    { id: "b1", type: "bathroom", name: "Master Ensuite", status: "confirmed" },
    { id: "b2", type: "bathroom", name: "Family Bathroom", status: "confirmed" },
  ],
  facts: [
    fact("bathroom.job_scope", "b1", "full_renovation"),
    fact("bathroom.length_m", "b1", 3),
    fact("bathroom.width_m", "b1", 2.4),
    fact("bathroom.job_scope", "b2", "full_renovation"),
    fact("bathroom.length_m", "b2", 2.4),
    fact("bathroom.width_m", "b2", 2.1),
  ],
  constraints: [],
  briefText: "Master ensuite and family bathroom renovations.",
});
const bathGroups = groupRefineCandidatesForDisplay({
  candidates: [...twoBaths.highValue, ...twoBaths.advanced],
});
check(
  "repeated Bathroom instances remain separated",
  bathGroups.some((group) => group.workAreaId === "b1" && group.workAreaName === "Master Ensuite") &&
    bathGroups.some((group) => group.workAreaId === "b2" && group.workAreaName === "Family Bathroom")
);
check(
  "bathroom questions do not collide across instances",
  (bathGroups.find((g) => g.workAreaId === "b1")?.sections.flatMap((s) => s.candidates) ?? []).every(
    (row) => row.workAreaId === "b1"
  ) &&
    (bathGroups.find((g) => g.workAreaId === "b2")?.sections.flatMap((s) => s.candidates) ?? []).every(
      (row) => row.workAreaId === "b2"
    )
);

const iw = composeRefine({
  workAreas: [
    {
      id: "w1",
      type: "internal_walls",
      name: "Ground Floor Internal Walls",
      status: "confirmed",
    },
  ],
  facts: [fact("internal_walls.job_scope", "w1", "new_partition")],
  constraints: [],
  briefText: "New internal partition walls on the ground floor.",
});
const iwGroups = groupRefineCandidatesForDisplay({
  candidates: [...iw.highValue, ...iw.advanced],
  wallTypePanels: iw.wallTypePanels,
});
check(
  "Internal Walls remain one Work Area group",
  iwGroups.filter((group) => group.workAreaType === "internal_walls").length === 1
);
check(
  "Internal Walls Wall Types remain distinguishable",
  (iw.wallTypePanels ?? []).every((panel) => {
    const ids = panel.types.map((type) => type.id);
    return new Set(ids).size === ids.length;
  }) &&
    iwGroups
      .find((group) => group.workAreaId === "w1")
      ?.sections.every((section) =>
        section.candidates.every((row) => row.workAreaId === "w1")
      ) === true
);

const splitWallTypes = groupRefineCandidatesForDisplay({
  candidates: [
    synth({
      id: "wt-a",
      workAreaId: "w1",
      workAreaName: "Internal Walls",
      workAreaType: "internal_walls",
      factKey: "internal_walls.wall_type.height_m",
      label: "Height",
      wallTypeId: "type-a",
      currentValue: 2.4,
      inputType: "number",
      unit: "m",
    }),
    synth({
      id: "wt-b",
      workAreaId: "w1",
      workAreaName: "Internal Walls",
      workAreaType: "internal_walls",
      factKey: "internal_walls.wall_type.height_m",
      label: "Height",
      wallTypeId: "type-b",
      currentValue: 2.7,
      inputType: "number",
      unit: "m",
    }),
  ],
  wallTypePanels: [
    {
      types: [
        { id: "type-a", displayName: "Timber partition" },
        { id: "type-b", displayName: "Plumbing wall" },
      ],
    },
  ],
});
check(
  "Wall Type ids stay visibly separated in presentation grouping",
  splitWallTypes[0]?.sections.some((section) => section.wallTypeId === "type-a") === true &&
    splitWallTypes[0]?.sections.some((section) => section.wallTypeId === "type-b") === true
);

const rowSrc = read("components/assistant/refine/RefineFieldRow.tsx");
const panelSrc = read("components/assistant/clarify/ClarifyReadiness.tsx");
const presentationSrc = read("components/assistant/refine/refine-presentation.ts");
check(
  "default compact row uses label, not the question prompt",
  rowSrc.includes("data-refine-label") &&
    rowSrc.includes("candidate.label") &&
    rowSrc.includes("Not set") &&
    rowSrc.includes("Assumed") &&
    !rowSrc.includes("{candidate.question}")
);
check(
  "edit mode reuses ClarifyAnswerControl",
  rowSrc.includes("ClarifyAnswerControl") &&
    rowSrc.includes("data-refine-editor") &&
    panelSrc.includes("setEditingId")
);
check(
  "Update Estimate remains the explicit stale CTA",
  panelSrc.includes("data-refine-update-estimate") &&
    !panelSrc.includes("data-refine-advanced-toggle")
);
check(
  "presentation helper does not compose Refine data",
  !presentationSrc.includes('from "@/lib/assistant/refine/compose"') &&
    !read("lib/assistant/refine/compose.ts").includes("groupRefineCandidatesForDisplay")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
