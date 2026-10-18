"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { confirmCeilingProvisionalPackage } from "@/lib/pricing/actions";
import type { PricingDocument, PricingItem } from "@/lib/pricing/types";
import {
  CEILING_PROVISIONAL_CONFIRM_LABEL,
  CEILING_PROVISIONAL_REPLACE_HINT,
  CEILING_PROVISIONAL_SCOPE,
  ceilingProvisionalDecision,
  ceilingProvisionalLineFromPricingItem,
} from "@/lib/estimate/ceilings-provisional-package";

type CeilingProvisionalDecisionProps = {
  items: PricingItem[];
  document: PricingDocument;
  canEdit: boolean;
  onConfirmed: (document: PricingDocument) => void;
  onError: (message: string) => void;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(value);
}

export function CeilingProvisionalDecision({
  items,
  document,
  canEdit,
  onConfirmed,
  onError,
}: CeilingProvisionalDecisionProps) {
  const [pending, startConfirm] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const decision = ceilingProvisionalDecision({
    lines: items.map((item) => ceilingProvisionalLineFromPricingItem(item)),
    confirmation: document.provisional_ceiling_confirmation ?? null,
    documentOrgId: document.org_id,
  });
  if (decision.active.length === 0) return null;

  const confirm = () => {
    setLocalError(null);
    startConfirm(async () => {
      const result = await confirmCeilingProvisionalPackage(document.id);
      if (result.error || !result.document) {
        const message = result.error ?? "Pricing could not be saved.";
        setLocalError(message);
        onError(message);
        return;
      }
      onConfirmed(result.document);
    });
  };

  return (
    <section
      className="rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50"
      aria-labelledby="ceiling-provisional-heading"
      data-ceiling-provisional-decision="true"
      data-ceiling-provisional-confirmable={decision.confirmable ? "true" : "false"}
      data-ceiling-provisional-confirmed={decision.confirmed ? "true" : "false"}
    >
      <h2 id="ceiling-provisional-heading" className="text-base font-semibold leading-snug">
        {CEILING_PROVISIONAL_SCOPE.heading}
      </h2>
      <p className="mt-1 text-sm leading-5">{CEILING_PROVISIONAL_SCOPE.statement}</p>
      <h3 className="mt-3 text-sm font-semibold">Included</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-5">
        {CEILING_PROVISIONAL_SCOPE.includes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <h3 className="mt-3 text-sm font-semibold">Not included</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-5">
        {CEILING_PROVISIONAL_SCOPE.excludes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-1 text-sm leading-5">{CEILING_PROVISIONAL_SCOPE.excludesNote}</p>
      <h3 className="mt-3 text-sm font-semibold">This draft</h3>
      <ul className="mt-1 space-y-2 text-sm leading-5">
        {decision.active.map((line) => (
          <li key={line.id} className="rounded-md border border-amber-300/70 px-3 py-2">
            <p className="font-medium">{line.description.split(". ")[0]}</p>
            <p>
              {line.quantity ?? "—"} {line.unit ?? ""} · Source: {line.source}
            </p>
            <p>
              Cost {money(line.totalCost)} · Sell {money(line.totalSell)}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-5">
        Still to confirm: {CEILING_PROVISIONAL_SCOPE.remains}
      </p>
      {decision.confirmed ? (
        <p className="mt-2 text-sm font-medium" role="status">
          Confirmed for this job.
        </p>
      ) : null}
      {decision.block && !decision.confirmable ? (
        <p className="mt-2 text-sm font-medium" role="alert">
          {decision.block}
        </p>
      ) : null}
      {decision.confirmable && canEdit ? (
        <Button
          type="button"
          className="mt-3 h-11 min-h-11 scroll-mb-[11rem] md:scroll-mb-0"
          disabled={pending}
          aria-pressed={decision.confirmed}
          data-ceiling-provisional-confirm="true"
          onClick={confirm}
        >
          {pending ? "Saving…" : CEILING_PROVISIONAL_CONFIRM_LABEL}
        </Button>
      ) : null}
      {!canEdit ? (
        <p className="mt-2 text-sm leading-5">
          You can view this package. Confirming it needs permission to edit Pricing.
        </p>
      ) : null}
      {localError ? (
        <p className="mt-2 text-sm font-medium" role="alert">
          {localError}
        </p>
      ) : null}
      <p className="mt-3 text-sm leading-5">{CEILING_PROVISIONAL_REPLACE_HINT}</p>
    </section>
  );
}
