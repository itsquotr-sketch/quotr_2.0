"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordVariationResponse } from "@/lib/variations/response-actions";
import {
  VARIATION_MANUAL_EVIDENCE_TYPES,
  variationEvidenceTypeLabel,
  variationManualReceivedConfirmation,
  type VariationManualEvidenceType,
} from "@/lib/variations/response";

export function VariationManualResponse(props: {
  projectId: string;
  variationId: string;
  revisionId: string;
}) {
  const router = useRouter();
  const key = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : "");
  const lock = useRef(false);
  const [outcome, setOutcome] = useState<"accepted" | "declined">("accepted");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [evidenceType, setEvidenceType] = useState<VariationManualEvidenceType>("email_confirmation");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(): Promise<void> {
    if (lock.current) return;
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
      confirmReceived: confirmed,
      idempotencyKey: key.current,
    });
    if (!result.ok) {
      lock.current = false;
      setPending(false);
      setError(result.error ?? "The response could not be recorded.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-card p-4" data-variation-manual-response="true">
      <h2 className="text-base font-semibold">Record a response received outside Quotr</h2>
      <p className="mt-1 text-sm text-muted-foreground">Use this when the client has already accepted or declined, and you are recording that outcome.</p>
      <form
        className="mt-4 space-y-4 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" size="touch" variant={outcome === "accepted" ? "default" : "outline"} className="w-full sm:w-auto" onClick={() => setOutcome("accepted")}>
            Record acceptance
          </Button>
          <Button type="button" size="touch" variant={outcome === "declined" ? "default" : "outline"} className="w-full sm:w-auto" onClick={() => setOutcome("declined")}>
            Record decline
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-responder-name">Client name</Label>
          <Input id="manual-responder-name" className="h-11 w-full text-base" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-responder-email">Client email, if known</Label>
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
          {evidenceType === "verbal_approval" || evidenceType === "other" ? (
            <p className="text-muted-foreground">Describe what was agreed, and when. A short note is not enough for verbal approval or other evidence.</p>
          ) : null}
        </div>
        <label className="flex items-start gap-3 leading-5">
          <input type="checkbox" className="mt-1 size-4 shrink-0" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>{variationManualReceivedConfirmation()}</span>
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" size="touch" className="w-full sm:w-auto" disabled={pending}>
          {pending ? "Saving…" : outcome === "accepted" ? "Record acceptance" : "Record decline"}
        </Button>
      </form>
    </section>
  );
}
