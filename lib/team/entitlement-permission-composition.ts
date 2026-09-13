/**
 * PERFORMANCE-01C-3 — compose organisation entitlement and member permission.
 *
 * The two checks are independent: they read already-resolved org/user
 * context, do not mutate, and fail closed on their own. Entitlement denial
 * still takes precedence when both fail, matching the previous sequential
 * short-circuit message.
 */

export type EntitlementCheckResult = {
  ok: boolean;
  message?: string | null;
  reasonCode?: string | null;
};

export async function runIndependentEntitlementAndPermissionChecks<
  TEntitled,
  TPermitted,
>(input: {
  entitlement?: string | null;
  checkEntitlement: () => Promise<TEntitled>;
  checkPermission: () => Promise<TPermitted>;
}): Promise<{ entitled: TEntitled | null; permitted: TPermitted }> {
  if (!input.entitlement) {
    return {
      entitled: null,
      permitted: await input.checkPermission(),
    };
  }

  const [entitled, permitted] = await Promise.all([
    input.checkEntitlement(),
    input.checkPermission(),
  ]);
  return { entitled, permitted };
}

export function composeEntitlementAndPermissionDecision<
  TPermitted extends
    | { ok: true }
    | { ok: false; error: string; reasonCode: string },
>(input: {
  entitled: EntitlementCheckResult | null;
  permitted: TPermitted;
}):
  | TPermitted
  | {
      ok: false;
      error: string;
      reasonCode: string;
      entitlementDenied: true;
    } {
  if (input.entitled && !input.entitled.ok) {
    return {
      ok: false,
      error: input.entitled.message ?? "This action is not available.",
      reasonCode: input.entitled.reasonCode ?? "upgrade_required",
      entitlementDenied: true,
    };
  }
  return input.permitted;
}
