"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  jobPlanBoolean,
  jobPlanNumber,
  jobPlanString,
} from "@/lib/assistant/job-plan/facts";
import { deckStepsIncluded } from "@/lib/estimate/deck-steps-physical";
import type { EstimateFact } from "@/lib/estimate/types";
import type { ReactNode } from "react";

export type QuickSpecFactWrite = (input: {
  workAreaId: string;
  key: string;
  label: string;
  value: string | number;
  valueType: "number" | "select";
}) => void;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

export function DeckQuickSpecEditor({
  workAreaId,
  facts,
  onSpecFact,
}: {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: QuickSpecFactWrite;
  constraints?: readonly { key: string; value: unknown }[];
  onConstraint?: (input: {
    key: string;
    label: string;
    value: string;
    inputType?: "select" | "boolean";
  }) => void;
}) {
  const material = jobPlanString(facts, workAreaId, "deck.board_material") ?? "";
  const width = jobPlanNumber(facts, workAreaId, "deck.board_width_mm");
  const height = jobPlanNumber(facts, workAreaId, "deck.height_m");
  const substructure =
    jobPlanBoolean(facts, workAreaId, "deck.substructure_included") ?? true;
  const fascia =
    jobPlanBoolean(facts, workAreaId, "deck.vertical_face_boards_required") ===
    true;
  const steps = deckStepsIncluded({
    accessType: jobPlanString(facts, workAreaId, "deck.access_type"),
    hasStairs: jobPlanBoolean(facts, workAreaId, "deck.has_stairs"),
    facts,
    workAreaId,
  });
  const joist = jobPlanString(facts, workAreaId, "deck.joist_section") ?? "";
  const bearer = jobPlanString(facts, workAreaId, "deck.bearer_section") ?? "";
  const support = jobPlanString(facts, workAreaId, "deck.support_section") ?? "";
  const fasciaMaterial =
    jobPlanString(facts, workAreaId, "deck.fascia_material") ?? "";
  const stepWidth = jobPlanNumber(facts, workAreaId, "deck.step_width_m");
  const stepGoing = jobPlanNumber(facts, workAreaId, "deck.step_going_m");
  const stepCount = jobPlanNumber(facts, workAreaId, "deck.step_count");

  return (
    <div className="grid gap-3">
      <Group title="Decking">
        <div className="space-y-1">
          <Label htmlFor={`deck-material-${workAreaId}`}>Deck board material</Label>
          <select
            id={`deck-material-${workAreaId}`}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={material}
            onChange={(event) =>
              onSpecFact?.({
                workAreaId,
                key: "deck.board_material",
                label: "Decking board material",
                value: event.target.value,
                valueType: "select",
              })
            }
          >
            <option value="">Not set</option>
            <option value="Treated Pine">Treated Pine</option>
            <option value="Hardwood">Hardwood</option>
            <option value="Kwila">Kwila</option>
            <option value="Composite">Composite</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`deck-width-${workAreaId}`}>Board width (mm)</Label>
          <Input
            id={`deck-width-${workAreaId}`}
            type="number"
            inputMode="numeric"
            defaultValue={width ?? ""}
            onBlur={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              onSpecFact?.({
                workAreaId,
                key: "deck.board_width_mm",
                label: "Decking board width",
                value: next,
                valueType: "number",
              });
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`deck-height-${workAreaId}`}>Height (m)</Label>
          <Input
            id={`deck-height-${workAreaId}`}
            type="number"
            inputMode="decimal"
            step="0.01"
            defaultValue={height ?? ""}
            onBlur={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              onSpecFact?.({
                workAreaId,
                key: "deck.height_m",
                label: "Deck height",
                value: next,
                valueType: "number",
              });
            }}
          />
        </div>
      </Group>

      {substructure ? (
        <Group title="Substructure">
          <div className="space-y-1">
            <Label htmlFor={`deck-joist-${workAreaId}`}>Joists</Label>
            <select
              id={`deck-joist-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={joist}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "deck.joist_section",
                  label: "Joist section",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">90×45 H3.2 (estimating default)</option>
              <option value="90x45">90×45 H3.2</option>
              <option value="140x45">140×45 H3.2</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`deck-bearer-${workAreaId}`}>Bearers</Label>
            <select
              id={`deck-bearer-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={bearer}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "deck.bearer_section",
                  label: "Bearer section",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">140×45 H3.2 (estimating default)</option>
              <option value="140x45">140×45 H3.2</option>
              <option value="190x45">190×45 H3.2</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`deck-post-${workAreaId}`}>Piles / posts</Label>
            <select
              id={`deck-post-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={support}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "deck.support_section",
                  label: "Pile/post section",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">125×125 H5 house pile (estimating default)</option>
              <option value="100x100">100×100 H5 timber post</option>
              <option value="125x125">125×125 H5 house pile</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            These are estimating material assumptions, not a structural selection.
          </p>
        </Group>
      ) : null}

      {fascia ? (
        <Group title="Fascia">
          <div className="space-y-1">
            <Label htmlFor={`deck-fascia-${workAreaId}`}>Fascia material</Label>
            <select
              id={`deck-fascia-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={fasciaMaterial}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "deck.fascia_material",
                  label: "Fascia material",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Inherit deck boards</option>
              <option value="Treated Pine">Treated Pine</option>
              <option value="Hardwood">Hardwood</option>
              <option value="Kwila">Kwila</option>
              <option value="Composite">Composite</option>
            </select>
          </div>
        </Group>
      ) : null}

      {steps ? (
        <Group title="Steps">
          <p className="text-xs text-muted-foreground">
            Treads inherit the selected deck board. Framing defaults to 190×45
            H3.2.
          </p>
          <div className="space-y-1">
            <Label htmlFor={`deck-step-count-${workAreaId}`}>Rise count</Label>
            <Input
              id={`deck-step-count-${workAreaId}`}
              type="number"
              inputMode="numeric"
              defaultValue={stepCount ?? ""}
              placeholder="From height (175 mm target)"
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "deck.step_count",
                  label: "Step rise count",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`deck-step-width-${workAreaId}`}>Stair width (m)</Label>
            <Input
              id={`deck-step-width-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={stepWidth ?? ""}
              placeholder="1.0"
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "deck.step_width_m",
                  label: "Stair width",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`deck-step-going-${workAreaId}`}>Tread depth (m)</Label>
            <Input
              id={`deck-step-going-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={stepGoing ?? ""}
              placeholder="0.28"
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "deck.step_going_m",
                  label: "Tread depth",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
        </Group>
      ) : null}
    </div>
  );
}
