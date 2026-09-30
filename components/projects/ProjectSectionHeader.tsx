"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateFinalPricingDialog } from "@/components/pricing/CreateFinalPricingDialog";
import {
  estimateStatusText,
  pricingLockReason,
  stageStatusText,
  variationsLockReason,
} from "@/lib/projects/project-section-nav";
import {
  deriveProjectWorkflow,
  type ProjectWorkflowInput,
  type WorkflowStageModel,
} from "@/lib/projects/workflow-orientation";
import { cn } from "@/lib/utils";

type ProjectSectionHeaderProps = ProjectWorkflowInput & {
  projectContext: string;
};

const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]";

export function ProjectSectionHeader({
  projectContext,
  ...workflowInput
}: ProjectSectionHeaderProps) {
  const router = useRouter();
  const [createPricingOpen, setCreatePricingOpen] = useState(false);
  const model = deriveProjectWorkflow(workflowInput);
  const estimate = stageById(model.stages, "estimate");
  const pricing = stageById(model.stages, "pricing");
  const quote = stageById(model.stages, "quote");
  const variations = stageById(model.stages, "variations");
  const informationHref = `/app/projects/${workflowInput.projectId}/information`;
  const informationCurrent = workflowInput.activeTab === "information";
  const quoteColumnCurrent = workflowInput.activeTab === "quote" || workflowInput.activeTab === "variations";
  const pricingCanCreate = !pricing.locked && pricing.href == null && pricing.status === "Ready";
  const topLevel = quoteColumnCurrent ? "quote" : workflowInput.activeTab;

  const sections = [
    {
      id: "information",
      label: "Project information",
      href: informationHref,
      disabled: false,
      hint: "",
    },
    {
      id: "assistant",
      label: "Estimate",
      href: estimate.href,
      disabled: false,
      hint: "",
    },
    {
      id: "pricing",
      label: "Pricing",
      href: pricingCanCreate ? null : pricing.href,
      disabled: pricing.locked || (pricing.href == null && !pricingCanCreate),
      hint: pricingLockReason(pricing) ?? "",
    },
    {
      id: "quote",
      label: "Quote",
      href: quote.href,
      disabled: quote.href == null,
      hint: quote.href == null ? quote.status : "",
    },
  ] as const;

  return (
    <nav aria-label="Project sections" data-project-section-header="true" className="overflow-x-hidden">
      <div
        className="hidden gap-1 rounded-lg border border-border bg-muted/40 p-1 lg:grid lg:grid-cols-4"
        data-project-section-columns="four"
      >
        <Column current={informationCurrent}>
          <Destination
            title="Project information"
            status={projectContext}
            href={informationCurrent ? null : informationHref}
            current={informationCurrent}
            column="information"
          />
        </Column>
        <Column current={estimate.viewing}>
          <Destination
            title="Estimate"
            status={estimateStatusText(estimate, workflowInput.estimateIsStale)}
            href={estimate.viewing ? null : estimate.href}
            current={estimate.viewing}
            column="estimate"
          />
        </Column>
        <Column current={pricing.viewing}>
          <Destination
            title="Pricing"
            status={stageStatusText(pricing)}
            reason={pricingLockReason(pricing)}
            href={pricing.viewing ? null : pricing.href}
            current={pricing.viewing}
            column="pricing"
            onCreate={pricingCanCreate ? () => setCreatePricingOpen(true) : undefined}
          />
        </Column>
        <Column current={quoteColumnCurrent}>
          <Destination
            title="Quote"
            status={stageStatusText(quote)}
            href={quote.viewing ? null : quote.href}
            current={quote.viewing}
            column="quote"
          />
          <Destination
            title="Variations"
            status={stageStatusText(variations)}
            reason={variationsLockReason(variations)}
            href={variations.viewing ? null : variations.href}
            current={variations.viewing}
            column="variations"
          />
        </Column>
      </div>

      <div className="grid gap-2 lg:hidden">
        <label className="grid gap-1">
          <span className="text-xs leading-4 text-foreground/70">Project section</span>
          <select
            aria-label="Project section"
            data-project-section-select
            value={topLevel}
            className={cn(
              "h-11 min-h-11 w-full rounded-md border border-border bg-card px-3 text-base text-foreground",
              focusClass
            )}
            onChange={(event) => {
              const next = sections.find((section) => section.id === event.target.value);
              if (!next || next.disabled || next.id === topLevel) return;
              if (next.id === "pricing" && pricingCanCreate) {
                setCreatePricingOpen(true);
                return;
              }
              if (!next.href) return;
              router.push(next.href);
            }}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id} disabled={section.disabled}>
                {section.disabled && section.hint ? `${section.label} — ${section.hint}` : section.label}
              </option>
            ))}
          </select>
          <span className="text-xs leading-4 text-foreground/75" data-project-section-context>
            {topLevel === "information"
              ? projectContext
              : topLevel === "assistant"
                ? estimateStatusText(estimate, workflowInput.estimateIsStale)
                : topLevel === "pricing"
                  ? stageStatusText(pricing)
                  : stageStatusText(quote)}
          </span>
        </label>
        {topLevel === "quote" ? (
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label="Quote section"
            data-quote-variations-control
          >
            <SectionChoice
              label="Quote"
              href={quote.href}
              current={quote.viewing}
              disabled={quote.href == null && !quote.viewing}
            />
            <SectionChoice
              label="Variations"
              href={variations.href}
              current={variations.viewing}
              disabled={variations.locked}
              reason={variationsLockReason(variations)}
            />
          </div>
        ) : null}
      </div>
      <CreateFinalPricingDialog
        projectId={workflowInput.projectId}
        open={createPricingOpen}
        onOpenChange={setCreatePricingOpen}
      />
    </nav>
  );
}

