"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { flooringQuestionLabel } from "@/lib/estimate/flooring-question-copy";
import {
  flooringMeasuredAreaM2,
  resolveFlooringPortions,
} from "@/lib/estimate/flooring-portions";
import type { EstimateFact } from "@/lib/estimate/types";
import type { ReactNode } from "react";
import type { QuickSpecFactWrite } from "@/components/assistant/job-plan/DeckQuickSpecEditor";

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

export function FlooringQuickSpecEditor({
  workAreaId,
  facts,
  onSpecFact,
}: {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: QuickSpecFactWrite;
  onBooleanFact?: (input: {
    workAreaId: string;
    key: string;
    label: string;
    value: boolean;
  }) => void;
  constraints?: readonly { key: string; value: unknown }[];
  onConstraint?: (input: {
    key: string;
    label: string;
    value: string;
    inputType?: "select" | "boolean";
  }) => void;
  postHoleFocusId?: string | null;
}) {
  const portions = resolveFlooringPortions({ facts, workAreaId }).portions;

  return (
    <div className="space-y-3" data-flooring-quick-spec>
      {portions.map((portion, index) => {
        const fieldId = (suffix: string) =>
          `flooring-${suffix}-${workAreaId}-${portion.id}`;
        const writeMeasure = (
          key: "flooring.portion.length_m" | "flooring.portion.width_m" | "flooring.portion.area_m2",
          value: number
        ) => {
          onSpecFact?.({
            workAreaId,
            key,
            label: flooringQuestionLabel(key) ?? key,
            value,
            valueType: "number",
            nestedItemId: portion.id,
          });
        };

        return (
          <Group
            key={portion.id}
            title={portion.label?.trim() || `Flooring area ${index + 1}`}
          >
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor={fieldId("length")}>
                Floor length (m)
              </Label>
              <Input
                className="h-11 md:h-9"
                id={fieldId("length")}
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={portion.length_m ?? ""}
                data-flooring-length={portion.id}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || !(next > 0)) return;
                  writeMeasure("flooring.portion.length_m", next);
                  const measured = flooringMeasuredAreaM2({
                    length_m: next,
                    width_m: portion.width_m,
                  });
                  if (measured != null) {
                    writeMeasure("flooring.portion.area_m2", measured);
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor={fieldId("width")}>
                Floor width (m)
              </Label>
              <Input
                className="h-11 md:h-9"
                id={fieldId("width")}
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={portion.width_m ?? ""}
                data-flooring-width={portion.id}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || !(next > 0)) return;
                  writeMeasure("flooring.portion.width_m", next);
                  const measured = flooringMeasuredAreaM2({
                    length_m: portion.length_m,
                    width_m: next,
                  });
                  if (measured != null) {
                    writeMeasure("flooring.portion.area_m2", measured);
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor={fieldId("area")}>
                Floor area (m²)
              </Label>
              <Input
                className="h-11 md:h-9"
                id={fieldId("area")}
                type="number"
                inputMode="decimal"
                step="0.01"
                defaultValue={portion.area_m2 ?? ""}
                data-flooring-area={portion.id}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || !(next > 0)) return;
                  writeMeasure("flooring.portion.area_m2", next);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              data-flooring-save-measurements={portion.id}
              onClick={() => {
                const lengthInput = document.getElementById(
                  fieldId("length")
                ) as HTMLInputElement | null;
                const widthInput = document.getElementById(
                  fieldId("width")
                ) as HTMLInputElement | null;
                const areaInput = document.getElementById(
                  fieldId("area")
                ) as HTMLInputElement | null;
                const length = Number(lengthInput?.value);
                const width = Number(widthInput?.value);
                const area = Number(areaInput?.value);
                if (Number.isFinite(length) && length > 0) {
                  writeMeasure("flooring.portion.length_m", length);
                }
                if (Number.isFinite(width) && width > 0) {
                  writeMeasure("flooring.portion.width_m", width);
                }
                const measured = flooringMeasuredAreaM2({
                  length_m: Number.isFinite(length) && length > 0 ? length : portion.length_m,
                  width_m: Number.isFinite(width) && width > 0 ? width : portion.width_m,
                });
                const nextArea =
                  Number.isFinite(area) && area > 0 ? area : measured;
                if (nextArea != null) {
                  writeMeasure("flooring.portion.area_m2", nextArea);
                }
              }}
            >
              Save room size
            </Button>
          </Group>
        );
      })}
    </div>
  );
}
