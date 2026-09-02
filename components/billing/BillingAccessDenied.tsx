import Link from "next/link";
import type { UpgradeTarget } from "@/lib/billing/entitlement-reasons";
import { Button } from "@/components/ui/button";

export type BillingAccessDeniedProps = {
  error: string;
  reasonCode?: string | null;
  upgradeTarget?: UpgradeTarget | null;
  className?: string;
};

function actionsFor(input: BillingAccessDeniedProps): {
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
} {
  if (
    input.upgradeTarget === "builder_or_business" ||
    input.reasonCode === "trial_expired" ||
    input.reasonCode === "subscription_cancelled"
  ) {
    return {
      primary: { href: "/app/settings/billing", label: "Choose Builder" },
      secondary: { href: "/app/settings/billing", label: "Choose Business" },
    };
  }
  if (input.upgradeTarget === "business" || input.reasonCode === "upgrade_required") {
    return {
      primary: { href: "/app/settings/billing", label: "Upgrade to Business" },
    };
  }
  if (
    input.reasonCode === "payment_past_due" ||
    input.reasonCode === "subscription_unpaid" ||
    input.reasonCode === "subscription_paused" ||
    input.reasonCode === "billing_incomplete"
  ) {
    return {
      primary: { href: "/app/settings/billing", label: "Manage billing" },
    };
  }
  return {
    primary: { href: "/app/settings/billing", label: "Billing" },
  };
}

export function BillingAccessDenied({
  error,
  reasonCode,
  upgradeTarget,
  className,
}: BillingAccessDeniedProps) {
  const actions = actionsFor({ error, reasonCode, upgradeTarget });
  return (
    <div
      className={
        className ??
        "space-y-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm"
      }
      role="alert"
    >
      <p className="text-destructive">{error}</p>
      <div className="flex flex-wrap gap-2">
        {actions.primary ? (
          <Button size="sm" render={<Link href={actions.primary.href} />}>
            {actions.primary.label}
          </Button>
        ) : null}
        {actions.secondary ? (
          <Button
            size="sm"
            variant="outline"
            render={<Link href={actions.secondary.href} />}
          >
            {actions.secondary.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
