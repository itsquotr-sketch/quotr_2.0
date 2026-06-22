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

function buildMetaLine(document: PricingDocument, projectTitle: string): string {
  const parts = [projectTitle];
  if (document.client_name) parts.push(document.client_name);
  if (document.site_address) parts.push(document.site_address);
  return parts.join(" · ");
}

export function PricingHeader({
  document,
  projectTitle,
  isSaving,
  onSaveDocument,
}: PricingHeaderProps) {
  const statusDef = getPricingStatusDefinition(document.status);

  return (
    <div className="space-y-3 border-b pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Final Pricing
            </h1>
            <Badge variant={statusDef.variant}>{statusDef.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {buildMetaLine(document, projectTitle)}
          </p>
        </div>

        {onSaveDocument ? (
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onSaveDocument}
            className="shrink-0"
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
