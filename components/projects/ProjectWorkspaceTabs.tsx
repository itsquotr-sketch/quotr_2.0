"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CreateFinalPricingDialog } from "@/components/pricing/CreateFinalPricingDialog";
import type { PricingSummary } from "@/lib/pricing/types";
import { formatQuoteBadgeLabel } from "@/lib/quotes/status";
import type { QuoteSummary } from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

export type ProjectWorkspaceTab = "assistant" | "pricing" | "quote";

type ProjectWorkspaceTabsProps = {
  projectId: string;
  activeTab: ProjectWorkspaceTab;
  pricingSummary: PricingSummary | null;
  quoteSummary?: QuoteSummary | null;
  hasEstimate?: boolean;
  estimateIsStale?: boolean;
};

export function ProjectWorkspaceTabs({
  projectId,
  activeTab,
  pricingSummary,
  quoteSummary = null,
  hasEstimate = false,
  estimateIsStale = false,
}: ProjectWorkspaceTabsProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const assistantHref = `/app/projects/${projectId}`;
  const pricingHref = pricingSummary
    ? `/app/projects/${projectId}/pricing/${pricingSummary.id}`
    : null;
  const quoteHref = quoteSummary
    ? `/app/projects/${projectId}/quotes/${quoteSummary.id}`
    : null;

  const pricingNotStarted = !pricingSummary;
  const pricingBlocked = estimateIsStale || !hasEstimate;

  const handlePricingTabClick = () => {
    if (pricingHref) return;
    if (pricingBlocked) return;
    setCreateDialogOpen(true);
  };

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          className="flex w-max min-w-full gap-1 rounded-lg border border-border/60 bg-muted/20 p-1 sm:w-auto"
          role="tablist"
          aria-label="Project workspace"
        >
          <Link
            href={assistantHref}
            role="tab"
            aria-selected={activeTab === "assistant"}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === "assistant"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Project Assistant
          </Link>

          {pricingHref ? (
            <Link
              href={pricingHref}
              role="tab"
              aria-selected={activeTab === "pricing"}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                activeTab === "pricing"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Final Pricing
              {pricingSummary?.status === "reviewed" ? (
                <Badge variant="outline" className="text-[10px]">
                  Reviewed
                </Badge>
              ) : null}
            </Link>
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "pricing"}
              disabled={pricingBlocked}
              title={
                estimateIsStale
                  ? "Regenerate the estimate before preparing final pricing."
                  : !hasEstimate
                    ? "Generate a quick estimate first."
                    : "Create final pricing from current estimate"
              }
              onClick={handlePricingTabClick}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                activeTab === "pricing"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Final Pricing
              {pricingNotStarted ? (
                <Badge variant="outline" className="text-[10px]">
                  Not started
                </Badge>
              ) : null}
            </button>
          )}

          {quoteHref ? (
            <Link
              href={quoteHref}
              role="tab"
              aria-selected={activeTab === "quote"}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                activeTab === "quote"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Quote
              <Badge variant="outline" className="text-[10px]">
                {formatQuoteBadgeLabel(quoteSummary!.status)}
              </Badge>
            </Link>
          ) : (
            <span
              role="tab"
              aria-selected={activeTab === "quote"}
              aria-disabled="true"
              title="Create a quote from reviewed final pricing"
              className={cn(
                "inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap opacity-50",
                activeTab === "quote"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              Quote
              <Badge variant="outline" className="text-[10px]">
                Not started
              </Badge>
            </span>
          )}
        </div>
      </div>

      <CreateFinalPricingDialog
        projectId={projectId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
