"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPricingStatusDefinition } from "@/lib/pricing/status";
import type { PricingDocument } from "@/lib/pricing/types";

type PricingHeaderProps = {
  projectId: string;
  projectTitle: string;
  document: PricingDocument;
  isSaving?: boolean;
  onSaveDocument?: () => void;
  onMarkReviewed?: () => void;
};

export function PricingHeader({
  projectId,
  projectTitle,
  document,
  isSaving,
  onSaveDocument,
  onMarkReviewed,
}: PricingHeaderProps) {
  const router = useRouter();
  const [isReviewing, startReview] = useTransition();
  const statusDef = getPricingStatusDefinition(document.status);

  const handleMarkReviewed = () => {
    if (!onMarkReviewed) return;
    startReview(async () => {
      await onMarkReviewed();
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 border-b pb-6">
      <Link
        href={`/app/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to project
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Final Pricing
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {document.title}
            </h1>
            <Badge variant={statusDef.variant}>{statusDef.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{projectTitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSaveDocument ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onSaveDocument}
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
          {document.status !== "reviewed" && onMarkReviewed ? (
            <Button
              type="button"
              disabled={isReviewing || isSaving}
              onClick={handleMarkReviewed}
            >
              {isReviewing ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Marking…
                </>
              ) : (
                "Mark as reviewed"
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
