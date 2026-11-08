/**
 * Details reads the same project conditions the brief already stated.
 * Run: npx tsx scripts/verify-details-condition-chain.ts
 *
 * QT-009 stated access, carry, floor, occupancy and hours. Those answers
 * stay on the project constraint, once, and the takeoff does not open the
 * full questionnaire above the labour rows.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { briefImpliesConstraint } from "../lib/assistant/clarify/suppress";
import { commercialConditionMessages, listConditionDecisions } from "../lib/estimate/condition-basis";
import {
  mergeProjectConditionWrites,
  normaliseProjectConditionValue,
  projectConditionWritesFromFacts,
} from "../lib/project-conditions/from-facts";
import {
  groupConditionCandidates,
  visibleConditionCandidates,
} from "../lib/project-conditions/presentation";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";

const QT009 =
  "Build a non-loadbearing timber stud wall 6000mm long and 2400mm high. Use 90 × 45 framing, 13 mm Standard GIB both sides, one layer each side, with thermal cavity insulation. Include one door opening and one prehung hollow-core door set, 810 × 1980 mm, including jamb and standard hardware. Stop the plasterboard ready to paint; stopping level to be confirmed. Painting, electrical and skirting are excluded. Ground floor, easy access, carry under 10 m, unoccupied, unrestricted hours.";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`PASS  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function value(constraints: { key: string; value: string | number | boolean }[], key: string) {
  return constraints.find((row) => row.key === key)?.value;
}

const enriched = enrichExtractionFromBrief({
  briefText: QT009,
  extraction: {
    workAreas: [],
    facts: [
      {
        work_area_type: null,
        work_area_name: null,
        key: "project.material_carry_distance",
        label: "Carry",
        value: "Under 10m",
        confidence: 0.8,
      },
      {
        work_area_type: null,
        work_area_name: null,
        key: "project.occupancy_status",
        label: "Occupancy",
        value: "Unoccupied",
        confidence: 0.8,
      },
      {
        work_area_type: "internal_walls",
        work_area_name: "Wall A",
        key: "internal_walls.access",
        label: "Access",
        value: "Easy",
        confidence: 0.8,
      },
      {
        work_area_type: "doors",
        work_area_name: "Door",
        key: "doors.access",
        label: "Access",
        value: "Easy",
        confidence: 0.8,
      },
    ],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  },
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
});

check("easy access is stored", value(enriched.constraints, "site_access") === "Easy");
check("carry under 10 m is < 10m", value(enriched.constraints, "material_carry_distance") === "< 10m");
check("ground floor is stored", value(enriched.constraints, "floor_level") === "Ground");
check("unoccupied is occupied_site No", value(enriched.constraints, "occupied_site") === "No");
check("unrestricted hours is working_hours No", value(enriched.constraints, "working_hours") === "No");
check(
  "unoccupied does not imply the occupied question is done",
  briefImpliesConstraint(QT009, "occupied_site") === false
);
check(
  "two assemblies share one access answer",
  enriched.constraints.filter((row) => row.key === "site_access").length === 1
);

check(
  "paraphrase Under 10m normalises",
  normaliseProjectConditionValue("material_carry_distance", "Under 10m") === "< 10m"
);
check(
  "missing access stays unanswered",
  value(
    enrichExtractionFromBrief({
      briefText: "Build a timber stud wall 3 m long and 2.4 m high.",
      extraction: {
        workAreas: [],
        facts: [],
        assumptions: [],
        possibleConstraints: [],
        confidence: 0.5,
        warnings: [],
      },
      allowedTypes: getAnalysisCapableWorkAreaTypes(),
    }).constraints,
    "site_access"
  ) == null
);

const conflict = mergeProjectConditionWrites({
  authoritative: [{ key: "site_access", label: "Site access", value: "Difficult" }],
  fromFacts: projectConditionWritesFromFacts([
    { key: "project.site_access", value: "Easy" },
  ]),
});
check("confirmed access is kept", conflict.constraints[0]?.value === "Difficult");
check("a conflicting extraction is flagged", conflict.warnings.length === 1);

const decisions = listConditionDecisions({
  constraints: [
    { key: "site_access", value: "Easy", source: "ai_extracted" },
    { key: "material_carry_distance", value: "Not sure", source: "user" },
    { key: "floor_level", value: "Ground", source: "ai_extracted" },
  ],
  workAreaTypes: ["internal_walls"],
});
check(
  "Not sure stays uncertain",
  decisions.find((row) => row.key === "material_carry_distance")?.state === "uncertain"
);
check(
  "a stored answer is resolved",
  decisions.find((row) => row.key === "site_access")?.state === "resolved"
);
check(
  "unanswered occupancy does not block commercial readiness",
  decisions.find((row) => row.key === "occupied_site")?.blocksCommercial === false &&
    commercialConditionMessages({
      constraints: [],
      workAreaTypes: ["internal_walls"],
    }).every((message) => !/occupied|working hour/i.test(message))
);

const grouped = groupConditionCandidates(
  visibleConditionCandidates(
    [
      { questionKey: "q-access", targetKey: "site_access" },
      { questionKey: "q-carry", targetKey: "material_carry_distance" },
      { questionKey: "q-occupied", targetKey: "occupied_site" },
      { questionKey: "q-protect", targetKey: "protection_dust_control" },
    ],
    []
  )
);
check(
  "protection waits until occupancy is answered",
  grouped.every((group) => group.items.every((item) => item.targetKey !== "protection_dust_control"))
);
check(
  "independent access and carry stay in their groups",
  grouped.some((group) => group.group === "access") &&
    grouped.some((group) => group.group === "handling")
);

const labour = readFileSync(
  join(process.cwd(), "components/assistant/mode/EstimateTakeoffViews.tsx"),
  "utf8"
);
const labourStart = labour.indexOf("export function LabourTakeoff");
const labourBody = labour.slice(labourStart, labour.indexOf("function ReviewList"));
check(
  "labour rows render before the condition summary",
  labourBody.indexOf("<TakeoffBoard") < labourBody.indexOf("{decisions}")
);
const summary = readFileSync(
  join(process.cwd(), "components/assistant/mode/ConditionDecisions.tsx"),
  "utf8"
);
check(
  "the full editor opens from Edit conditions",
  summary.includes('data-edit-conditions="true"') &&
    summary.includes("editing ? (")
);

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("details condition chain passed");
