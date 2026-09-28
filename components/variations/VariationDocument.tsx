import { QuoteCompanyLogo } from "@/components/quotes/QuoteCompanyLogo";
import { VariationSupportingGallery } from "@/components/variations/VariationSupportingGallery";
import {
  VARIATION_DOCUMENT_ACCEPTANCE_COPY,
  VARIATION_DOCUMENT_OMISSION_COPY,
  type VariationDocumentModel,
} from "@/lib/variations/presentation";

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <p className="break-words">
      <span className="text-neutral-500">{label}: </span>
      {value}
    </p>
  );
}

function MoneyRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${strong ? "font-semibold" : ""}`}>
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}

export function VariationDocument({ model }: { model: VariationDocumentModel }) {
  const awaitingResponse = model.statusWording === "Proposed Variation — not yet accepted." || model.statusWording === "Proposed Variation — awaiting response";
  const accepted = model.statusWording === "Accepted Variation.";
  const declined = model.statusWording === "Declined Variation.";
  return (
    <article
      data-variation-document="true"
      className="quote-template mx-auto w-full min-w-0 max-w-[960px] overflow-x-hidden rounded-xl border border-neutral-200 bg-white p-5 text-neutral-900 shadow-sm sm:p-7 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none"
      style={model.brandPrimary ? { borderColor: model.brandPrimary } : undefined}
    >
      <header className="mb-5 flex flex-col gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between print:mb-4">
        <div className="min-w-0 flex-1 space-y-1">
          <QuoteCompanyLogo logoUrl={model.logoUrl} companyName={model.companyName} brandPrimary={model.brandPrimary} />
          {model.logoUrl && model.companyName ? <p className="break-words text-sm font-semibold">{model.companyName}</p> : null}
          {model.legalName && model.legalName !== model.companyName ? <p className="break-words text-xs text-neutral-500">{model.legalName}</p> : null}
          <div className="space-y-0.5 text-xs leading-relaxed text-neutral-500">
            {[model.contractorEmail, model.contractorPhone].filter(Boolean).join(" · ") ? (
              <p className="break-all">{[model.contractorEmail, model.contractorPhone].filter(Boolean).join(" · ")}</p>
            ) : null}
            {model.contractorWebsite ? <p>{model.contractorWebsite}</p> : null}
            {model.contractorAddress ? <p>{model.contractorAddress}</p> : null}
            {model.registrationLines.map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>
        <div className="min-w-0 sm:shrink-0 sm:text-right">
          <p className="text-sm font-semibold uppercase tracking-wide">Variation</p>
          <p className="mt-1 text-sm">Variation {model.variationNumber}</p>
          <p className="text-sm">Revision {model.revisionNumber}</p>
          <Detail label="Issued" value={model.issueDateLabel} />
        </div>
      </header>

      <p className="text-sm font-medium" data-variation-document-status="true">{model.statusWording || "Proposed Variation — awaiting response"}</p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Client</h2>
          {model.clientName ? <p className="mt-1">{model.clientName}</p> : null}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Project</h2>
          {model.projectTitle ? <p className="mt-1">{model.projectTitle}</p> : null}
          {model.siteAddress ? <p>{model.siteAddress}</p> : null}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Accepted master Quote</h2>
        {model.quoteNumber && model.quoteRevision != null ? (
          <p className="mt-1 break-words text-sm">
            {model.quoteNumber} · Revision {model.quoteRevision}
            {model.quoteAcceptedOnLabel ? ` · Accepted ${model.quoteAcceptedOnLabel}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm">Accepted Quote reference unavailable</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">{model.title}</h2>
        {model.summary ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{model.summary}</p> : null}
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-base font-semibold">Scope changes</h2>
        {model.scopeGroups.length > 0 ? (
          <div className="mt-3 space-y-3" data-variation-scope-groups="true">
            {model.scopeGroups.map((group) => (
              <div key={group.name}>
                <h3 className="text-sm font-semibold">{group.name}</h3>
                {group.description ? <p className="mt-1 text-sm text-neutral-600">{group.description}</p> : null}
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {group.items.map((item) => <li key={`${group.name}:${item}`} className="break-words">{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
        {model.additions.length > 0 ? (
          <div className="mt-3">
            <h3 className="text-sm font-semibold">Additions</h3>
            <ul className="mt-2 space-y-2">
              {model.additions.map((line) => (
                <li key={line.description} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                  <span className="min-w-0 break-words">{line.description}</span>
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
                <li key={line.description} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                  <span className="min-w-0 break-words">{line.description}</span>
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
          <MoneyRow label="Net adjustment ex GST" value={model.netExLabel} />
          <MoneyRow label="GST" value={model.gstLabel} />
          <MoneyRow label="Adjustment incl GST" value={model.inclLabel} strong />
          {declined ? null : (
            <>
              <MoneyRow label={accepted ? "Previous accepted contract" : "Current accepted contract"} value={model.currentContractInclLabel} />
              <MoneyRow label={accepted ? "Revised accepted contract" : "Proposed revised contract"} value={model.proposedInclLabel} />
            </>
          )}
        </dl>
        {declined ? <p className="mt-3 text-sm">Contract value unchanged.</p> : null}
        {awaitingResponse ? (
          <p className="mt-2 break-words text-xs text-neutral-600">
            Current accepted contract ex GST {model.currentContractExLabel}. Proposed revised contract ex GST {model.proposedExLabel}, GST {model.proposedGstLabel}.
          </p>
        ) : null}
        {accepted ? (
          <p className="mt-2 break-words text-xs text-neutral-600">
            Previous accepted contract ex GST {model.currentContractExLabel}. Revised accepted contract ex GST {model.proposedExLabel}, GST {model.proposedGstLabel}.
          </p>
        ) : null}
        {awaitingResponse ? <p className="mt-3 break-words text-sm">{VARIATION_DOCUMENT_ACCEPTANCE_COPY}</p> : null}
        {awaitingResponse ? <p className="mt-2 break-words text-sm">This proposed adjustment does not change the accepted contract value unless the Variation is accepted.</p> : null}
        {model.masterQuoteClause ? <p className="mt-3 break-words text-sm leading-6">{model.masterQuoteClause}</p> : null}
        {model.showsOmissionNotice ? <p className="mt-1 text-sm">{VARIATION_DOCUMENT_OMISSION_COPY}</p> : null}
      </section>

      {model.clientNotes ? (
        <section className="mt-6">
          <h2 className="text-base font-semibold">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{model.clientNotes}</p>
        </section>
      ) : null}

      {model.supportingFiles.length > 0 ? (
        <>
          <section className="mt-6 hidden print:block" data-variation-supporting-print="true">
            <h2 className="text-base font-semibold">Supporting information</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {model.supportingFiles.map((file) => (
                <li key={file.fileId} className="break-words">
                  <p>{file.displayFilename}</p>
                  <p className="text-neutral-600">{file.typeLabel} · {file.sizeLabel}</p>
                  {file.caption ? <p>{file.caption}</p> : null}
                </li>
              ))}
            </ul>
          </section>
          <div className="print:hidden">
            <VariationSupportingGallery files={model.supportingFiles} />
          </div>
        </>
      ) : null}

    </article>
  );
}
