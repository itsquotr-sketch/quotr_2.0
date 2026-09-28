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
import { recordVariationResponse } from "@/lib/variations/response-actions";
import {
  VARIATION_MANUAL_EVIDENCE_TYPES,
  variationEvidenceTypeLabel,
  type VariationManualEvidenceType,
} from "@/lib/variations/response";

export function VariationManualResponse(props: {
  projectId: string;
  variationId: string;
  revisionId: string;
  adjustmentInclLabel: string;
  revisedContractInclLabel: string;
}) {
  const router = useRouter();
  const key = useRef("");
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<"accepted" | "declined" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [evidenceType, setEvidenceType] = useState<VariationManualEvidenceType>("email_confirmation");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close(): void {
    if (pending) return;
    setOpen(false);
    setOutcome(null);
    setName("");
    setEmail("");
    setEvidenceType("email_confirmation");
    setNote("");
    setReason("");
    setConfirmed(false);
    setError(null);
    key.current = "";
    lock.current = false;
  }

  function openDialog(): void {
    key.current = typeof crypto !== "undefined" ? crypto.randomUUID() : "";
    setOpen(true);
  }

  async function submit(): Promise<void> {
    if (!outcome || lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    const result = await recordVariationResponse({
      projectId: props.projectId,
      variationId: props.variationId,
      revisionId: props.revisionId,
      outcome,
      responderName: name,
      responderEmail: email,
      evidenceType,
      evidenceNote: note,
      declineReason: outcome === "declined" ? reason : undefined,
      confirmReceived: confirmed,
      idempotencyKey: key.current,
    });
    if (!result.ok) {
      lock.current = false;
      setPending(false);
      setError(result.error ?? "The response could not be recorded.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <section data-variation-manual-response="true">
      <Button type="button" size="touch" onClick={openDialog}>Record client response</Button>
      <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
        <DialogContent data-variation-manual-dialog="true" className="max-h-[90vh] overflow-y-auto sm:max-w-[36rem]">
          <DialogHeader>
            <DialogTitle>How did the client respond?</DialogTitle>
            <DialogDescription>Record an outcome already received from the client. Cancel leaves this Variation unchanged.</DialogDescription>
          </DialogHeader>
          {outcome == null ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="h-11 w-full" onClick={() => { setOutcome("accepted"); setConfirmed(false); setError(null); }}>Accepted</Button>
              <Button type="button" variant="outline" className="h-11 w-full" onClick={() => { setOutcome("declined"); setConfirmed(false); setError(null); }}>Declined</Button>
            </div>
          ) : (
            <form
              className="space-y-4 text-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="manual-responder-name">Responder name</Label>
                <Input id="manual-responder-name" className="h-11 w-full text-base" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-responder-email">Responder email where known</Label>
                <Input id="manual-responder-email" type="email" className="h-11 w-full text-base" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-evidence-type">Evidence type</Label>
                <select
                  id="manual-evidence-type"
                  className="h-11 w-full rounded-md border bg-transparent px-3 text-base"
                  value={evidenceType}
                  onChange={(event) => setEvidenceType(event.target.value as VariationManualEvidenceType)}
                >
                  {VARIATION_MANUAL_EVIDENCE_TYPES.map((type) => (
                    <option key={type} value={type}>{variationEvidenceTypeLabel(type)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-evidence-note">Evidence note</Label>
                <textarea
                  id="manual-evidence-note"
                  className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-base"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  required
                />
              </div>
              {outcome === "declined" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="manual-decline-reason">Decline reason (optional)</Label>
                  <textarea
                    id="manual-decline-reason"
                    className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-base"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={2000}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <p>Adjustment {props.adjustmentInclLabel}</p>
                  <p className="mt-1">Revised accepted contract {props.revisedContractInclLabel}</p>
                </div>
              )}
              <label className="flex min-h-11 items-start gap-3 leading-5">
                <input type="checkbox" className="mt-1 size-4 shrink-0 focus-visible:outline-2" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                <span>
                  {outcome === "accepted"
                    ? "I confirm that I am recording an acceptance already received from the client."
                    : "I confirm that I am recording a decline already received from the client."}
                </span>
              </label>
              {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" disabled={pending} onClick={close}>Cancel</Button>
                <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending}>
                  {pending ? "Saving…" : outcome === "accepted" ? "Record acceptance" : "Record decline"}
                </Button>
              </DialogFooter>
            </form>
          )}
          {outcome == null ? (
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11 w-full" onClick={close}>Cancel</Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
