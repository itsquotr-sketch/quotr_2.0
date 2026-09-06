"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanySettings } from "@/lib/settings/company-actions";
import type { CompanySettings } from "@/lib/settings/types";

type MaterialWastageDefaultsSectionProps = {
  settings: CompanySettings;
  readOnly?: boolean;
};

export function MaterialWastageDefaultsSection({
  settings,
  readOnly = false,
}: MaterialWastageDefaultsSectionProps) {
  const [defaultMaterialWastagePercent, setDefaultMaterialWastagePercent] =
    useState(String(settings.defaultMaterialWastagePercent));
  const [deckingWastagePercent, setDeckingWastagePercent] = useState(
    settings.deckingWastagePercent != null
      ? String(settings.deckingWastagePercent)
      : ""
  );
  const [sheetMaterialWastagePercent, setSheetMaterialWastagePercent] =
    useState(
      settings.sheetMaterialWastagePercent != null
        ? String(settings.sheetMaterialWastagePercent)
        : ""
    );
  const [flooringWastagePercent, setFlooringWastagePercent] = useState(
    settings.flooringWastagePercent != null
      ? String(settings.flooringWastagePercent)
      : ""
  );
  const [paintWastagePercent, setPaintWastagePercent] = useState(
    settings.paintWastagePercent != null ? String(settings.paintWastagePercent) : ""
  );
  const [timberFramingWastagePercent, setTimberFramingWastagePercent] =
    useState(
      settings.timberFramingWastagePercent != null
        ? String(settings.timberFramingWastagePercent)
        : ""
    );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setSaving(true);
    const result = await updateCompanySettings({
      defaultMaterialWastagePercent: Number(defaultMaterialWastagePercent),
      deckingWastagePercent:
        deckingWastagePercent.trim() === "" ? null : Number(deckingWastagePercent),
      sheetMaterialWastagePercent:
        sheetMaterialWastagePercent.trim() === ""
          ? null
          : Number(sheetMaterialWastagePercent),
      flooringWastagePercent:
        flooringWastagePercent.trim() === "" ? null : Number(flooringWastagePercent),
      paintWastagePercent:
        paintWastagePercent.trim() === "" ? null : Number(paintWastagePercent),
      timberFramingWastagePercent:
        timberFramingWastagePercent.trim() === ""
          ? null
          : Number(timberFramingWastagePercent),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setNotice(
      "Wastage defaults apply to new and regenerated estimates. Existing estimates stay until updated."
    );
  }

  return (
    <Card className="border-border/60 shadow-none" data-rates-wastage-defaults>
      <CardHeader>
        <CardTitle>Material wastage defaults</CardTitle>
        <CardDescription>
          Used before final pricing. You can still adjust pricing later.
          {readOnly
            ? " Only owners and admins can change company estimating defaults."
            : null}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-(--card-spacing)">
        <CardContent className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default-material-wastage">
                Default material wastage %
              </Label>
              <Input
                id="default-material-wastage"
                type="number"
                inputMode="decimal"
                min="0"
                max="50"
                step="0.1"
                value={defaultMaterialWastagePercent}
                onChange={(event) =>
                  setDefaultMaterialWastagePercent(event.target.value)
                }
                disabled={readOnly}
                required
                className="h-11"
              />
              {fieldErrors.defaultMaterialWastagePercent?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.defaultMaterialWastagePercent[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="decking-wastage">Decking board wastage %</Label>
              <Input
                id="decking-wastage"
                type="number"
                inputMode="decimal"
                min="0"
                max="50"
                step="0.1"
                value={deckingWastagePercent}
                onChange={(event) => setDeckingWastagePercent(event.target.value)}
                placeholder="Uses default"
                disabled={readOnly}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sheet-material-wastage">
                Sheet material wastage %
              </Label>
              <Input
                id="sheet-material-wastage"
                type="number"
                inputMode="decimal"
                min="0"
                max="50"
                step="0.1"
                value={sheetMaterialWastagePercent}
                onChange={(event) =>
                  setSheetMaterialWastagePercent(event.target.value)
                }
                placeholder="Uses default"
                disabled={readOnly}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flooring-wastage">Flooring wastage %</Label>
              <Input
                id="flooring-wastage"
                type="number"
                inputMode="decimal"
                min="0"
                max="50"
                step="0.1"
                value={flooringWastagePercent}
                onChange={(event) => setFlooringWastagePercent(event.target.value)}
                placeholder="Uses default"
                disabled={readOnly}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paint-wastage">Paint wastage %</Label>
              <Input
                id="paint-wastage"
                type="number"
                inputMode="decimal"
                min="0"
                max="50"
                step="0.1"
                value={paintWastagePercent}
                onChange={(event) => setPaintWastagePercent(event.target.value)}
                placeholder="Uses default"
                disabled={readOnly}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timber-framing-wastage">
                Timber/framing wastage %
              </Label>
              <Input
                id="timber-framing-wastage"
                type="number"
                inputMode="decimal"
                min="0"
                max="50"
                step="0.1"
                value={timberFramingWastagePercent}
                onChange={(event) =>
                  setTimberFramingWastagePercent(event.target.value)
                }
                placeholder="Uses default"
                disabled={readOnly}
                className="h-11"
              />
            </div>
          </div>
        </CardContent>
        {readOnly ? null : (
          <CardFooter className="border-t">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save wastage defaults"}
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
