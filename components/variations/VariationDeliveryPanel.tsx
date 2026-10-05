"use client";

import {
  mobileActionDockClass,
  mobileActionInnerClass,
  mobileActionSurfaceClass,
  mobileNavBottomClass,
} from "@/components/layout/mobile-nav-metrics";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendVariationToClient } from "@/lib/variations/delivery-actions";
import { formatSignedAdjustment } from "@/lib/variations/presentation";
import type { VariationDeliveryAttempt } from "@/lib/variations/workspace-types";

function when(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" });
}

export function VariationDeliveryPanel(props: {
  projectId: string;
  variationId: string;
  revisionId: string;
  variationNumber: number;
  revisionNumber: number;
  title: string;
  adjustmentInclGst: number | null;
  currency: string;
  recipientName: string;
  recipientEmail: string | null;
  attempts: VariationDeliveryAttempt[];
  blockedMessage?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(props.recipientEmail ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; at: string; path: string | null } | null>(null);
  const idempotencyKey = useRef("");
  const attempts = props.attempts.filter((row) => row.revisionId === props.revisionId);
  const latestSent = [...attempts].reverse().find((row) => row.status === "sent");

  function openDialog(): void {
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    setEmail(props.recipientEmail ?? email);
    setError(null);
    setOpen(true);
  }

  async function submit(): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await sendVariationToClient({
      projectId: props.projectId,
      variationId: props.variationId,
      revisionId: props.revisionId,
      recipientEmail: email,
      recipientName: props.recipientName,
      idempotencyKey: idempotencyKey.current,
    });
    setPending(false);
    if (!result.ok) {
      idempotencyKey.current = crypto.randomUUID();
      setError(result.error);
      return;
    }
    setSent({ email: result.recipientEmail, at: result.sentAt, path: result.clientPath });
    setOpen(false);
    idempotencyKey.current = "";
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-none" data-variation-delivery="true">
      <h2 className="text-base font-semibold">Send to the client</h2>
      {attempts.length === 0 && !sent ? <p className="mt-2 text-sm">Never sent</p> : null}
      <ul className="mt-2 space-y-1 text-sm">
        {attempts.map((row) => (
          <li key={row.id}>
            {row.status === "sent"
              ? `Sent to ${row.recipientEmail}${row.sentAt ? ` at ${when(row.sentAt)}` : ""}`
              : row.status === "failed"
                ? `Delivery failed${row.failedAt ? ` at ${when(row.failedAt)}` : ""}`
                : "Sending…"}
          </li>
        ))}
        {sent ? <li>Sent to {sent.email} at {when(sent.at)}</li> : null}
      </ul>
      {latestSent || sent ? <p className="mt-2 text-sm font-medium">Sent</p> : null}
      {error && !open ? <p role="alert" className="mt-2 text-sm">{error}</p> : null}
      {props.blockedMessage ? <p role="alert" className="mt-3 text-sm">{props.blockedMessage}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" className="hidden xl:inline-flex" size="touch" onClick={openDialog} disabled={pending || Boolean(props.blockedMessage)}>
          {latestSent || sent ? "Resend" : "Send to client"}
        </Button>
        {sent?.path ? (
          <Button type="button" variant="outline" size="touch" render={<a href={sent.path} target="_blank" rel="noreferrer" />}>
            View client link
          </Button>
        ) : null}
      </div>
      <div className={cn(mobileActionSurfaceClass, "px-3 xl:hidden md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]", mobileActionInnerClass, mobileNavBottomClass, mobileActionDockClass)}>
        <Button type="button" size="touch" className="w-full" onClick={openDialog} disabled={pending || Boolean(props.blockedMessage)}>
          {latestSent || sent ? "Resend" : "Send to client"}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
        <DialogContent className="max-h-[min(92vh,720px)] w-[min(calc(100vw-0.75rem),480px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send to client</DialogTitle>
            <DialogDescription>
              Issue already froze this revision. Sending delivers that issued Variation. It does not record acceptance and does not change the accepted contract.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <p>{props.recipientName}</p>
            <div className="grid gap-1">
              <Label htmlFor="variation-recipient-email">Recipient email</Label>
              <Input
                id="variation-recipient-email"
                className="min-h-11"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <p>Variation {props.variationNumber} · Revision {props.revisionNumber}</p>
            <p className="break-words">{props.title}</p>
            <p>
              Adjustment incl GST:{" "}
              {props.adjustmentInclGst == null ? "Pricing required" : formatSignedAdjustment(props.adjustmentInclGst, props.currency)}
            </p>
          </div>
          {error ? <p role="alert" className="text-sm">{error}</p> : null}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="button" size="touch" className="w-full" disabled={pending} onClick={() => void submit()}>
              {pending ? "Sending…" : "Send Variation"}
            </Button>
            <Button type="button" variant="outline" size="touch" className="w-full" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
