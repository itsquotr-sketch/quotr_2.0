import { createHash } from "node:crypto";
import { normalizeDeletionEmail } from "@/lib/account-deletion/request";

/** The first person allowed to fulfil a verified request. */
export const INITIAL_DELETION_OPERATOR = {
  name: "Jean-Luc Ellis",
  email: "jeanluc@erccontracting.co.nz",
} as const;

export const DELETE_PERSONAL_ACCOUNT_CONFIRMATION = "delete-personal-account";
export const RETAIN_SUBSCRIPTION_CONFIRMATION = "retain-subscription";
export const RETAIN_ISSUED_DOCUMENTS_CONFIRMATION = "retain-issued-documents";

export const PRODUCTION_SUPABASE_PROJECT_REF = "lxvnylhsbvudzzupxeqr";
export const PREVIEW_SUPABASE_PROJECT_REF = "shhpjsoldmqtkdbgrbtm";

export function isDeletionOperator(email: string): boolean {
  return normalizeDeletionEmail(email) === INITIAL_DELETION_OPERATOR.email;
}

const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProductionExecutionProof = {
  confirmedProjectRef: string;
  requestId: string;
  operatorEmail: string;
  confirmation: string;
  dryRunReview: string;
};

/** Production execution is implemented. It has not been used on a real account. */
export const PRODUCTION_EXECUTION_RECORD =
  "Production execution is enabled and has not been exercised against a real account.";

export function deletionDryRunReview(
  requestId: string,
  plan: {
    lifecycle: string;
    executable: boolean;
    blockers: string[];
    effects: Array<{ action: string; target: string; detail: string }>;
    outcome: string;
  }
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        requestId,
        lifecycle: plan.lifecycle,
        executable: plan.executable,
        blockers: [...plan.blockers].sort(),
        effects: plan.effects.map((effect) => ({
          action: effect.action,
          target: effect.target,
          detail: effect.detail,
        })),
        outcome: plan.outcome,
      })
    )
    .digest("hex");
}

export function productionExecutionRequested(input: {
  projectRef: string;
  requestId: string;
  operatorEmail: string;
  proof: ProductionExecutionProof | undefined;
}): boolean {
  const proof = input.proof;
  if (!proof) return false;
  if (input.projectRef !== PRODUCTION_SUPABASE_PROJECT_REF) return false;
  if (proof.confirmedProjectRef !== PRODUCTION_SUPABASE_PROJECT_REF) return false;
  if (!REQUEST_ID.test(input.requestId) || proof.requestId !== input.requestId) return false;
  if (!isDeletionOperator(input.operatorEmail) || !isDeletionOperator(proof.operatorEmail)) {
    return false;
  }
  if (normalizeDeletionEmail(proof.operatorEmail) !== normalizeDeletionEmail(input.operatorEmail)) {
    return false;
  }
  if (proof.confirmation !== DELETE_PERSONAL_ACCOUNT_CONFIRMATION) return false;
  return /^[0-9a-f]{64}$/.test(proof.dryRunReview);
}

export function deletionProjectAllowed(
  projectRef: string,
  mode: "dry-run" | "execute" = "execute",
  proof?: ProductionExecutionProof
): boolean {
  if (projectRef === PREVIEW_SUPABASE_PROJECT_REF) return true;
  if (projectRef !== PRODUCTION_SUPABASE_PROJECT_REF) return false;
  if (mode === "dry-run") return true;
  return productionExecutionRequested({
    projectRef,
    requestId: proof?.requestId ?? "",
    operatorEmail: proof?.operatorEmail ?? "",
    proof,
  });
}
