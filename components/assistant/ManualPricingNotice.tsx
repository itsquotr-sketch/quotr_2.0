"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MANUAL_PRICING_NOTICE_BODY,
  MANUAL_PRICING_NOTICE_TITLE,
} from "@/lib/work-areas/manual-pricing-route";

export function ManualPricingNotice() {
  return (
    <div className="space-y-1" data-manual-pricing-notice="true">
      <p className="text-sm font-medium text-foreground">
        {MANUAL_PRICING_NOTICE_TITLE}
      </p>
      <p className="text-sm leading-5 text-muted-foreground">
        {MANUAL_PRICING_NOTICE_BODY}
      </p>
    </div>
  );
}

type ManualPricingScopeFormProps = {
  initialName?: string;
  initialScope?: string;
  disabled?: boolean;
  isSaving?: boolean;
  error?: string | null;
  onContinue: (input: {
    name: string;
    scopeDescription: string;
  }) => Promise<{ success: boolean; error?: string }>;
};

export function ManualPricingScopeForm({
  initialName = "",
  initialScope = "",
  disabled = false,
  isSaving = false,
  error = null,
  onContinue,
}: ManualPricingScopeFormProps) {
  const [name, setName] = useState(initialName);
  const [scope, setScope] = useState(initialScope);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleContinue = async () => {
    const trimmedName = name.trim();
    const trimmedScope = scope.trim();
    if (!trimmedName) {
      setLocalError("Enter a name for this work.");
      return;
    }
    if (!trimmedScope) {
      setLocalError("Describe the scope before pricing this work.");
      return;
    }
    setLocalError(null);
    await onContinue({ name: trimmedName, scopeDescription: trimmedScope });
  };

  const shownError = localError ?? error;

  return (
    <div className="space-y-3" data-manual-pricing-form="true">
      <ManualPricingNotice />
      <div className="space-y-1.5">
        <Label htmlFor="manual-work-name">Work name</Label>
        <Input
          id="manual-work-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Concreting"
          disabled={disabled || isSaving}
          className="h-11 min-h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manual-work-scope">Scope</Label>
        <Textarea
          id="manual-work-scope"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          placeholder="Describe what is included, and the quantity if you know it."
          rows={3}
          disabled={disabled || isSaving}
          className="min-h-24 bg-background text-base md:text-sm"
        />
      </div>
      {shownError ? (
        <p className="text-sm text-destructive" role="alert">
          {shownError}
        </p>
      ) : null}
      <Button
        type="button"
        className="h-11 min-h-11 w-full sm:w-auto"
        data-manual-pricing-continue="true"
        disabled={disabled || isSaving}
        onClick={() => void handleContinue()}
      >
        {isSaving ? "Saving…" : "Continue with manual pricing"}
      </Button>
    </div>
  );
}
