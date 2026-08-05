/**
 * Targeted revalidation helper for scope discovery mutations.
 */

import { revalidatePath } from "next/cache";

export function revalidateScopeDiscoveryPaths(projectId: string): void {
  revalidatePath(`/app/projects/${projectId}`);
}
