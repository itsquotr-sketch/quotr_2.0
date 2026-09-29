"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { dismissOptionalPersonalisation } from "@/lib/setup/actions";

type OptionalPersonalisationPromptProps = {
  href: string;
  title: string;
  reason: string;
};

export function OptionalPersonalisationPrompt({
  href,
  title,
  reason,
}: OptionalPersonalisationPromptProps) {
  const [hidden, setHidden] = useState(false);
  const [pending, setPending] = useState(false);

  if (hidden) return null;

  async function dismiss() {
    setPending(true);
    const result = await dismissOptionalPersonalisation();
    setPending(false);
    if (!result.error) setHidden(true);
  }

  return (
    <div
      data-optional-personalisation
      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{reason}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button render={<Link href={href} />} className="h-9 w-full sm:w-auto">
          Continue
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 w-full sm:w-auto"
          disabled={pending}
          onClick={() => void dismiss()}
        >
          {pending ? "Saving…" : "Not now"}
        </Button>
      </div>
    </div>
  );
}
