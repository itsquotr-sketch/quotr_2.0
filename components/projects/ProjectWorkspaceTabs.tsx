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

  const tabClass = (isActive: boolean) =>
    cn(
      "shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
      isActive
        ? "bg-background text-foreground shadow-sm ring-1 ring-border shadow-[inset_0_-2px_0_0_var(--brand-orange)]"
        : "text-muted-foreground hover:text-foreground"
    );

  const tabClassDisabled =
    "inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap opacity-50 text-muted-foreground";

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
            prefetch
            role="tab"
            aria-selected={activeTab === "assistant"}
            className={tabClass(activeTab === "assistant")}
          >
            Project Assistant
          </Link>

          {pricingHref ? (
            <Link
              href={pricingHref}
              prefetch
              role="tab"
              aria-selected={activeTab === "pricing"}
              className={cn(
                tabClass(activeTab === "pricing"),
                "inline-flex items-center gap-1.5"
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
                tabClass(activeTab === "pricing"),
                "inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
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
              prefetch
              role="tab"
              aria-selected={activeTab === "quote"}
              className={cn(
                tabClass(activeTab === "quote"),
                "inline-flex items-center gap-1.5"
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
              title="Create a quote from reviewed final pricing on the Final Pricing tab."
              className={cn(
                tabClassDisabled,
                activeTab === "quote" &&
                  "bg-background text-foreground opacity-100 shadow-sm ring-1 ring-border shadow-[inset_0_-2px_0_0_var(--brand-orange)]"
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
