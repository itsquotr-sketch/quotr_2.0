import type { ProjectDetailsInput } from "@/lib/projects/schema";
import type { BusinessStatus } from "@/lib/projects/status";

export type { ProjectListFilter } from "@/lib/projects/status";

export type ProjectPriority = "low" | "normal" | "high" | "urgent";

export type Project = {
  id: string;
  title: string;
  brief_text: string | null;
  client_name: string | null;
  site_address: string | null;
  priority: ProjectPriority;
  due_date: string | null;
  notes: string | null;
  stage: string;
  quality_level: string;
  status: string;
  business_status: BusinessStatus;
  status_updated_at: string | null;
  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  duplicated_from_project_id: string | null;
};

export type ProjectListItem = Project & {
  has_estimate: boolean;
  estimate_is_stale: boolean;
};

export type CreateProjectInput = ProjectDetailsInput;

export type UpdateProjectInput = ProjectDetailsInput;

export type ProjectActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export type DashboardPipelineSummary = {
  activeCount: number;
  estimateReadyCount: number;
  quotesSentCount: number;
  wonCount: number;
  lostCount: number;
};

export type UpdateProjectBusinessStatusInput = {
  projectId: string;
  businessStatus: BusinessStatus;
  lostReason?: string;
};
