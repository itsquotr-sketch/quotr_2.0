import { normalizeDeletionEmail } from "@/lib/account-deletion/request";

/** The first person allowed to fulfil a verified request. */
export const INITIAL_DELETION_OPERATOR = {
  name: "Jean-Luc Ellis",
  email: "jeanluc@erccontracting.co.nz",
} as const;

export const DELETE_PERSONAL_ACCOUNT_CONFIRMATION = "delete-personal-account";

export const PRODUCTION_SUPABASE_PROJECT_REF = "lxvnylhsbvudzzupxeqr";
export const PREVIEW_SUPABASE_PROJECT_REF = "shhpjsoldmqtkdbgrbtm";

export function isDeletionOperator(email: string): boolean {
  return normalizeDeletionEmail(email) === INITIAL_DELETION_OPERATOR.email;
}

export function deletionProjectAllowed(projectRef: string): boolean {
  return projectRef === PREVIEW_SUPABASE_PROJECT_REF;
}
