/**
 * Stage 3.1B.7D — Save status presentation helpers (no persistence changes).
 */

import { ASSISTANT_ACTION_LABELS } from "./action-labels";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function saveStatusLabel(status: SaveStatus): string | null {
  if (status === "saving") return ASSISTANT_ACTION_LABELS.saving;
  if (status === "saved") return ASSISTANT_ACTION_LABELS.saved;
  if (status === "error") return ASSISTANT_ACTION_LABELS.couldNotSave;
  return null;
}

/**
 * Failed saves must never present as Saved.
 * Latest-write / race semantics remain in answer-persistence helpers.
 */
export function resolveDisplayedSaveStatus(params: {
  readonly status: SaveStatus;
  readonly isSaving?: boolean;
  readonly hasError?: boolean;
}): SaveStatus {
  if (params.hasError || params.status === "error") return "error";
  if (params.isSaving || params.status === "saving") return "saving";
  if (params.status === "saved") return "saved";
  return "idle";
}
