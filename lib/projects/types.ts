import type { ProjectDetailsInput } from "@/lib/projects/schema";

export type ProjectPriority = "low" | "normal" | "high" | "urgent";

export type ProjectListFilter = "active" | "archived" | "all";

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
