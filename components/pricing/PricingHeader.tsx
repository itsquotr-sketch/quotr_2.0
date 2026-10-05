"use client";

import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { getPricingStatusDefinition } from "@/lib/pricing/status";
import type { PricingDocument } from "@/lib/pricing/types";

type PricingHeaderProps = {
  document: PricingDocument;
  isSaving?: boolean;
  actionsLocked?: boolean;
  hasUnsavedChanges?: boolean;
  onSaveDocument?: () => void;
  statusNote?: ReactNode;
};

export function PricingHeader({
  document,
  isSaving,
  actionsLocked = false,
  hasUnsavedChanges = false,
  onSaveDocument,
  statusNote,
}: PricingHeaderProps) {
  const statusDef = getPricingStatusDefinition(document.status);

  return (
    <div className="space-y-2" data-pricing-identity-duplicate="false">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold leading-6 tracking-tight sm:text-xl">
              Pricing
            </h2>
            <StatusBadge variant={statusDef.variant}>{statusDef.label}</StatusBadge>
          </div>
          {statusNote}
        </div>

        {onSaveDocument && hasUnsavedChanges ? (
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={isSaving || actionsLocked}
            onClick={onSaveDocument}
            className="hidden shrink-0 md:inline-flex"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
