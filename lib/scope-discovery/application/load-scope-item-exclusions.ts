/**
 * Load excluded scope-item types from discovery decisions for question gating.
 */

import { classifyScopeProposal } from "../classification";
import type { PersistenceAuthContext } from "../persistence/context";
import {
  getLatestTerminalDiscoveryRun,
  listDecisionsForRun,
  listSuggestionDetailsForRun,
} from "../persistence";

export async function loadExcludedScopeItemTypes(
  ctx: PersistenceAuthContext,
  projectId: string
): Promise<ReadonlySet<string>> {
  try {
    const run = await getLatestTerminalDiscoveryRun(ctx, projectId);
    if (!run) return new Set();
    const [suggestions, decisions] = await Promise.all([
      listSuggestionDetailsForRun(ctx, run.id),
      listDecisionsForRun(ctx, run.id),
    ]);
    const latestBySuggestion = new Map<string, string>();
    for (const d of decisions) {
      latestBySuggestion.set(d.suggestion_id, d.decision_type);
    }
    const excluded = new Set<string>();
    for (const s of suggestions) {
      if (latestBySuggestion.get(s.id) !== "REJECT") continue;
      const cls = classifyScopeProposal({
        suggestionKind: s.suggestion_kind,
        proposedWorkAreaType: s.proposed_work_area_type,
        relatedWorkAreaId: s.related_work_area_id,
      });
      if (cls !== "SCOPE_ITEM" && cls !== "EXCLUSION") continue;
      if (s.proposed_work_area_type) excluded.add(s.proposed_work_area_type);
    }
    return excluded;
  } catch {
    return new Set();
  }
}
