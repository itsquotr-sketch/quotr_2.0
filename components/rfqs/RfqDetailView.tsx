"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RfqDetail } from "@/lib/rfqs/load";
import { gstTreatmentLabel, pricingStructureLabel } from "@/lib/rfqs/shared";
import { rfqDeliveryFailed, rfqDeliveryLabel, rfqResponseLabel } from "@/lib/rfqs/states";
import { resendRfqRecipient, revokeRfqRecipient, signRfqResponseFile } from "@/lib/rfqs/actions";
import type { RfqPricingTarget } from "@/lib/rfqs/load";
import { RfqPricingApply } from "@/components/rfqs/RfqPricingApply";

export function RfqDetailView({
  detail,
  canEdit,
  canPrice,
  pricing,
}: {
  detail: RfqDetail;
  canEdit: boolean;
  canPrice: boolean;
  pricing: RfqPricingTarget | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const names = new Map(detail.recipients.map((recipient) => [recipient.id, recipient.tradingName]));
  const submitted = detail.responses.filter((response) => response.status === "submitted");

  async function resend(recipientId: string) {
    setError(null);
    const result = await resendRfqRecipient({
      projectId: detail.projectId,
      rfqId: detail.id,
      recipientId,
    });
    if (!result.ok) setError(result.error);
    else if (result.failed) setError("The link was replaced, but the email was not accepted.");
    router.refresh();
  }

  async function revoke(recipientId: string) {
    setError(null);
    const result = await revokeRfqRecipient({
      projectId: detail.projectId,
      rfqId: detail.id,
      recipientId,
    });
    if (!result.ok) setError(result.error);
    router.refresh();
  }

  async function openFile(responseId: string) {
    const result = await signRfqResponseFile({ projectId: detail.projectId, responseId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const link = document.createElement("a");
    link.href = result.url;
    link.rel = "noopener";
    link.click();
  }

  return (
    <div className="grid gap-6" data-rfq-detail>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold">{detail.scopeLabel || "Request"}</h1>
          <p className="text-sm text-foreground/70">{detail.status === "draft" ? "Draft" : "Sent"} · The request content stays as it was sent.</p>
        </div>
        {canEdit && detail.status === "draft" ? (
          <Button className="h-11 min-h-11" render={<Link href={`/app/projects/${detail.projectId}/requests/${detail.id}/edit`} />}>
            Edit draft
          </Button>
        ) : null}
      </div>

      <section className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="text-base font-semibold">Request</h2>
        <p>{detail.requestedScope || "No scope written."}</p>
        {detail.measurementNotes ? <p>Measurements: {detail.measurementNotes}</p> : null}
        <p>Due: {detail.responseDueOn || "Not set"}</p>
        <p>Site address: {detail.includeSiteAddress ? detail.siteAddress || "None" : "Not included"}</p>
        {detail.siteDetails ? <p>Site details: {detail.siteDetails}</p> : null}
        {detail.questions ? <p>Questions: {detail.questions}</p> : null}
        {detail.message ? <p>Message: {detail.message}</p> : null}
        <p>Files: {detail.files.length === 0 ? "None selected" : detail.files.map((file) => file.filename).join(", ")}</p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-base font-semibold">Recipients</h2>
        <ul className="grid gap-2">
          {detail.recipients.map((recipient) => (
            <li key={recipient.id} className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/app/contacts/subcontractors/${recipient.subcontractorId}`} className="font-medium break-words">{recipient.tradingName}</Link>
                  <p>{recipient.contactName} · {recipient.contactEmail}</p>
                  <p className="text-foreground/70">{recipient.suggestionReason || "Chosen manually"}</p>
                </div>
                <div className="text-right">
                  <p>{rfqResponseLabel(recipient.responseState)}</p>
                  <p className="text-foreground/70">{rfqDeliveryLabel(recipient.deliveryState)}{recipient.viewed ? " · Viewed" : ""}</p>
                  {rfqDeliveryFailed(recipient.deliveryState) ? <p>The email was not delivered. No response has been received.</p> : null}
                </div>
              </div>
              {canEdit && detail.status === "sent" ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => resend(recipient.id)}>Resend</Button>
                  <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => revoke(recipient.id)}>Revoke link</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3" data-rfq-compare>
        <h2 className="text-base font-semibold">Compare responses</h2>
        <p className="text-sm text-foreground/70">No response is not a decline. Using a price for draft pricing does not award the work or notify the subcontractor.</p>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2 font-medium">Business</th>
                <th className="p-2 font-medium">State</th>
                <th className="p-2 font-medium">Price ex GST</th>
                <th className="p-2 font-medium">GST</th>
                <th className="p-2 font-medium">Structure</th>
                <th className="p-2 font-medium">Included</th>
                <th className="p-2 font-medium">Excluded</th>
                <th className="p-2 font-medium">Valid until</th>
                <th className="p-2 font-medium">Pricing</th>
                <th className="p-2 font-medium">File</th>
              </tr>
            </thead>
            <tbody>
              {detail.recipients.map((recipient) => {
                const latest = submitted.filter((response) => response.recipientId === recipient.id).sort((a, b) => b.versionNumber - a.versionNumber)[0];
                return (
                  <tr key={recipient.id} className="border-b align-top">
                    <td className="p-2">{recipient.tradingName}</td>
                    <td className="p-2">{rfqResponseLabel(recipient.responseState)}</td>
                    <td className="p-2">{latest ? latest.priceExGst?.toLocaleString() : "—"}</td>
                    <td className="p-2">{latest ? gstTreatmentLabel(latest.gstTreatment) : "—"}</td>
                    <td className="p-2">{latest ? pricingStructureLabel(latest.pricingStructure) : "—"}</td>
                    <td className="p-2">{latest?.includedScope || "—"}</td>
                    <td className="p-2">{latest?.excludedScope || "—"}</td>
                    <td className="p-2">{latest?.validUntil || "—"}</td>
                    <td className="p-2">{latest && detail.applications.some((application) => application.responseId === latest.id) ? "Used for pricing" : "—"}</td>
                    <td className="p-2">
                      {latest?.fileReady ? (
                        <button type="button" className="underline" onClick={() => openFile(latest.id)}>{latest.fileName || "PDF"}</button>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {submitted.length > 1 ? (
          <ul className="grid gap-2 text-sm">
            {submitted.map((response) => (
              <li key={response.id}>Version {response.versionNumber} from {names.get(response.recipientId) || "Recipient"} remains on record.</li>
            ))}
          </ul>
        ) : null}
      </section>

      <RfqPricingApply detail={detail} pricing={pricing} canPrice={canPrice} />

      <section className="grid gap-2">
        <h2 className="text-base font-semibold">Communication</h2>
        <ol className="grid gap-2">
          {detail.events.map((event) => (
            <li key={event.id} className="text-sm">
              <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
              {" · "}
              {event.summary}
              {event.recipientId ? ` · ${names.get(event.recipientId) || "Recipient"}` : ""}
            </li>
          ))}
        </ol>
        {detail.clarifications.map((note) => (
          <p key={note.id} className="rounded-md border border-border bg-card p-3 text-sm">
            {names.get(note.recipientId) || "Recipient"}: {note.body}
          </p>
        ))}
      </section>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
