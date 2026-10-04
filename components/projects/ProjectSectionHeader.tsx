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
      step: "1",
      label: "Project information",
      href: informationHref,
      disabled: false,
      hint: "",
    },
    {
      id: "assistant",
      step: "2",
      label: "Estimate",
      href: estimate.href,
      disabled: false,
      hint: "",
    },
    {
      id: "pricing",
      step: "3",
      label: "Pricing",
      href: pricingCanCreate ? null : pricing.href,
      disabled: pricing.locked || (pricing.href == null && !pricingCanCreate),
      hint: pricingLockReason(pricing) ?? "",
    },
    {
      id: "quote",
      step: "4",
      label: "Quote",
      href: quote.href,
      disabled: quote.href == null,
      hint: quote.href == null ? quote.status : "",
    },
  ] as const;

  const activeSection = sections.find((section) => section.id === topLevel) ?? sections[0];
  const activeDetail =
    topLevel === "information"
      ? projectContext
      : topLevel === "assistant"
        ? statusDetail(estimateStatusText(estimate, workflowInput.estimateIsStale))
        : topLevel === "pricing"
          ? statusDetail(stageStatusText(pricing))
          : statusDetail(stageStatusText(quote));

  return (
    <nav aria-label="Project sections" data-project-section-header="true" className="overflow-x-hidden">
      <div className="hidden lg:block" data-project-progression="rail">
        <div
          className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-muted/30 p-1 lg:grid-cols-4"
          data-project-section-columns="four"
        >
          <Stage
            step="1"
            title="Project information"
            status={projectContext}
            href={informationCurrent ? null : informationHref}
            current={informationCurrent}
            column="information"
          />
          <Stage
            step="2"
            title="Estimate"
            status={estimateStatusText(estimate, workflowInput.estimateIsStale)}
            href={estimate.viewing ? null : estimate.href}
            current={estimate.viewing}
            column="estimate"
          />
          <Stage
            step="3"
            title="Pricing"
            status={stageStatusText(pricing)}
            reason={pricingLockReason(pricing)}
            href={pricing.viewing ? null : pricing.href}
            current={pricing.viewing}
            column="pricing"
            onCreate={pricingCanCreate ? () => setCreatePricingOpen(true) : undefined}
          />
          <Stage
            step="4"
            title="Quote"
            status={stageStatusText(quote)}
            href={quote.viewing ? null : quote.href}
            current={quote.viewing}
            column="quote"
          />
        </div>
        <div
          className="mt-1.5 flex min-w-0 items-center justify-between gap-3"
          data-project-variations-row
        >
          <p className="text-xs leading-4 text-foreground/70">Separate from Quote</p>
          <Destination
            title="Variations"
            status={stageStatusText(variations)}
            reason={variationsLockReason(variations)}
            href={variations.viewing ? null : variations.href}
            current={variations.viewing}
            column="variations"
            compact
          />
        </div>
      </div>

      <div className="grid gap-1.5 lg:hidden">
        <label className="grid gap-1">
          <span className="text-xs leading-4 text-foreground/70">Project section</span>
          <span className="text-sm font-semibold leading-5" data-project-stage-current>
            Step {activeSection.step}. {activeSection.label}
          </span>
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
                {section.disabled && section.hint
                  ? `${section.step}. ${section.label} — ${section.hint}`
                  : `${section.step}. ${section.label}`}
              </option>
            ))}
          </select>
          <span className="sr-only" data-project-section-context>
            {activeDetail}
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

function statusDetail(status: string) {
  return status.endsWith(" · Current") ? status.slice(0, -" · Current".length) : status;
}

function Stage({
  step,
  title,
  status,
  reason,
  href,
  current,
  column,
  onCreate,
}: {
  step: string;
  title: string;
  status: string;
  reason?: string | null;
  href: string | null;
  current: boolean;
  column: string;
  onCreate?: () => void;
}) {
  const detail = [statusDetail(status), reason].filter(Boolean).join(" · ");
  return (
    <Destination
      title={title}
      status={detail}
      href={href}
      current={current}
      column={column}
      onCreate={onCreate}
      step={step}
    />
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
  step,
  compact = false,
}: {
  title: string;
  status: string;
  reason?: string | null;
  href: string | null;
  current: boolean;
  column: string;
  onCreate?: () => void;
  step?: string;
  compact?: boolean;
}) {
  const locked = href == null && !current && !onCreate;
  const detail = compact ? [statusDetail(status), reason].filter(Boolean).join(" · ") : status;
  const body = compact ? (
    <>
      <span className="text-xs font-semibold leading-4">{title}</span>
      <span className="min-w-0 truncate text-xs leading-4 text-foreground/75">{detail}</span>
      {current ? <span className="text-xs font-medium leading-4">Current</span> : null}
    </>
  ) : (
    <>
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full border text-xs font-medium leading-4",
            current
              ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
              : "border-border text-foreground/60",
            locked && "border-border/70 text-foreground/45"
          )}
        >
          {step}
        </span>
        {current ? <span className="text-xs font-medium leading-4">Current</span> : null}
      </span>
      <span className="block text-sm font-semibold leading-5">{title}</span>
      <span className="line-clamp-2 block text-xs leading-4 text-foreground/75">{status}</span>
    </>
  );
  const className = cn(
    focusClass,
    compact
      ? "inline-flex max-w-full min-w-0 items-center gap-2 rounded-md border px-2.5 py-1 text-left"
      : "flex h-full min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2 text-left",
    current && "border-foreground/70 bg-muted/60 text-foreground",
    !current && !locked && "border-border/80 bg-card hover:border-foreground/25 hover:bg-muted/40",
    locked && "border-border/70 bg-muted/40 text-foreground/55 hover:border-border/70 hover:bg-muted/40"
  );
  if (onCreate) {
    return (
      <button
        type="button"
        className={cn(className, compact ? undefined : "w-full")}
        data-project-column={column}
        data-project-stage={step}
        onClick={onCreate}
      >
        {body}
      </button>
    );
  }
  if (href) {
    return (
      <Link
        href={href}
        prefetch
        className={className}
        data-project-column={column}
        data-project-stage={step}
        data-variations-nav={column === "variations" ? "true" : undefined}
      >
        {body}
      </Link>
    );
  }
  return (
    <p
      className={className}
      aria-current={current ? "page" : undefined}
      data-project-column={column}
      data-project-stage={step}
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
    "inline-flex min-h-11 items-center justify-center gap-1 rounded-md border px-3 text-center text-sm font-medium",
    focusClass,
    current
      ? "border-foreground/80 bg-muted/50 font-semibold text-foreground"
      : "border-border bg-white text-foreground/80 hover:border-foreground/30 hover:bg-muted/50",
    disabled && !current && "border-border/70 bg-muted/50 text-foreground/50 hover:border-border/70 hover:bg-muted/50"
  );
  const content: ReactNode = (
    <>
      {label}
      {current ? <span className="text-xs font-medium">Current</span> : null}
    </>
  );
  if (href && !current) {
    return (
      <Link href={href} className={className} data-project-column={label === "Variations" ? "variations" : "quote"}>
        {content}
      </Link>
    );
  }
  return (
    <p
      className={cn(className, disabled && "text-foreground/50")}
      aria-current={current ? "page" : undefined}
      data-project-column={label === "Variations" ? "variations" : "quote"}
    >
      {content}
      {reason ? <span className="sr-only">. {reason}</span> : null}
    </p>
  );
}
