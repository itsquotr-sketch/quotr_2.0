import type { VariationDocumentModel } from "@/lib/variations/presentation";
import type { VariationPublicView as PublicView } from "@/lib/variations/public-lookup";

function Lines({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ description: string; amountLabel?: string }>;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={`${title}-${row.description}`} className="flex justify-between gap-4">
            <span className="min-w-0 break-words">{row.description}</span>
            {row.amountLabel ? <span className="shrink-0 tabular-nums">{row.amountLabel}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProposedDocument({
  document,
  contactLine,
}: {
  document: VariationDocumentModel;
  contactLine: string | null;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl bg-white px-4 py-8 text-neutral-950 sm:px-8">
      <p className="text-sm font-medium">{document.companyName}</p>
      <h1 className="mt-2 text-2xl font-semibold">Variation {document.variationNumber}</h1>
      <p className="mt-1 text-sm">Revision {document.revisionNumber}</p>
      <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm">
        Proposed Variation — awaiting response
      </p>
      <dl className="mt-6 grid gap-2 text-sm">
        <div className="flex justify-between gap-4"><dt>Client</dt><dd className="text-right">{document.clientName}</dd></div>
        <div className="flex justify-between gap-4"><dt>Project</dt><dd className="text-right">{document.projectTitle}</dd></div>
        {document.issueDateLabel ? <div className="flex justify-between gap-4"><dt>Issued</dt><dd>{document.issueDateLabel}</dd></div> : null}
      </dl>
      <h2 className="mt-6 text-lg font-semibold">{document.title}</h2>
      {document.summary ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{document.summary}</p> : null}
      <Lines title="Additions" rows={document.additions} />
      <Lines title="Omissions" rows={document.omissions} />
      {document.substitutions.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-base font-semibold">Substitutions</h2>
          <ul className="mt-2 space-y-3 text-sm">
            {document.substitutions.map((row) => (
              <li key={row.remove.description} className="rounded-xl border border-neutral-200 p-3">
                <p>Remove: {row.remove.description} · {row.remove.amountLabel}</p>
                <p>Add: {row.add.description} · {row.add.amountLabel}</p>
                <p>Net: {row.netLabel}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <dl className="mt-6 grid gap-2 border-t border-neutral-200 pt-4 text-sm">
        <div className="flex justify-between gap-4"><dt>Net adjustment ex GST</dt><dd className="tabular-nums">{document.netExLabel}</dd></div>
        <div className="flex justify-between gap-4"><dt>GST</dt><dd className="tabular-nums">{document.gstLabel}</dd></div>
        <div className="flex justify-between gap-4 font-semibold"><dt>Adjustment incl GST</dt><dd className="tabular-nums">{document.inclLabel}</dd></div>
        <div className="flex justify-between gap-4"><dt>Current accepted contract</dt><dd className="tabular-nums">{document.currentContractInclLabel}</dd></div>
        <div className="flex justify-between gap-4"><dt>Proposed revised contract</dt><dd className="tabular-nums">{document.proposedInclLabel}</dd></div>
      </dl>
      <p className="mt-3 text-sm">This proposed adjustment is not the accepted contract value.</p>
      {document.clientNotes ? (
        <section className="mt-6">
          <h2 className="text-base font-semibold">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{document.clientNotes}</p>
        </section>
      ) : null}
      <p className="mt-6 text-sm">Client response will be available in the next Variation stage.</p>
      {contactLine ? <p className="mt-4 text-sm text-neutral-700">{contactLine}</p> : null}
    </article>
  );
}

export function VariationPublicView({ view }: { view: PublicView }) {
  if (view.state === "withdrawn") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-sm">
        <p>This Variation has been withdrawn. Contact the builder if you received this link in error.</p>
      </main>
    );
  }
  if (view.state === "unavailable") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-sm">
        <p>This Variation is unavailable.</p>
      </main>
    );
  }
  return <ProposedDocument document={view.document} contactLine={view.contactLine} />;
}
