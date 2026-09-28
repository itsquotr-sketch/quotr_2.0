import { VariationDocument } from "@/components/variations/VariationDocument";
import { VariationClientResponse } from "@/components/variations/VariationClientResponse";
import type { VariationPublicView as PublicView } from "@/lib/variations/public-lookup";

function formatWhen(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function VariationPublicView({ view }: { view: PublicView }) {
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
    <main className="mx-auto w-full max-w-[960px] px-3 py-4 sm:px-4 sm:py-6 print:bg-white print:p-0">
      {view.state === "accepted" ? (
        <section className="mb-4 rounded-2xl border bg-white p-4 text-sm" data-variation-public-accepted="true">
          <h1 className="text-lg font-semibold">Variation accepted</h1>
          {formatWhen(view.outcome.respondedAt) ? <p className="mt-2">Accepted {formatWhen(view.outcome.respondedAt)}</p> : null}
          {view.outcome.responderName ? <p>Accepted by {view.outcome.responderName}</p> : null}
          <p>Accepted adjustment: {view.outcome.adjustmentInclLabel} incl GST</p>
          <p>Revised accepted contract: {view.outcome.revisedContractInclLabel} incl GST</p>
          {quote ? <p>{quote}</p> : null}
        </section>
      ) : null}
      {view.state === "declined" ? (
        <section className="mb-4 rounded-2xl border bg-white p-4 text-sm" data-variation-public-declined="true">
          <h1 className="text-lg font-semibold">Variation declined</h1>
          {formatWhen(view.outcome.respondedAt) ? <p className="mt-2">Declined {formatWhen(view.outcome.respondedAt)}</p> : null}
          {view.outcome.responderName ? <p>Declined by {view.outcome.responderName}</p> : null}
          {view.outcome.declineReason ? <p>Reason: {view.outcome.declineReason}</p> : null}
          <p>This decline did not change the accepted contract value.</p>
          {view.outcome.revisedContractInclLabel ? <p>Accepted contract: {view.outcome.revisedContractInclLabel} incl GST</p> : null}
        </section>
      ) : null}
      <VariationDocument model={view.document} />
      {view.state === "proposed" ? (
        <VariationClientResponse token={view.token} document={view.document} attachmentCount={view.attachmentCount} />
      ) : null}
    </main>
  );
}
