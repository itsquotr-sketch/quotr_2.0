"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPricingMoney } from "@/lib/pricing/format";
import type { PricingItemInput } from "@/lib/pricing/types";
import { UseSubcontractorRate } from "@/components/projects/UseSubcontractorRate";
import type { SupplierPriceLine, SupplierPriceReview } from "@/lib/subcontractors/rate-use-actions";

const SupplierPriceContext = createContext<SupplierPriceReview | null>(null);

export function SupplierPriceProvider({
  value,
  children,
}: {
  value: SupplierPriceReview | null;
  children: React.ReactNode;
}) {
  return <SupplierPriceContext.Provider value={value}>{children}</SupplierPriceContext.Provider>;
}

export function useSupplierPriceLine(itemId: string): SupplierPriceLine | null {
  const review = useContext(SupplierPriceContext);
  return review?.byItemId[itemId] ?? null;
}

function sellChoice(treatment: string): string {
  if (treatment === "keep") return "The client sell was kept when this rate was used.";
  if (treatment === "manual") return "The client sell was entered by the builder.";
  if (treatment === "target_margin") return "The client sell was repriced to the job target.";
  return "The client sell was chosen when this rate was used.";
}

export function SupplierPriceEditor({
  itemId,
  form,
  setForm,
  error,
  isPending,
  onSave,
  onCancel,
}: {
  itemId: string;
  form: PricingItemInput;
  setForm: React.Dispatch<React.SetStateAction<PricingItemInput>>;
  error?: string | null;
  isPending?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const review = useContext(SupplierPriceContext);
  const line = review?.byItemId[itemId];
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  if (!review || !line) return null;
  const loss = line.supplierCost > line.clientSell;
  return (
    <div className="grid gap-3" data-supplier-price={itemId}>
      <p className="text-sm">Supplier cost and client sell stay as confirmed. A normal edit does not recalculate them.</p>
      <dl className="grid gap-2 text-sm" data-supplier-money>
        <div>
          <dt className="text-xs text-muted-foreground">Supplier cost</dt>
          <dd className="tabular-nums">{formatPricingMoney(line.supplierCost)} ex GST</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Client sell</dt>
          <dd className="tabular-nums">{formatPricingMoney(line.clientSell)} ex GST</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{line.schedule ? "Response version" : "Rate version"}</dt>
          <dd>
            {line.schedule ? (
              <Link className="underline" href={`/app/projects/${line.schedule.projectId}/requests/${line.schedule.rfqId}#rfq-response-${line.schedule.responseId}`}>
                Version {line.schedule.versionNumber}
              </Link>
            ) : (
              <>Version {line.versionNumber}</>
            )}
            {line.quantity == null ? " · One lump sum" : ` · ${line.quantity} ${line.unit}`}
          </dd>
        </div>
      </dl>
      <p className="text-sm">{sellChoice(line.sellTreatment)}</p>
      {line.minimumApplied ? <p className="text-sm">The minimum charge was applied once to this job cost.</p> : null}
      {loss ? <p className="text-sm font-medium text-destructive">The client sell is below the supplier cost.</p> : null}
      <p className="break-words text-sm">Scope: {line.scope}</p>
      <p className="break-words text-sm">Exclusions: {line.exclusions.trim() ? line.exclusions : "None recorded"}.</p>
      <label className="grid gap-1 text-sm">
        Client label
        <Input className="h-11" value={form.client_label} onChange={(event) => setForm((current) => ({ ...current, client_label: event.target.value }))} />
      </label>
      {error ? <p ref={errorRef} className="text-sm text-destructive" role="alert" tabIndex={-1}>{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="min-h-11" disabled={isPending} onClick={onSave}>Save details</Button>
        <Button type="button" variant="ghost" className="min-h-11" disabled={isPending} onClick={onCancel}>Cancel</Button>
      </div>
      {line.rate ? (
        <UseSubcontractorRate
          projectId={review.projectId}
          area={line.area}
          rate={line.rate}
          pricing={review.pricing}
          canEdit
          buttonLabel="Review supplier price"
        />
      ) : null}
    </div>
  );
}
