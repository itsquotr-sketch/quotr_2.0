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
  unit?: string | null;
  category?: string | null;
};

export type CapturedDetailFact = {
  label: string;
  value: string;
  unit: string | null;
};

export type CapturedDetailCategory = {
  name: string;
  facts: readonly CapturedDetailFact[];
};

export type CapturedDetailGroup = {
  id: string;
  name: string;
  status: string | null;
  completeness: string | null;
  factCount: number;
  conditionCount: number;
  needingDetails: boolean;
  categories: readonly CapturedDetailCategory[];
  conditions: readonly ProjectInformationField[];
};

export type CapturedDetailSummary = {
  workAreaCount: number;
  factCount: number;
  conditionCount: number;
  needingDetailsCount: number;
};

export type ProjectInformationEstimateState = "none" | "current" | "stale";

export type ProjectInformationModel = {
  overview: readonly ProjectInformationField[];
  job: readonly ProjectInformationField[];
  captured: readonly ProjectInformationCaptured[];
  conditions: readonly ProjectInformationField[];
  workAreas: readonly ProjectInformationWorkArea[];
  capturedSummary: CapturedDetailSummary;
  capturedGroups: readonly CapturedDetailGroup[];
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
  const captured = input.captured.filter(
    (item) => item.label.trim() && item.value.trim()
  );
  const conditions = input.conditions.filter((item) => item.label.trim() && item.value.trim());
  const workAreas = input.workAreas.map((area) => ({
    name: area.name,
    status: workAreaStatusLabel(area.status),
    completeness: workAreaCompleteness(area.status, area.missingCount),
  }));
  const details = buildCapturedDetailGroups({ workAreas, captured, conditions });

  return {
    overview: overviewFields(input.project),
    job: jobFields(input.project),
    captured,
    conditions,
    workAreas,
    capturedSummary: details.summary,
    capturedGroups: details.groups,
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
          unit: fact.unit?.trim() || null,
          category: null,
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

export function projectSectionContext(project: {
  client_name: string | null;
  site_address: string | null;
}): string {
  const client = Boolean(project.client_name?.trim());
  const site = Boolean(project.site_address?.trim());
  if (client && site) return "Client and site on file";
  if (client) return "Site details missing";
  if (site) return "Client details missing";
  return "Client and site details missing";
}

export function filterCapturedDetailGroups(
  groups: readonly CapturedDetailGroup[],
  query: string
): CapturedDetailGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...groups];
  return groups.flatMap((group) => {
    if (group.name.toLowerCase().includes(needle)) return [group];
    const categories = group.categories
      .map((category) => ({
        ...category,
        facts: category.facts.filter((fact) =>
          `${fact.label} ${fact.value}`.toLowerCase().includes(needle)
        ),
      }))
      .filter((category) => category.facts.length > 0);
    const conditions = group.conditions.filter((item) =>
      `${item.label} ${item.value}`.toLowerCase().includes(needle)
    );
    if (categories.length === 0 && conditions.length === 0) return [];
    return [
      {
        ...group,
        categories,
        conditions,
        factCount: categories.reduce((count, category) => count + category.facts.length, 0),
        conditionCount: conditions.length,
      },
    ];
  });
}

function buildCapturedDetailGroups(input: {
  workAreas: readonly ProjectInformationWorkArea[];
  captured: readonly ProjectInformationCaptured[];
  conditions: readonly ProjectInformationField[];
}): { summary: CapturedDetailSummary; groups: CapturedDetailGroup[] } {
  const named = new Set(input.workAreas.map((area) => area.name));
  const groups = input.workAreas.map((area, index) =>
    toGroup({
      id: `work-area-${index}`,
      name: area.name,
      status: area.status,
      completeness: area.completeness,
      facts: input.captured.filter((fact) => fact.workArea === area.name),
      conditions: [],
    })
  );
  const generalFacts = input.captured.filter((fact) => !named.has(fact.workArea));
  if (generalFacts.length > 0 || input.conditions.length > 0) {
    groups.push(
      toGroup({
        id: "general",
        name: "General project details",
        status: null,
        completeness: null,
        facts: generalFacts,
        conditions: input.conditions,
      })
    );
  }
  return {
    summary: {
      workAreaCount: input.workAreas.length,
      factCount: input.captured.length,
      conditionCount: input.conditions.length,
      needingDetailsCount: input.workAreas.filter(
        (area) => area.completeness === "Details still needed"
      ).length,
    },
    groups,
  };
}

function toGroup(input: {
  id: string;
  name: string;
  status: string | null;
  completeness: string | null;
  facts: readonly ProjectInformationCaptured[];
  conditions: readonly ProjectInformationField[];
}): CapturedDetailGroup {
  const categories = new Map<string, CapturedDetailFact[]>();
  for (const fact of input.facts) {
    const name = fact.category?.trim() || "Facts";
    const current = categories.get(name) ?? [];
    current.push({
      label: fact.label,
      value: fact.value,
      unit: fact.unit?.trim() || null,
    });
    categories.set(name, current);
  }
  return {
    id: input.id,
    name: input.name,
    status: input.status,
    completeness: input.completeness,
    factCount: input.facts.length,
    conditionCount: input.conditions.length,
    needingDetails: input.completeness === "Details still needed",
    categories: [...categories.entries()].map(([name, facts]) => ({ name, facts })),
    conditions: input.conditions,
  };
}

function formatStoredValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return value.trim();
}
