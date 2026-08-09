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
  /** Called after a successful save — stay in Setup (do not force Dashboard). */
  onSaved?: () => void;
  /** Skip without writing preferences. */
  onSkip?: () => void;
};

/**
 * Initial selections: only persisted user choices count as preferences.
 * Catalogue defaultEnabled must not silently claim company preference.
 */
function getInitialSelections(state: SetupState): Record<string, boolean> {
  const saved = new Map(
    state.workAreas.map((area) => [area.work_area_type, area.enabled])
  );

  return Object.fromEntries(
    SCOPE_CATALOGUE.map((item) => [
      item.type,
      saved.has(item.type) ? Boolean(saved.get(item.type)) : false,
    ])
  );
}

export function WorkAreasStep({ state, onSaved, onSkip }: WorkAreasStepProps) {
  const [selections, setSelections] = useState<Record<string, boolean>>(() =>
    getInitialSelections(state)
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const scopesByCategory = useMemo(() => {
    return SCOPE_CATEGORIES.map((category) => ({
      category,
      scopes: SCOPE_CATALOGUE.filter((item) => item.category === category),
    })).filter((group) => group.scopes.length > 0);
  }, []);

  const selectedCount = useMemo(
    () => Object.values(selections).filter(Boolean).length,
    [selections]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
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

    setSuccess(
      selectedCount > 0
        ? "Work type preferences saved."
        : "Preferences cleared. Quotr can still estimate any supported work type."
    );
    onSaved?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What kind of work do you usually price?</CardTitle>
        <CardDescription>
          Choose the work your business commonly does. Quotr will use this to
          tailor rates, setup recommendations and calibration. You can still
          estimate other work at any time.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              {success}
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
        <CardFooter className="flex flex-wrap justify-between gap-2 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onSkip?.()}
            disabled={saving}
          >
            Skip for now
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
