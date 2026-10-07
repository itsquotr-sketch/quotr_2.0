"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { reconcileSubcontractorRateUse } from "@/lib/subcontractors/rate-use-actions";

export function RateReconciliationNotice({
  projectId,
  pricingDocumentId,
  pending,
  canEdit,
}: {
  projectId: string;
  pricingDocumentId: string;
  pending: Array<{ id: string; scope: string; allowanceLabel: string }>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  if (pending.length === 0) return null;

  async function decide(applicationId: string, decision: "keep" | "drop") {
    setPendingId(applicationId);
    setError(null);
    const result = await reconcileSubcontractorRateUse({
      projectId,
      pricingDocumentId,
      applicationId,
      decision,
    });
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 text-sm" data-rate-reconciliation>
      <p className="font-medium">The estimate was regenerated. Choose what happens to each supplier rate. Nothing is dropped or added until you choose.</p>
      {pending.map((item) => (
        <div key={item.id} className="grid gap-2 rounded-md border border-border p-3">
          <p className="break-words">{item.allowanceLabel}</p>
          <p className="break-words text-muted-foreground">{item.scope}</p>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="h-11 min-h-11" disabled={pendingId === item.id} onClick={() => void decide(item.id, "keep")}>
                Keep this supplier rate
              </Button>
              <Button type="button" variant="outline" className="h-11 min-h-11" disabled={pendingId === item.id} onClick={() => void decide(item.id, "drop")}>
                Remove it and use the estimate
              </Button>
            </div>
          ) : (
            <p>You can read this choice. You cannot change it.</p>
          )}
        </div>
      ))}
      {error ? <p className="text-destructive" role="alert">{error}</p> : null}
    </section>
  );
}
