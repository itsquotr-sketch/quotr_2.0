"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  applyRegistrationGstToPricing,
  keepPricingDocumentGstRate,
} from "@/lib/pricing/actions";
import { pricingTaxBasisDecision } from "@/lib/pricing/gst-source";
import type { PricingDocument } from "@/lib/pricing/types";

export function PricingTaxBasisNotice({
  document,
  gstRegistered,
  defaultGstRate = null,
  canEdit = true,
  onUpdated,
}: {
  document: PricingDocument;
  gstRegistered?: boolean | null;
  defaultGstRate?: number | null;
  canEdit?: boolean;
  onUpdated?: (document: PricingDocument) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decision = pricingTaxBasisDecision({
    gstRegistered,
    defaultGstRate,
    documentGstRate: document.gst_rate,
    taxBasis: document.gst_tax_basis,
    status: document.status,
  });

  if (!decision.detail) return null;

  function run(action: "apply" | "keep") {
    setError(null);
    startTransition(async () => {
      const result =
        action === "apply"
          ? await applyRegistrationGstToPricing(document.id)
          : await keepPricingDocumentGstRate(document.id);
      if (result.error || !result.document) {
        setError(result.error ?? "The tax basis could not be saved.");
        return;
      }
      onUpdated?.(result.document);
      router.refresh();
    });
  }

  return (
    <div
      className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
      data-pricing-tax-basis={decision.override ? "override" : "mismatch"}
    >
      <p className="text-sm leading-5 text-foreground">{decision.detail}</p>
      {decision.actionable && canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-11 min-h-11"
            disabled={pending}
            onClick={() => run("apply")}
          >
            {pending ? "Saving…" : "Apply registration rate"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            disabled={pending}
            onClick={() => run("keep")}
          >
            Keep this document rate
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
