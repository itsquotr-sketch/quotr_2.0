import type { ReactNode } from "react";
import Link from "next/link";
import { PROJECT_DOCUMENT_OWNERSHIP } from "@/components/projects/information/project-documents";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import type {
  ProjectInformationField,
  ProjectInformationModel,
} from "@/lib/projects/project-information";

type ProjectInformationWorkspaceProps = {
  model: ProjectInformationModel;
};

export function ProjectInformationWorkspace({
  model,
}: ProjectInformationWorkspaceProps) {
  return (
    <div
      className="min-w-0 space-y-4 overflow-x-hidden"
      data-project-information="true"
      data-project-documents-owner={PROJECT_DOCUMENT_OWNERSHIP}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-6">Project information</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-foreground/75">
            Client, site, and job context. Estimate, Pricing, Quote, and Variations stay the commercial workflow.
          </p>
        </div>
        <Link
          href={model.estimateHref}
          data-project-information-estimate="true"
          className="inline-flex min-h-11 items-center text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
        >
          Back to Estimate
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <InfoCard title="Overview">
          <FieldList fields={model.overview} />
        </InfoCard>
        <InfoCard title="Estimate">
          <p className="text-sm leading-5" data-project-information-estimate-state={model.estimateState}>
            {model.estimateLabel}
          </p>
          <Link
            href={model.estimateHref}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
          >
            Open Estimate
          </Link>
        </InfoCard>
        <InfoCard title="Job and site" className="lg:col-span-2">
          {model.job.length > 0 ? <FieldList fields={model.job} /> : (
            <p className="text-sm leading-5 text-foreground/75">No job brief or site notes stored yet.</p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <RecordLink href={model.estimateHref} dataAttribute="edit-job">
              {ASSISTANT_ACTION_LABELS.editJobDetails}
            </RecordLink>
            <RecordLink href={model.estimateHref} dataAttribute="review-work-areas">
              Review Work Area details
            </RecordLink>
          </div>
        </InfoCard>
        {model.captured.length > 0 ? (
          <InfoCard title="Captured details" className="lg:col-span-2">
            <CapturedList items={model.captured} />
          </InfoCard>
        ) : null}
        {model.conditions.length > 0 ? (
          <InfoCard title="Conditions" className="lg:col-span-2">
            <FieldList fields={model.conditions} />
          </InfoCard>
        ) : null}
        <InfoCard title="Work Areas" className="lg:col-span-2">
          {model.workAreas.length > 0 ? (
            <ul className="space-y-2">
              {model.workAreas.map((area, index) => (
                <li
                  key={`${area.name}-${area.status}-${index}`}
                  className="grid gap-1 border-t border-border/70 py-2 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline"
                  data-project-information-work-area={area.name}
                >
                  <span className="break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">
                    {area.name}
                  </span>
                  <span className="text-sm leading-5 text-foreground/75">
                    {area.status}
                    <span className="text-foreground/50"> · </span>
                    {area.completeness}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-5 text-foreground/75">No Work Areas detected yet.</p>
          )}
        </InfoCard>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-border/70 bg-card px-4 py-3 ${className ?? ""}`}>
      <h3 className="text-base font-semibold leading-snug">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FieldList({ fields }: { fields: readonly ProjectInformationField[] }) {
  return (
    <dl className="space-y-2">
      {fields.map((field) => (
        <div key={field.label}>
          <dt className="text-xs leading-4 text-foreground/70">{field.label}</dt>
          <dd className="mt-0.5 break-words text-sm leading-5 [overflow-wrap:anywhere]">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CapturedList({
  items,
}: {
  items: ProjectInformationModel["captured"];
}) {
  const groups = new Map<string, ProjectInformationModel["captured"][number][]>();
  for (const item of items) {
    const current = groups.get(item.workArea) ?? [];
    current.push(item);
    groups.set(item.workArea, current);
  }
  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([workArea, rows]) => (
        <div key={workArea}>
          <p className="text-sm font-medium leading-5">{workArea}</p>
          <dl className="mt-1 space-y-2">
            {rows.map((row) => (
              <div key={`${workArea}-${row.label}`}>
                <dt className="text-xs leading-4 text-foreground/70">{row.label}</dt>
                <dd className="mt-0.5 break-words text-sm leading-5 [overflow-wrap:anywhere]">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function RecordLink({
  href,
  dataAttribute,
  children,
}: {
  href: string;
  dataAttribute: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      data-project-information-record={dataAttribute}
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
    >
      {children}
    </Link>
  );
}
