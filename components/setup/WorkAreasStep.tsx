"use client";

import { useRouter } from "next/navigation";
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
import {
  saveOrganisationWorkAreas,
  savePrimaryWorkAreas,
} from "@/lib/setup/actions";
import { SCOPE_CATALOGUE, SCOPE_CATEGORIES } from "@/lib/scopes/catalogue";
import { getFirstRunPrimaryWorkAreas } from "@/lib/setup/first-run-work-areas";
import { ScopeSelectionCard } from "./ScopeSelectionCard";
import type { SetupState } from "./types";

export type WorkAreasStepMode = "first-run" | "improve";

type WorkAreasStepProps = {
  state: SetupState;
  mode?: WorkAreasStepMode;
  /** Called after a successful save — stay in Setup (do not force Dashboard). */
  onSaved?: () => void;
  /** Skip without writing preferences. Improve mode only. */
  onSkip?: () => void;
};

/**
 * Initial selections: only persisted user choices count as preferences.
 * Catalogue defaultEnabled must not silently claim company preference.
 */
function getInitialSelections(
  state: SetupState,
  catalogueTypes: string[]
): Record<string, boolean> {
  const saved = new Map(
    state.workAreas.map((area) => [area.work_area_type, area.enabled])
  );

  return Object.fromEntries(
    catalogueTypes.map((type) => [
      type,
      saved.has(type) ? Boolean(saved.get(type)) : false,
    ])
  );
}

export function WorkAreasStep({
  state,
  mode = "improve",
  onSaved,
  onSkip,
}: WorkAreasStepProps) {
  const router = useRouter();
  const isFirstRun = mode === "first-run";
  const catalogue = useMemo(
    () => (isFirstRun ? getFirstRunPrimaryWorkAreas() : [...SCOPE_CATALOGUE]),
    [isFirstRun]
  );

  const [selections, setSelections] = useState<Record<string, boolean>>(() =>
    getInitialSelections(
      state,
      catalogue.map((item) => item.type)
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const scopesByCategory = useMemo(() => {
    return SCOPE_CATEGORIES.map((category) => ({
      category,
      scopes: catalogue.filter((item) => item.category === category),
    })).filter((group) => group.scopes.length > 0);
  }, [catalogue]);

  const selectedCount = useMemo(
    () => Object.values(selections).filter(Boolean).length,
    [selections]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (isFirstRun && selectedCount < 1) {
      setError("Choose at least one kind of work you usually price.");
      return;
    }

    setSaving(true);

    const payload = {
      selections: Object.entries(selections).map(([work_area_type, enabled]) => ({
        work_area_type,
        enabled,
      })),
    };

    const result = isFirstRun
      ? await savePrimaryWorkAreas(payload)
      : await saveOrganisationWorkAreas(payload);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (isFirstRun) {
      router.replace("/app/setup?mode=pricing");
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
        <CardTitle>Your work</CardTitle>
        <CardDescription>
          What kind of work do you usually price? Choose the work your company
          normally does. This does not limit the jobs you can estimate later.
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {scopes.map((scope) => (
                  <ScopeSelectionCard
                    key={scope.type}
                    scope={scope}
                    compact={isFirstRun}
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
          {!isFirstRun ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSkip?.()}
              disabled={saving}
            >
              Skip for now
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" className="h-11" disabled={saving}>
            {saving
              ? "Saving…"
              : isFirstRun
                ? "Continue"
                : "Save preferences"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
