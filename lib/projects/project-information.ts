/**
 * Read-only Project Information record.
 * Copies stored project, captured, and estimate-state fields.
 * Does not calculate costs or load documents.
 */

import type { AssistantState } from "@/lib/assistant/types";
import { formatDueDate, formatProjectDate, priorityLabel } from "@/lib/projects/format";
import { getBusinessStatusDefinition } from "@/lib/projects/status";
import type { Project, ProjectPriority } from "@/lib/projects/types";

export type ProjectInformationField = {
  label: string;
  value: string;
};

export type ProjectInformationWorkArea = {
  name: string;
  status: string;
  completeness: string;
};

export type ProjectInformationCaptured = {
  workArea: string;
  label: string;
  value: string;
};

export type ProjectInformationEstimateState = "none" | "current" | "stale";

export type ProjectInformationModel = {
  overview: readonly ProjectInformationField[];
  job: readonly ProjectInformationField[];
  captured: readonly ProjectInformationCaptured[];
  conditions: readonly ProjectInformationField[];
  workAreas: readonly ProjectInformationWorkArea[];
  estimateState: ProjectInformationEstimateState;
  estimateLabel: string;
  /** Unknown on this page. Counting it would run the Estimate commercial composer. */
  pricingRequiredCount: null;
  estimateHref: string;
};

export type ProjectInformationInput = {
  project: {
    title: string;
    business_status: string;
    priority: ProjectPriority;
    client_name: string | null;
    client_email: string | null;
    site_address: string | null;
    brief_text: string | null;
    notes: string | null;
    due_date: string | null;
    created_at: string;
  };
  workAreas: readonly {
    name: string;
    status: "suggested" | "confirmed" | "excluded";
    missingCount: number;
  }[];
  captured: readonly ProjectInformationCaptured[];
  conditions: readonly ProjectInformationField[];
  hasEstimate: boolean;
  estimateIsStale: boolean;
  estimateHref: string;
};

const ESTIMATE_LABEL: Record<ProjectInformationEstimateState, string> = {
  none: "No estimate",
  current: "Current estimate",
  stale: "Stale estimate",
};

export function projectInformationModel(
  input: ProjectInformationInput
): ProjectInformationModel {
  const estimateState: ProjectInformationEstimateState = !input.hasEstimate
    ? "none"
    : input.estimateIsStale
      ? "stale"
      : "current";

  return {
    overview: overviewFields(input.project),
    job: jobFields(input.project),
    captured: input.captured.filter(
      (item) => item.workArea.trim() && item.label.trim() && item.value.trim()
    ),
    conditions: input.conditions.filter((item) => item.label.trim() && item.value.trim()),
    workAreas: input.workAreas.map((area) => ({
      name: area.name,
      status: workAreaStatusLabel(area.status),
      completeness: workAreaCompleteness(area.status, area.missingCount),
    })),
    estimateState,
    estimateLabel: ESTIMATE_LABEL[estimateState],
    pricingRequiredCount: null,
    estimateHref: input.estimateHref,
  };
}

export function projectInformationFromLoaded(
  project: Project,
  assistant: AssistantState,
  projectId: string
): ProjectInformationModel {
  const missingByArea = new Map(
    assistant.scopeReview.workAreas.map((area) => [area.workAreaId, area.missingItems.length])
  );

  return projectInformationModel({
    project,
    workAreas: assistant.workAreas.map((area) => ({
      name: area.name,
      status: area.status,
      missingCount: missingByArea.get(area.id) ?? area.missingInfo?.length ?? 0,
    })),
    captured: assistant.scopeReview.workAreas.flatMap((area) =>
      area.facts
        .filter((fact) => fact.value.trim().length > 0)
        .map((fact) => ({
          workArea: area.workAreaName,
          label: fact.label,
          value: fact.value.trim(),
        }))
    ),
    conditions: assistant.submittedConstraints.flatMap((row) => {
      const value = formatStoredValue(row.value);
      return value ? [{ label: row.label, value }] : [];
    }),
    hasEstimate: Boolean(assistant.estimate),
    estimateIsStale: Boolean(assistant.estimate?.isStale),
    estimateHref: `/app/projects/${projectId}`,
  });
}

function overviewFields(
  project: ProjectInformationInput["project"]
): ProjectInformationField[] {
  const fields: ProjectInformationField[] = [
    { label: "Project", value: project.title },
    {
      label: "Status",
      value: getBusinessStatusDefinition(project.business_status).label,
    },
    { label: "Priority", value: priorityLabel(project.priority) },
  ];
  pushOptional(fields, "Client", project.client_name);
  pushOptional(fields, "Client email", project.client_email);
  pushOptional(fields, "Site address", project.site_address);
  if (project.due_date) {
    fields.push({ label: "Due", value: formatDueDate(project.due_date) });
  }
  fields.push({ label: "Created", value: formatProjectDate(project.created_at) });
  return fields;
}

function jobFields(project: ProjectInformationInput["project"]): ProjectInformationField[] {
  const fields: ProjectInformationField[] = [];
  pushOptional(fields, "Job brief", project.brief_text);
  pushOptional(fields, "Site notes", project.notes);
  return fields;
}

function pushOptional(
  fields: ProjectInformationField[],
  label: string,
  value: string | null
) {
  const trimmed = value?.trim() ?? "";
  if (trimmed) fields.push({ label, value: trimmed });
}

function workAreaStatusLabel(
  status: ProjectInformationInput["workAreas"][number]["status"]
): string {
  if (status === "confirmed") return "Confirmed";
  if (status === "excluded") return "Excluded";
  return "Detected";
}

function workAreaCompleteness(
  status: ProjectInformationInput["workAreas"][number]["status"],
  missingCount: number
): string {
  if (status === "excluded") return "Excluded";
  if (missingCount > 0) return "Details still needed";
  if (status === "confirmed") return "Details captured";
  return "Not confirmed";
}

function formatStoredValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return value.trim();
}
