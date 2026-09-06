"use server";

import {
  deriveRecentActivity,
  type RecentActivityItem,
} from "@/lib/dashboard/derive-recent-activity";
import { hasLifecycleColumns } from "@/lib/projects/query-utils";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";

const FEED_LIMIT = 8;
const SOURCE_LIMIT = 40;

export async function listRecentActivity(): Promise<RecentActivityItem[]> {
  const context = await getAuthOrgContext();
  if (!context) return [];

  const lifecycleAvailable = await hasLifecycleColumns(context.supabase);

  let projectQuery = context.supabase
    .from("projects")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(SOURCE_LIMIT);
  if (lifecycleAvailable) {
    projectQuery = projectQuery.is("deleted_at", null);
  }

  const [projectsResult, estimatesResult, quotesResult] = await Promise.all([
    projectQuery,
    context.supabase
      .from("estimates")
      .select("id, project_id, created_at, updated_at, generated_at")
      .order("updated_at", { ascending: false })
      .limit(SOURCE_LIMIT),
    context.supabase
      .from("quotes")
      .select(
        "id, project_id, quote_number, created_at, sent_at, viewed_at, accepted_at, declined_at, superseded_by_quote_id"
      )
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(SOURCE_LIMIT),
  ]);

  if (projectsResult.error) {
    console.error("[listRecentActivity] projects", projectsResult.error.message);
  }
  if (estimatesResult.error) {
    console.error("[listRecentActivity] estimates", estimatesResult.error.message);
  }
  if (quotesResult.error) {
    console.error("[listRecentActivity] quotes", quotesResult.error.message);
  }

  return deriveRecentActivity({
    projects: (projectsResult.data ?? []).map((row) => ({
      id: String(row.id),
      title: row.title != null ? String(row.title) : null,
      created_at: String(row.created_at),
    })),
    estimates: (estimatesResult.data ?? []).map((row) => ({
      id: String(row.id),
      project_id: String(row.project_id),
      created_at: String(row.created_at),
      updated_at: row.updated_at != null ? String(row.updated_at) : null,
      generated_at: row.generated_at != null ? String(row.generated_at) : null,
    })),
    quotes: (quotesResult.data ?? []).map((row) => ({
      id: String(row.id),
      project_id: String(row.project_id),
      quote_number:
        row.quote_number != null ? String(row.quote_number) : null,
      created_at: String(row.created_at),
      sent_at: row.sent_at != null ? String(row.sent_at) : null,
      viewed_at: row.viewed_at != null ? String(row.viewed_at) : null,
      accepted_at: row.accepted_at != null ? String(row.accepted_at) : null,
      declined_at: row.declined_at != null ? String(row.declined_at) : null,
      superseded_by_quote_id:
        row.superseded_by_quote_id != null
          ? String(row.superseded_by_quote_id)
          : null,
    })),
    limit: FEED_LIMIT,
  });
}
