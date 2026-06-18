import type { ProjectDetailsInput } from "@/lib/projects/schema";

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
  created_at: string;
};

export type CreateProjectInput = ProjectDetailsInput;

export type UpdateProjectInput = ProjectDetailsInput;

export type ProjectActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};
