"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPricingStatusDefinition } from "@/lib/pricing/status";
import type { PricingDocument } from "@/lib/pricing/types";

type PricingHeaderProps = {
  document: PricingDocument;
  projectTitle: string;
  isSaving?: boolean;
  onSaveDocument?: () => void;
};

export function PricingHeader({
  document,
  projectTitle,
  isSaving,
  onSaveDocument,
}: PricingHeaderProps) {
  const statusDef = getPricingStatusDefinition(document.status);

  return (
    <div className="space-y-2 border-b pb-4" data-pricing-identity-duplicate="false">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              Pricing
            </h1>
            <Badge variant={statusDef.variant}>{statusDef.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground sm:hidden">
            {projectTitle}
          </p>
        </div>

        {onSaveDocument ? (
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onSaveDocument}
            className="hidden shrink-0 md:inline-flex"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
