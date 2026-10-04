"use client";

import { QuotrLoader } from "@/components/brand/QuotrLoader";
import { Button } from "@/components/ui/button";

type AuthSubmitButtonProps = {
  pending: boolean;
  idle: string;
  pendingLabel: string;
  variant?: "default" | "outline";
};

export function AuthSubmitButton({
  pending,
  idle,
  pendingLabel,
  variant = "default",
}: AuthSubmitButtonProps) {
  return (
    <Button
      type="submit"
      variant={variant}
      className="h-11 w-full disabled:opacity-100"
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <QuotrLoader variant="compact" status={pendingLabel} />
      ) : (
        idle
      )}
    </Button>
  );
}