function stageById(
  stages: readonly WorkflowStageModel[],
  id: WorkflowStageModel["id"]
): WorkflowStageModel {
  const found = stages.find((stage) => stage.id === id);
  if (!found) throw new Error(`missing stage ${id}`);
  return found;
}

function Column({ current, children }: { current: boolean; children: ReactNode }) {
  return (
    <div
      data-project-column-surface={current ? "active" : "idle"}
      className={cn(
        "min-w-0 rounded-md border p-1",
        current
          ? "border-[color-mix(in_oklch,var(--brand-orange)_50%,var(--border))] bg-[color-mix(in_oklch,var(--brand-orange)_8%,white)]"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>
  );
}

function Destination({
  title,
  status,
  reason,
  href,
  current,
  column,
  onCreate,
}: {
  title: string;
  status: string;
  reason?: string | null;
  href: string | null;
  current: boolean;
  column: string;
  onCreate?: () => void;
}) {
  const locked = href == null && !current && !onCreate;
  const body = (
    <>
      <span className="block text-sm font-semibold leading-5">{title}</span>
      <span className="mt-0.5 block text-xs leading-4 text-foreground/75">{status}</span>
      {reason ? (
        <span className="mt-0.5 block text-xs leading-4 text-foreground/70">{reason}</span>
      ) : null}
    </>
  );
  const className = cn(
    "block min-w-0 rounded-md border px-2.5 py-2 text-left transition-colors",
    focusClass,
    current && "border-[var(--brand-orange)] bg-[color-mix(in_oklch,var(--brand-orange)_12%,white)] shadow-[inset_3px_0_0_0_var(--brand-orange)]",
    !current && !locked && "border-border bg-white hover:border-foreground/30 hover:bg-muted/50",
    locked && "border-border/70 bg-muted/50 text-foreground/55"
  );
  if (onCreate) {
    return (
      <button
        type="button"
        className={cn(className, "w-full")}
        data-project-column={column}
        onClick={onCreate}
      >
        {body}
      </button>
    );
  }
  if (href) {
    return (
      <Link href={href} prefetch className={className} data-project-column={column} data-variations-nav={column === "variations" ? "true" : undefined}>
        {body}
      </Link>
    );
  }
  return (
    <p
      className={className}
      aria-current={current ? "page" : undefined}
      data-project-column={column}
      data-variations-nav={column === "variations" ? "true" : undefined}
      data-project-column-locked={href == null && !current ? "true" : undefined}
    >
      {body}
    </p>
  );
}

function SectionChoice({
  label,
  href,
  current,
  disabled,
  reason,
}: {
  label: string;
  href: string | null;
  current: boolean;
  disabled: boolean;
  reason?: string | null;
}) {
  const className = cn(
    "inline-flex min-h-11 items-center justify-center rounded-md border px-3 text-center text-sm font-medium",
    focusClass,
    current
      ? "border-[var(--brand-orange)] bg-[color-mix(in_oklch,var(--brand-orange)_10%,white)] text-foreground shadow-[inset_0_-2px_0_0_var(--brand-orange)]"
      : "border-border bg-white text-foreground/80 hover:border-foreground/30 hover:bg-muted/50",
    disabled && !current && "border-border/70 bg-muted/50 text-foreground/50 hover:border-border/70 hover:bg-muted/50"
  );
  if (href && !current) {
    return (
      <Link href={href} className={className} data-project-column={label === "Variations" ? "variations" : "quote"}>
        {label}
      </Link>
    );
  }
  return (
    <p
      className={cn(className, disabled && "text-foreground/50")}
      aria-current={current ? "page" : undefined}
      data-project-column={label === "Variations" ? "variations" : "quote"}
    >
      {label}
      {reason ? <span className="sr-only">. {reason}</span> : null}
    </p>
  );
}
