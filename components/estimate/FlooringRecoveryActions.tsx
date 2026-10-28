"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  flooringRateEditorHref,
  type FlooringPricingRecovery,
} from "@/lib/estimate/flooring-pricing-recovery";

type FlooringRecoveryActionsProps = {
  recovery: FlooringPricingRecovery;
  projectId?: string | null;
  workAreaId?: string | null;
  nestedItemId?: string | null;
  onDecide?: (input: {
    workAreaId: string;
    factKey: string;
    label: string;
    value: string;
    nestedItemId?: string | null;
  }) => void | Promise<void>;
};

export function FlooringRecoveryActions({
  recovery,
  projectId,
  workAreaId,
  nestedItemId,
  onDecide,
}: FlooringRecoveryActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const href =
    recovery.ratesSection && recovery.itemKey
      ? flooringRateEditorHref({
          section: recovery.ratesSection,
          itemKey: recovery.itemKey,
          projectId,
          workAreaId,
        })
      : null;

  return (
    <div
      className="space-y-2 lg:col-span-6"
      data-flooring-recovery={recovery.kind}
      data-flooring-recovery-item={recovery.itemKey ?? ""}
      data-flooring-recovery-blocks-manual={recovery.blocksManualAmount ? "true" : "false"}
    >
      <p className="text-sm font-medium">
        {recovery.roomName}: {recovery.itemLabel}
      </p>
      <p className="text-sm text-foreground/80">{recovery.missing}</p>
      <p className="text-sm text-foreground/75">{recovery.unitExplanation}</p>
      <p className="text-sm text-foreground/75">{recovery.scopeExplanation}</p>
      {href ? (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--brand-orange)] underline-offset-4 hover:underline"
          data-flooring-recovery-open="true"
        >
          Open this rate
        </Link>
      ) : null}
      {recovery.decisions.length > 0 && workAreaId && onDecide ? (
        <div className="flex flex-wrap gap-2">
          {recovery.decisions.map((choice) => (
            <Button
              key={choice.value}
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending != null}
              data-flooring-decision={choice.value}
              onClick={() => {
                setPending(choice.value);
                setMessage(null);
                void Promise.resolve(
                  onDecide({
                    workAreaId,
                    factKey: recovery.factKey ?? "",
                    label: choice.label,
                    value: choice.value,
                    nestedItemId,
                  })
                )
                  .then(() => {
                    setMessage(
                      "Answer saved. This estimate has not changed yet. Update the estimate to apply it."
                    );
                  })
                  .catch((error: unknown) => {
                    setMessage(
                      error instanceof Error ? error.message : "The answer was not saved."
                    );
                  })
                  .finally(() => setPending(null));
              }}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      ) : null}
      {message ? (
        <p className="text-sm" role="status" data-flooring-decision-saved="true">
          {message}
        </p>
      ) : null}
    </div>
  );
}
