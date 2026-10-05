"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { respondToVariationAsClient, type VariationResponseDeliveryState } from "@/lib/variations/response-actions";
import {
  variationAcceptFinalConfirmation,
  variationAttachmentConfirmation,
  variationAuthorityConfirmation,
  variationDeclineExplanation,
  variationDeclineFinalConfirmation,
  variationMasterTermsConfirmation,
  variationScopeConfirmation,
} from "@/lib/variations/response";
import type { VariationDocumentModel } from "@/lib/variations/presentation";

export function VariationClientResponse(props: {
  token: string;
  document: VariationDocumentModel;
  attachmentCount: number;
  onClientEmail?: (state: VariationResponseDeliveryState) => void;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const key = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : "");
  const lock = useRef(false);
  const [mode, setMode] = useState<"accept" | "decline" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [authority, setAuthority] = useState(false);
  const [scope, setScope] = useState(false);
  const [attachments, setAttachments] = useState(false);
  const [terms, setTerms] = useState(false);
  const [finalConfirm, setFinalConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const doc = props.document;
  const attachmentLine = variationAttachmentConfirmation(props.attachmentCount);
  const quote =
    doc.quoteNumber && doc.quoteRevision != null
      ? `Quote ${doc.quoteNumber}, Revision ${doc.quoteRevision}`
      : "the accepted Quote";

  function close(): void {
    if (pending) return;
    setMode(null);
    setError(null);
  }

  async function submit(outcome: "accepted" | "declined"): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    const result = await respondToVariationAsClient({
      token: props.token,
      outcome,
      responderName: name,
      responderEmail: email,
      declineReason: reason,
      confirmAuthority: authority,
      confirmScope: scope,
      confirmAttachments: attachments,
      confirmMasterTerms: terms,
      confirmFinal: finalConfirm,
      idempotencyKey: key.current,
    });
    if (!result.ok) {
      lock.current = false;
      setPending(false);
      setError(result.error ?? "This Variation could not be updated.");
      return;
    }
    props.onClientEmail?.(result.clientEmail ?? "skipped");
    setMode(null);
    router.refresh();
  }

  const summary = (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" data-variation-response-summary="true">
      <p className="font-medium">Variation {doc.variationNumber}, Revision {doc.revisionNumber}</p>
      <p className="text-neutral-600">{quote}</p>
      <p className="mt-1 font-medium tabular-nums">{doc.inclLabel} incl GST</p>
      <p className="tabular-nums text-neutral-700">Proposed revised contract {doc.proposedInclLabel}</p>
      {props.attachmentCount > 0 ? <p className="text-neutral-600">{props.attachmentCount} supporting attachments</p> : null}
    </div>
  );

  const fields = (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (mode) void submit(mode === "accept" ? "accepted" : "declined");
      }}
    >
      {summary}
      <p className="text-sm">Accepting this Variation changes the accepted contract value.</p>
      <div className="space-y-1.5">
        <Label htmlFor="variation-response-name">Full name</Label>
        <Input id="variation-response-name" className="h-11 w-full text-base" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="variation-response-email">Email address</Label>
        <Input id="variation-response-email" type="email" className="h-11 w-full min-w-0 text-base" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </div>
      {mode === "decline" ? (
        <>
          <p className="text-sm">{variationDeclineExplanation()}</p>
          <div className="space-y-1.5">
            <Label htmlFor="variation-response-reason">Reason (optional)</Label>
            <textarea
              id="variation-response-reason"
              className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-base"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={2000}
            />
          </div>
          <CheckLine checked={finalConfirm} onChange={setFinalConfirm} label={variationDeclineFinalConfirmation()} />
        </>
      ) : (
        <>
          <CheckLine checked={authority} onChange={setAuthority} label={variationAuthorityConfirmation()} />
          <CheckLine checked={scope} onChange={setScope} label={variationScopeConfirmation()} />
          {attachmentLine ? <CheckLine checked={attachments} onChange={setAttachments} label={attachmentLine} /> : null}
          <CheckLine checked={terms} onChange={setTerms} label={variationMasterTermsConfirmation()} />
          <CheckLine checked={finalConfirm} onChange={setFinalConfirm} label={variationAcceptFinalConfirmation()} />
        </>
      )}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      <Button type="submit" className="h-11 w-full" disabled={pending} data-variation-response-submit="true">
        {pending ? "Saving…" : mode === "accept" ? "Confirm acceptance" : "Confirm decline"}
      </Button>
    </form>
  );

  const title = mode === "decline" ? "Decline Variation" : "Accept Variation";
  const description = mode === "decline"
    ? "Your response will be recorded. Declining does not change the accepted contract value."
    : "Record your acceptance of this Variation. This changes the accepted contract value.";
  const dialogOpen = mode != null && isDesktop;
  const sheetOpen = mode != null && !isDesktop;

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm shadow-sm" data-variation-client-response="true">
      <h2 className="text-base font-semibold text-neutral-900">Respond to this Variation</h2>
      <p className="mt-1 text-sm text-neutral-600">Review the scope and adjustment, then accept or decline.</p>
      <div className="mt-3">{summary}</div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="h-11 w-full sm:w-auto" onClick={() => { setMode("accept"); setFinalConfirm(false); setError(null); }}>
          Accept Variation
        </Button>
        <Button type="button" variant="ghost" className="h-11 w-full text-muted-foreground sm:w-auto" onClick={() => { setMode("decline"); setFinalConfirm(false); setError(null); }}>
          Decline Variation
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent data-variation-response-mode="dialog" className="max-h-[90vh] overflow-y-auto sm:max-w-[36rem]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {fields}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 w-full" disabled={pending} onClick={close}>Back</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) close(); }}>
        <SheetContent side="bottom" data-variation-response-mode="sheet" className="h-[100dvh] max-h-[100dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-4">{fields}</div>
          <SheetFooter>
            <Button type="button" variant="outline" className="h-11 w-full" disabled={pending} onClick={close}>Back</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CheckLine(props: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-start gap-3 leading-5">
      <span className="inline-flex size-11 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className="size-5 focus-visible:outline-2 focus-visible:outline-offset-2"
          checked={props.checked}
          onChange={(event) => props.onChange(event.target.checked)}
        />
      </span>
      <span className="break-words pt-2.5">{props.label}</span>
    </label>
  );
}
