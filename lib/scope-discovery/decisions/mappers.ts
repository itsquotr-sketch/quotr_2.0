import type { DecisionLifecycleSuccess } from "./types";

interface RpcSuccessBody {
  readonly ok?: boolean;
  readonly decision_id?: string;
  readonly work_area_id?: string | null;
  readonly decision_type?: "ACCEPT" | "REJECT" | "MODIFY";
  readonly suggestion_id?: string;
  readonly project_id?: string;
  readonly idempotent_reuse?: boolean;
}

export function mapRpcSuccess(data: unknown): DecisionLifecycleSuccess | null {
  if (!data || typeof data !== "object") return null;
  const body = data as RpcSuccessBody;
  if (
    body.ok !== true ||
    typeof body.decision_id !== "string" ||
    typeof body.suggestion_id !== "string" ||
    typeof body.project_id !== "string" ||
    (body.decision_type !== "ACCEPT" &&
      body.decision_type !== "REJECT" &&
      body.decision_type !== "MODIFY")
  ) {
    return null;
  }
  return {
    ok: true,
    decisionId: body.decision_id,
    workAreaId: body.work_area_id ?? null,
    decisionType: body.decision_type,
    suggestionId: body.suggestion_id,
    projectId: body.project_id,
    idempotentReuse: body.idempotent_reuse === true,
  };
}
