import {
  VARIATION_DOCUMENT_ACCEPTANCE_COPY,
  VARIATION_DOCUMENT_OMISSION_COPY,
  type VariationDocumentModel,
} from "@/lib/variations/presentation";

export function VariationDocument({ model }: { model: VariationDocumentModel }) {
  return (
    <article
      data-variation-document="true"
      className="mx-auto max-w-3xl bg-white px-6 py-8 text-black shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none"
    >
      <header className="border-b border-neutral-200 pb-4">
        <p className="text-sm font-medium">{model.companyName}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Variation {model.variationNumber}</h1>
        <p className="mt-1 text-sm">Revision {model.revisionNumber}</p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Client and project</h2>
          <p className="mt-1">{model.clientName}</p>
          <p>{model.projectTitle}</p>
          {model.siteAddress ? <p>{model.siteAddress}</p> : null}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Issue date</h2>
          <p className="mt-1">{model.issueDateLabel ?? "Not issued"}</p>
          <p className="mt-2 text-sm font-medium" data-variation-document-status="true">
            {model.statusWording}
          </p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">{model.title}</h2>
        {model.summary ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{model.summary}</p> : null}
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-base font-semibold">Scope changes</h2>
        {model.additions.length > 0 ? (
          <div className="mt-3">
            <h3 className="text-sm font-semibold">Additions</h3>
            <ul className="mt-2 space-y-2">
              {model.additions.map((line) => (
                <li key={line.description} className="flex items-start justify-between gap-4 text-sm">
                  <span>{line.description}</span>
                  <span className="shrink-0 tabular-nums">{line.amountLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {model.omissions.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Omissions</h3>
            <p className="mt-1 text-sm">{VARIATION_DOCUMENT_OMISSION_COPY}</p>
            <ul className="mt-2 space-y-2">
              {model.omissions.map((line) => (
                <li key={line.description} className="flex items-start justify-between gap-4 text-sm">
                  <span>{line.description}</span>
                  <span className="shrink-0 tabular-nums">{line.amountLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {model.substitutions.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Substitutions</h3>
            <ul className="mt-2 space-y-3">
              {model.substitutions.map((pair) => (
                <li key={`${pair.remove.description}-${pair.add.description}`} className="text-sm">
                  <p>Remove: {pair.remove.description} — {pair.remove.amountLabel}</p>
                  <p>Add: {pair.add.description} — {pair.add.amountLabel}</p>
                  <p className="font-medium">Net adjustment: {pair.netLabel} ex GST</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {model.noCostChanges.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">No-cost changes</h3>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {model.noCostChanges.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-6 break-inside-avoid border-t border-neutral-200 pt-4">
        <h2 className="text-base font-semibold">Contract adjustment</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-4"><dt>Net adjustment ex GST</dt><dd className="tabular-nums">{model.netExLabel}</dd></div>
          <div className="flex justify-between gap-4"><dt>GST</dt><dd className="tabular-nums">{model.gstLabel}</dd></div>
          <div className="flex justify-between gap-4 font-semibold"><dt>Adjustment incl GST</dt><dd className="tabular-nums">{model.inclLabel}</dd></div>
          <div className="flex justify-between gap-4 pt-2"><dt>Current accepted contract</dt><dd className="tabular-nums">{model.currentContractInclLabel}</dd></div>
          <div className="flex justify-between gap-4"><dt>Proposed revised contract</dt><dd className="tabular-nums">{model.proposedInclLabel}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-neutral-600">
          Current accepted contract ex GST {model.currentContractExLabel}. Proposed revised contract ex GST {model.proposedExLabel}, GST {model.proposedGstLabel}.
        </p>
        <p className="mt-3 text-sm">{VARIATION_DOCUMENT_ACCEPTANCE_COPY}</p>
        {model.showsOmissionNotice ? <p className="mt-1 text-sm">{VARIATION_DOCUMENT_OMISSION_COPY}</p> : null}
      </section>

      {model.clientNotes ? (
        <section className="mt-6">
          <h2 className="text-base font-semibold">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{model.clientNotes}</p>
        </section>
      ) : null}

      <section className="mt-8 border-t border-dashed border-neutral-300 pt-4">
        <h2 className="text-sm font-semibold">Acceptance</h2>
        <p className="mt-1 text-sm text-neutral-700">{model.acceptancePlaceholder}</p>
      </section>
    </article>
  );
}
