"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveOrganisationWorkAreas } from "@/lib/setup/actions";
import { SCOPE_CATALOGUE, SCOPE_CATEGORIES } from "@/lib/scopes/catalogue";
import { ScopeSelectionCard } from "./ScopeSelectionCard";
import type { SetupState } from "./types";

type WorkAreasStepProps = {
  state: SetupState;
  onComplete: () => void;
  onBack: () => void;
};

function getInitialSelections(state: SetupState): Record<string, boolean> {
  const saved = new Map(
    state.workAreas.map((area) => [area.work_area_type, area.enabled])
  );

  return Object.fromEntries(
    SCOPE_CATALOGUE.map((item) => [
      item.type,
      saved.has(item.type) ? saved.get(item.type)! : item.defaultEnabled,
    ])
  );
}

export function WorkAreasStep({ state, onComplete, onBack }: WorkAreasStepProps) {
  const [selections, setSelections] = useState<Record<string, boolean>>(() =>
    getInitialSelections(state)
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const scopesByCategory = useMemo(() => {
    return SCOPE_CATEGORIES.map((category) => ({
      category,
      scopes: SCOPE_CATALOGUE.filter((item) => item.category === category),
    })).filter((group) => group.scopes.length > 0);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const result = await saveOrganisationWorkAreas({
      selections: Object.entries(selections).map(([work_area_type, enabled]) => ({
        work_area_type,
        enabled,
      })),
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onComplete();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work areas</CardTitle>
        <CardDescription>
          Choose the types of work your business commonly prices. You can change
          this later.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {scopesByCategory.map(({ category, scopes }) => (
            <section key={category} className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">{category}</h3>
              <div className="space-y-2">
                {scopes.map((scope) => (
                  <ScopeSelectionCard
                    key={scope.type}
                    scope={scope}
                    enabled={selections[scope.type] ?? false}
                    onToggle={(enabled) =>
                      setSelections((prev) => ({
                        ...prev,
                        [scope.type]: enabled,
                      }))
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </CardContent>
        <CardFooter className="justify-between border-t">
          <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
            Back
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save and continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
