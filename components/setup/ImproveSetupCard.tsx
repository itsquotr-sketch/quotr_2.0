"use client";

import Link from "next/link";
import { useState } from "react";
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
};

const SECONDARY_IDS = new Set([
  "labour_rate",
  "work_types",
  "company_contact",
  "calibrate",
  "default_margin",
]);

export function ImproveSetupCard({ readiness }: ImproveSetupCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || readiness.needsFirstRunBasics) {
    return null;
  }

  // Prefer "Choose common work types" over "Change work types" in the card.
  const items = readiness.recommendedSetup
    .filter((item) => SECONDARY_IDS.has(item.id))
    .filter((item) => item.id !== "work_types" || item.title.startsWith("Choose"))
    .slice(0, 4);

  if (items.length === 0) {
    return null;
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
            onClick={() => setDismissed(true)}
          >
            Hide
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
                  className="font-medium text-foreground underline-offset-4 hover:underline"
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
