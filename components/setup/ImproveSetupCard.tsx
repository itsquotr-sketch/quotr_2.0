"use client";

import Link from "next/link";
import { useId, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CompanySetupReadiness } from "@/lib/setup/readiness";
import { cn } from "@/lib/utils";

type ImproveSetupCardProps = {
  readiness: CompanySetupReadiness;
  /** When true, default to collapsed unless the user expanded previously. */
  hasProjects?: boolean;
};

const SECONDARY_IDS = new Set([
  "labour_rate",
  "work_types",
  "company_contact",
  "calibrate",
  "calibrate_another",
  "default_margin",
]);

const STORAGE_KEY = "quotr.setupGuidance.collapsed";

const listeners = new Set<() => void>();

function emitCollapsedChange() {
  for (const listener of listeners) listener();
}

function subscribeCollapsed(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

function readStoredCollapsed(defaultCollapsed: boolean): boolean {
  if (typeof window === "undefined") return defaultCollapsed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // Presentation-only preference — ignore storage failures.
  }
  return defaultCollapsed;
}

function writeStoredCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // ignore
  }
  emitCollapsedChange();
}

export function ImproveSetupCard({
  readiness,
  hasProjects = false,
}: ImproveSetupCardProps) {
  const panelId = useId();
  const defaultCollapsed = hasProjects;
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    () => readStoredCollapsed(defaultCollapsed),
    () => defaultCollapsed
  );

  if (readiness.needsFirstRunBasics) {
    return null;
  }

  // Prefer "Choose common work types" over "Change work types" in the card.
  const items = readiness.recommendedSetup
    .filter((item) => SECONDARY_IDS.has(item.id))
    .filter((item) => item.id !== "work_types" || item.title.startsWith("Choose"))
    .filter((item) => {
      if (item.id === "labour_rate" && readiness.hasLabourRate) return false;
      // First-run already offered 20% default; don't nag confirmation.
      if (item.id === "default_margin") return false;
      return true;
    })
    .slice(0, 1);

  if (items.length === 0) {
    return null;
  }

  const countLabel =
    items.length === 1
      ? "1 recommendation to improve estimate accuracy"
      : `${items.length} recommendations to improve estimate accuracy`;

  function toggleCollapsed() {
    writeStoredCollapsed(!collapsed);
  }

  if (collapsed) {
    return (
      <Card className="border-border/70 bg-muted/15 shadow-none">
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <p className="min-w-0 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Improve Quotr for your business
            </span>
            <span className="mt-0.5 block sm:mt-0 sm:ml-2 sm:inline">
              {countLabel}
            </span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground"
            aria-expanded={false}
            aria-controls={panelId}
            onClick={toggleCollapsed}
          >
            Expand
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-muted/15 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">
              Improve Quotr for your business
            </CardTitle>
            <CardDescription>
              Optional. Creating a project comes first — these tips improve
              accuracy when you are ready.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground"
            aria-expanded={true}
            aria-controls={panelId}
            onClick={toggleCollapsed}
          >
            Collapse
          </Button>
        </div>
      </CardHeader>
      <CardContent id={panelId} className="space-y-3">
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 text-emerald-600" aria-hidden>
              ✓
            </span>
            <span>
              <span className="font-medium">Company basics</span>
              <span className="text-muted-foreground">
                {" "}
                · {readiness.currency} / {readiness.country} · GST{" "}
                {readiness.defaultGstRate}%
              </span>
            </span>
          </li>
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-0.5",
                  item.severity === "required"
                    ? "text-amber-600"
                    : "text-muted-foreground"
                )}
                aria-hidden
              >
                ○
              </span>
              <span className="min-w-0">
                <Link
                  href={item.href}
                  className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
                >
                  {item.title}
                </Link>
                <span className="mt-0.5 block text-muted-foreground">
                  {item.reason}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
