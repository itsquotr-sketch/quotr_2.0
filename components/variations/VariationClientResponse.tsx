"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const key = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : "");
  const lock = useRef(false);
  const [mode, setMode] = useState<"choose" | "accept" | "decline">("choose");
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
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-2xl border bg-white p-4 text-sm sm:p-5" data-variation-client-response="true">
      <h2 className="text-base font-semibold">Respond to this Variation</h2>
      <dl className="mt-3 space-y-1">
        <div className="flex flex-wrap justify-between gap-2">
          <dt>Variation</dt>
          <dd className="min-w-0 break-words">Variation {doc.variationNumber}, Revision {doc.revisionNumber}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt>Master Quote</dt>
          <dd className="min-w-0 break-words">{quote}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt>Adjustment incl GST</dt>
          <dd className="tabular-nums">{doc.inclLabel}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt>Proposed revised contract</dt>
          <dd className="tabular-nums">{doc.proposedInclLabel}</dd>
        </div>
        {props.attachmentCount > 0 ? (
          <div className="flex flex-wrap justify-between gap-2">
            <dt>Supporting attachments</dt>
            <dd>{props.attachmentCount}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-3">Accepting this Variation changes the accepted contract value.</p>

      {mode === "choose" ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" size="touch" className="w-full sm:w-auto" onClick={() => { setMode("accept"); setFinalConfirm(false); setError(null); }}>
            Accept Variation
          </Button>
          <Button type="button" size="touch" variant="outline" className="w-full sm:w-auto" onClick={() => { setMode("decline"); setFinalConfirm(false); setError(null); }}>
            Decline Variation
          </Button>
        </div>
      ) : null}

      {mode !== "choose" ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(mode === "accept" ? "accepted" : "declined");
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="variation-response-name">Full name</Label>
            <Input id="variation-response-name" className="h-11 w-full text-base" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="variation-response-email">Email address</Label>
            <Input id="variation-response-email" type="email" className="h-11 w-full min-w-0 break-all text-base" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </div>
          {mode === "decline" ? (
            <>
              <p>{variationDeclineExplanation()}</p>
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
          {error ? <p role="alert">{error}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" size="touch" className="w-full sm:w-auto" disabled={pending}>
              {pending ? "Saving…" : mode === "accept" ? "Confirm acceptance" : "Confirm decline"}
            </Button>
            <Button type="button" size="touch" variant="outline" className="w-full sm:w-auto" disabled={pending} onClick={() => setMode("choose")}>
              Back
            </Button>
          </div>
        </form>
      ) : null}
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
