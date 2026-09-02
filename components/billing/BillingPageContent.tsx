"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getBillingPageState,
  startCheckout,
  startCustomerPortal,
  upgradeToBusiness,
} from "@/lib/billing/billing-actions";
import type { BillingPageView } from "@/lib/billing/billing-page-view";
import {
  formatExclusivePlusGst,
  PLAN_DISPLAY_CATALOGUE,
} from "@/lib/billing/display-catalogue";
import type { CheckoutPlanCode } from "@/lib/billing/checkout-plan";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BillingPageContentProps = {
  initialView: BillingPageView;
  checkout: "success" | "cancelled" | null;
  upgrade: "pending" | "payment" | null;
};

function isErrorView(
  value: BillingPageView | { error: string }
): value is { error: string } {
  return "error" in value && !("kind" in value);
}

export function BillingPageContent({
  initialView,
  checkout,
  upgrade,
}: BillingPageContentProps) {
  const [view, setView] = useState(initialView);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCheckout, setConfirmingCheckout] = useState(
    checkout === "success"
  );
  const [confirmingUpgrade, setConfirmingUpgrade] = useState(
    upgrade === "pending"
  );
  const [upgradePaymentNeeded, setUpgradePaymentNeeded] = useState(
    upgrade === "payment"
  );
  const [pendingPlan, setPendingPlan] = useState<CheckoutPlanCode | "portal" | "upgrade" | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (checkout !== "success" && upgrade !== "pending" && upgrade !== "payment") {
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15;

    async function poll() {
      while (!cancelled && attempts < maxAttempts) {
        attempts += 1;
        const next = await getBillingPageState();
        if (cancelled) return;
        if (!isErrorView(next)) {
          setView(next);
          if (checkout === "success" && next.source === "stripe") {
            setConfirmingCheckout(false);
            return;
          }
          if (
            (upgrade === "pending" || upgrade === "payment") &&
            next.planCode === "business"
          ) {
            setConfirmingUpgrade(false);
            setUpgradePaymentNeeded(false);
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelled) {
        setConfirmingCheckout(false);
        setConfirmingUpgrade(false);
        if (upgrade === "pending" || upgrade === "payment") {
          setUpgradePaymentNeeded(true);
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [checkout, upgrade]);

  function runAction(
    key: CheckoutPlanCode | "portal" | "upgrade",
    action: () => Promise<{ error: string } | void>
  ) {
    setError(null);
    setPendingPlan(key);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        setPendingPlan(null);
      }
    });
  }

  const showPlans = view.canCheckout;
  const trialCta =
    view.kind === "trial" && view.trial && (view.trial.daysRemaining ?? 99) <= 3
      ? "Subscribe now"
      : "Choose a plan";

  return (
    <div className="space-y-6">
      {checkout === "cancelled" ? (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Checkout was cancelled. Your trial is unchanged.
        </p>
      ) : null}

      {confirmingCheckout ? (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          Confirming your subscription… This page waits for billing to update.
          You can refresh if this takes a moment.
        </p>
      ) : null}

      {confirmingUpgrade ? (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          Confirming your upgrade… Quotr waits for billing to update before
          switching to Business. You can refresh if this takes a moment.
        </p>
      ) : null}

      {upgradePaymentNeeded && !confirmingUpgrade && view.planCode !== "business" ? (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          Your upgrade has not completed because payment needs attention. You
          remain on Builder until billing confirms Business. Use Manage billing
          to update payment, then refresh.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {view.kind === "trial_expired" ? (
        <Card>
          <CardHeader>
            <CardTitle>Your 14-day trial has ended</CardTitle>
            <CardDescription>
              Choose Quotr Builder or Business to continue creating and sending
              new work. Existing Projects, Estimates, Pricing, and Quotes stay
              available to view.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {view.kind === "trial" && view.trial ? (
        <Card>
          <CardHeader>
            <CardTitle>Quotr Trial</CardTitle>
            <CardDescription>Business features · 1 user</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm">{view.trial.label}</p>
            {view.trialEndsOn ? (
              <p className="text-sm text-muted-foreground">
                Trial ends {view.trialEndsOn}.
              </p>
            ) : null}
          </CardContent>
          {showPlans ? (
            <CardFooter>
              <p className="text-sm text-muted-foreground">{trialCta} below.</p>
            </CardFooter>
          ) : null}
        </Card>
      ) : null}

      {view.source === "stripe" || view.source === "override" ? (
        <Card>
          <CardHeader>
            <CardTitle>{view.planLabel ?? "Current plan"}</CardTitle>
            <CardDescription>{view.statusLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {view.monthlyPriceLabel ? <p>{view.monthlyPriceLabel}</p> : null}
            {view.currentPeriodEnd ? (
              <p className="text-muted-foreground">
                Current period ends {view.currentPeriodEnd}.
              </p>
            ) : null}
            {view.planCode === "business" ? (
              <p className="text-muted-foreground">Current users: 1</p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            {view.canManagePortal ? (
              <Button
                type="button"
                disabled={isPending}
                onClick={() => runAction("portal", () => startCustomerPortal())}
              >
                {pendingPlan === "portal" ? "Opening…" : "Manage billing"}
              </Button>
            ) : null}
            {view.canUpgradeToBusiness ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending || confirmingUpgrade}
                onClick={() => runAction("upgrade", () => upgradeToBusiness())}
              >
                {pendingPlan === "upgrade" || confirmingUpgrade
                  ? "Updating…"
                  : "Upgrade to Business"}
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      ) : null}

      {showPlans ? (
        <div className="grid gap-4 md:grid-cols-2">
          <PlanSelectCard
            plan="builder"
            pending={pendingPlan === "builder"}
            disabled={isPending}
            onSelect={() => runAction("builder", () => startCheckout("builder"))}
          />
          <PlanSelectCard
            plan="business"
            pending={pendingPlan === "business"}
            disabled={isPending}
            onSelect={() => runAction("business", () => startCheckout("business"))}
          />
        </div>
      ) : view.checkoutBlockedReason && view.kind !== "trial" ? (
        <p className="text-sm text-muted-foreground">{view.checkoutBlockedReason}</p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Additional Business users are $35 + GST per user/month. Team management
        arrives later.
      </p>
    </div>
  );
}

function PlanSelectCard({
  plan,
  pending,
  disabled,
  onSelect,
}: {
  plan: CheckoutPlanCode;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const catalogue = PLAN_DISPLAY_CATALOGUE[plan];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{catalogue.label}</CardTitle>
        <CardDescription>
          {formatExclusivePlusGst(catalogue.exclusiveMonthlyNzd)}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {plan === "builder"
          ? "1 user. Core estimating accuracy, Pricing, Quotes, sending and acceptance."
          : "First user included. Core estimating accuracy, Pricing, Quotes, sending and acceptance."}
      </CardContent>
      <CardFooter>
        <Button type="button" disabled={disabled} onClick={onSelect}>
          {pending
            ? "Continuing…"
            : plan === "builder"
              ? "Choose Builder"
              : "Choose Business"}
        </Button>
      </CardFooter>
    </Card>
  );
}
