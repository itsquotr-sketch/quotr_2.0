/**
 * PERFORMANCE-01B — request-scoped READ reuse of active-project ownership.
 *
 * Cache key is orgId + projectId. The query is the same as
 * assertOrgOwnsActiveProject. Post-write verification must call the
 * uncached function in org-ownership.ts.
 */
import "server-only";

import { cache } from "react";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";

type ActiveProjectOwnershipResult =
  | { error: string }
  | { projectId: string };

function notFound(): ActiveProjectOwnershipResult {
  return { error: "Project not found." };
}

async function resolveActiveProjectOwnershipForRead(
  orgId: string,
  projectId: string
): Promise<ActiveProjectOwnershipResult> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok || auth.orgId !== orgId) {
    return notFound();
  }
  return assertOrgOwnsActiveProject(auth, projectId);
}

const cachedActiveProjectOwnershipForRead = cache(
  resolveActiveProjectOwnershipForRead
);

export async function assertOrgOwnsActiveProjectForRead(
  ctx: { orgId: string },
  projectId: string
): Promise<ActiveProjectOwnershipResult> {
  return cachedActiveProjectOwnershipForRead(ctx.orgId, projectId);
}
