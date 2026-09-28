import Link from "next/link";
import { VariationDocument } from "@/components/variations/VariationDocument";
import { VariationClientResponse } from "@/components/variations/VariationClientResponse";
import { Button } from "@/components/ui/button";
import type { VariationResponseDeliveryState } from "@/lib/variations/response-actions";
import type { VariationPublicView as PublicView } from "@/lib/variations/public-lookup";

function formatWhen(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function VariationPublicView({
  view,
  clientEmail,
  onClientEmail,
}: {
  view: PublicView;
  clientEmail?: VariationResponseDeliveryState | null;
  onClientEmail?: (state: VariationResponseDeliveryState) => void;
}) {
  if (view.state === "withdrawn") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-sm print:bg-white">
        <p>This Variation has been withdrawn. Contact the builder if you received this link in error.</p>
      </main>
    );
  }
  if (view.state === "unavailable") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-sm print:bg-white">
        <p>This Variation is unavailable.</p>
      </main>
    );
  }

  const quote =
    view.document.quoteNumber && view.document.quoteRevision != null
      ? `This relates to accepted Quote ${view.document.quoteNumber}, Revision ${view.document.quoteRevision}.`
      : null;

  return (
    <main className="mx-auto w-full min-w-0 max-w-[960px] overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 print:bg-white print:p-0">
      {clientEmail === "failed" ? (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700" data-variation-client-email="failed">
          Your response is recorded. The confirmation email could not be sent.
        </p>
      ) : null}
      {clientEmail === "sent" ? (
        <p role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" data-variation-client-email="sent">
          A confirmation email has been sent.
        </p>
      ) : null}
      {view.state === "accepted" ? (
        <section className="mb-4 min-w-0 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" data-variation-public-accepted="true" role="status">
          <h1 className="text-lg font-semibold">Variation accepted</h1>
          {formatWhen(view.outcome.respondedAt) ? <p className="mt-2 break-words">Accepted {formatWhen(view.outcome.respondedAt)}</p> : null}
          {view.outcome.responderName ? <p className="break-words">Accepted by {view.outcome.responderName}</p> : null}
          <p className="break-words">Accepted adjustment: {view.outcome.adjustmentInclLabel} incl GST</p>
          <p className="break-words">Revised accepted contract: {view.outcome.revisedContractInclLabel} incl GST</p>
          {quote ? <p className="break-words">{quote}</p> : null}
          <Button className="mt-3" size="touch" variant="outline" render={<Link href={view.recordPath} />}>View response record</Button>
        </section>
      ) : null}
      {view.state === "declined" ? (
        <section className="mb-4 min-w-0 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-800" data-variation-public-declined="true" role="status">
          <h1 className="text-lg font-semibold">Variation declined</h1>
          {formatWhen(view.outcome.respondedAt) ? <p className="mt-2 break-words">Declined {formatWhen(view.outcome.respondedAt)}</p> : null}
          {view.outcome.responderName ? <p className="break-words">Declined by {view.outcome.responderName}</p> : null}
          {view.outcome.declineReason ? <p className="break-words">Reason: {view.outcome.declineReason}</p> : null}
          <p className="break-words">Contract value unchanged. This decline did not change the accepted contract value.</p>
          {view.outcome.revisedContractInclLabel ? <p>Accepted contract: {view.outcome.revisedContractInclLabel} incl GST</p> : null}
          <Button className="mt-3" size="touch" variant="outline" render={<Link href={view.recordPath} />}>View response record</Button>
        </section>
      ) : null}
      <VariationDocument model={view.document} />
      {view.state === "proposed" ? (
        <VariationClientResponse token={view.token} document={view.document} attachmentCount={view.attachmentCount} onClientEmail={onClientEmail} />
      ) : null}
    </main>
  );
}
