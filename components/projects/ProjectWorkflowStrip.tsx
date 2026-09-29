"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  deriveProjectWorkflow,
  type ProjectWorkflowInput,
  type WorkflowGroupId,
  type WorkflowStageModel,
} from "@/lib/projects/workflow-orientation";
import { cn } from "@/lib/utils";

const GROUPS: { id: WorkflowGroupId; label: string }[] = [
  { id: "define", label: "Define the job" },
  { id: "price", label: "Build the price" },
  { id: "send", label: "Send and manage" },
];

export function ProjectWorkflowStrip(props: ProjectWorkflowInput) {
  const model = deriveProjectWorkflow(props);
  const position = model.stages.findIndex((stage) => stage.viewing) + 1;

  return (
    <section
      aria-label="Project workflow"
      data-workflow-strip="true"
      className="mb-3 overflow-x-hidden rounded-md border border-border bg-card text-sm text-foreground motion-reduce:transition-none"
    >
      <div className="hidden gap-6 px-4 py-3 md:grid md:grid-cols-3">
        {GROUPS.map((group) => (
          <div key={group.id} className="min-w-0">
            <p className="text-muted-foreground">{group.label}</p>
            <ul className="mt-2 space-y-2">
              {model.stages
                .filter((stage) => stage.groupId === group.id)
                .map((stage) => (
                  <li key={stage.id} className="min-w-0">
                    <StageControl stage={stage} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        className="px-4 py-3 md:hidden"
        aria-current="page"
        data-workflow-stage={model.current.id}
        data-workflow-status={model.current.status}
        data-workflow-locked={model.current.locked ? "true" : "false"}
      >
        <p className="text-muted-foreground">{model.current.groupLabel}</p>
        <p className="mt-1">
          <span className="font-medium">{model.current.label}</span>
          <span className="text-muted-foreground">
            {" "}
            · {position} of {model.stages.length} · {model.current.displayStatus}
          </span>
        </p>
        <p className="mt-1 text-muted-foreground">{model.current.detail}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <AdjacentControl label="Previous" stage={model.previous} />
          <AdjacentControl label="Next" stage={model.next} />
        </div>
      </div>
    </section>
  );
}

function StageControl({ stage }: { stage: WorkflowStageModel }) {
  const body = (
    <>
      <span className="font-medium">{stage.label}</span>{" "}
      <span className={stage.viewing ? "text-foreground" : "text-muted-foreground"}>
        {stage.displayStatus}
      </span>
      {stage.locked || stage.viewing || stage.status === "Needs attention" ? (
        <span className="mt-0.5 block text-muted-foreground">{stage.detail}</span>
      ) : null}
    </>
  );

  return (
    <StageShell stage={stage} className="block min-h-11 py-1">
      {body}
    </StageShell>
  );
}

function AdjacentControl({
  label,
  stage,
}: {
  label: string;
  stage: WorkflowStageModel | null;
}) {
  if (!stage) {
    return (
      <p className="min-h-11 text-muted-foreground">
        <span className="block">{label}</span>
        <span>None</span>
      </p>
    );
  }

  return (
    <StageShell stage={stage} className="flex min-h-11 flex-col justify-center">
      <span className="text-muted-foreground">{label}</span>
      <span>
        {stage.label}
        <span className="text-muted-foreground"> · {stage.displayStatus}</span>
      </span>
    </StageShell>
  );
}

function StageShell({
  stage,
  className,
  children,
}: {
  stage: WorkflowStageModel;
  className: string;
  children: ReactNode;
}) {
  const shared = cn(
    "min-w-0 rounded-sm px-1 text-left motion-reduce:transition-none",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]",
    stage.viewing &&
      "underline decoration-[var(--brand-orange)] decoration-2 underline-offset-4",
    className
  );

  if (stage.href) {
    return (
      <Link
        href={stage.href}
        prefetch
        aria-current={stage.viewing ? "page" : undefined}
        data-workflow-stage={stage.id}
        data-workflow-status={stage.status}
        data-workflow-locked="false"
        className={shared}
      >
        {children}
      </Link>
    );
  }

  return (
    <p
      data-workflow-stage={stage.id}
      data-workflow-status={stage.status}
      data-workflow-locked={stage.locked ? "true" : "false"}
      className={shared}
    >
      {stage.locked ? <span className="sr-only">Unavailable. </span> : null}
      {children}
    </p>
  );
}
