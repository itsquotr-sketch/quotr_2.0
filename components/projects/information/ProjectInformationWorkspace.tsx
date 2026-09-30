import type { ReactNode } from "react";
import Link from "next/link";
import { CapturedDetails } from "@/components/projects/information/CapturedDetails";
import { ProjectDocumentsSection } from "@/components/projects/information/ProjectDocumentsSection";
import { PROJECT_DOCUMENT_OWNERSHIP } from "@/components/projects/information/project-documents";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import type {
  ProjectInformationField,
  ProjectInformationModel,
} from "@/lib/projects/project-information";
import type { ProjectDocumentCentreModel } from "@/lib/projects/document-model";

type ProjectInformationWorkspaceProps = {
  model: ProjectInformationModel;
  projectId: string;
  documents: ProjectDocumentCentreModel;
};

export function ProjectInformationWorkspace({
  model,
  projectId,
  documents,
}: ProjectInformationWorkspaceProps) {
  return (
    <div
      className="min-w-0 overflow-x-hidden"
      data-project-information="true"
      data-project-documents-owner={PROJECT_DOCUMENT_OWNERSHIP}
    >
      <h2 className="text-lg font-semibold leading-6" data-project-information-title>
        Project information
      </h2>
      <div className="mt-4 grid gap-3" data-project-information-cards>
        <InfoCard title="Overview">
          <FieldList fields={model.overview} columns="three" />
        </InfoCard>
        <InfoCard title="Job and site">
          {model.job.length > 0 ? (
            <FieldList fields={model.job} />
          ) : (
            <p className="text-sm leading-5 text-foreground/75">No job brief or site notes stored yet.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <RecordLink href={model.estimateHref} dataAttribute="edit-job">
              {ASSISTANT_ACTION_LABELS.editJobDetails}
            </RecordLink>
            <RecordLink href={model.estimateHref} dataAttribute="review-work-areas">
              Review Work Area details
            </RecordLink>
          </div>
        </InfoCard>
        <InfoCard title="Captured details and Work Areas">
          <CapturedDetails summary={model.capturedSummary} groups={model.capturedGroups} />
        </InfoCard>
        <section className={informationCardClass} id="project-documents" data-project-documents-section="true" data-project-information-card>
          <h3 className={informationTitleClass}>Documents and images</h3>
          <div className="mt-3">
            <ProjectDocumentsSection projectId={projectId} centre={documents} />
          </div>
        </section>
      </div>
    </div>
  );
}

const informationCardClass = "min-w-0 rounded-xl border border-border bg-card px-4 py-3";
const informationTitleClass = "text-base font-semibold leading-snug";

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={informationCardClass} data-project-information-card>
      <h3 className={informationTitleClass}>{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FieldList({
  fields,
  columns = "two",
}: {
  fields: readonly ProjectInformationField[];
  columns?: "two" | "three";
}) {
  return (
    <dl className={columns === "three" ? "grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-2 lg:grid-cols-2"}>
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="text-xs leading-4 text-foreground/70">{field.label}</dt>
          <dd className="mt-0.5 break-words text-sm leading-5 [overflow-wrap:anywhere]">{field.value}</dd>
        </div>
      ))}
    </dl>
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
      className="inline-flex min-h-11 w-auto items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
    >
      {children}
    </Link>
  );
}
