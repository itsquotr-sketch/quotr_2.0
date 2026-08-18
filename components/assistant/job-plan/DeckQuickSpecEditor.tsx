"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jobPlanNumber, jobPlanString } from "@/lib/assistant/job-plan/facts";
import type { EstimateFact } from "@/lib/estimate/types";

export type QuickSpecFactWrite = (input: {
  workAreaId: string;
  key: string;
  label: string;
  value: string | number;
  valueType: "number" | "select";
}) => void;

export function DeckQuickSpecEditor({
  workAreaId,
  facts,
  onSpecFact,
}: {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: QuickSpecFactWrite;
}) {
  const material = jobPlanString(facts, workAreaId, "deck.board_material") ?? "";
  const width = jobPlanNumber(facts, workAreaId, "deck.board_width_mm");
  const height = jobPlanNumber(facts, workAreaId, "deck.height_m");

  return (
    <div className="grid gap-3">
      <div className="space-y-1">
        <Label htmlFor={`deck-material-${workAreaId}`}>Decking material</Label>
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
    </div>
  );
}
