import { QuoteCompanyLogo } from "@/components/quotes/QuoteCompanyLogo";
import { formatAttachmentSize } from "@/lib/variations/attachment-files";
import type { VariationResponseReceipt } from "@/lib/variations/response-receipt";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-all text-right sm:max-w-[70%]">{value}</dd>
    </div>
  );
}

export function VariationResponseReceiptView({ receipt }: { receipt: VariationResponseReceipt }) {
  return (
    <article
      data-variation-response-receipt="true"
      className="quote-template mx-auto w-full min-w-0 max-w-[960px] overflow-x-hidden rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-900 shadow-sm sm:p-7 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none"
      style={receipt.brandPrimary ? { borderColor: receipt.brandPrimary } : undefined}
    >
      <header className="mb-5 flex flex-col gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <QuoteCompanyLogo logoUrl={receipt.logoUrl} companyName={receipt.companyName} brandPrimary={receipt.brandPrimary} />
          {receipt.logoUrl && receipt.companyName ? <p className="break-words text-sm font-semibold">{receipt.companyName}</p> : null}
          {receipt.legalName && receipt.legalName !== receipt.companyName ? <p className="text-xs text-neutral-500">{receipt.legalName}</p> : null}
          <div className="space-y-0.5 break-words text-xs leading-relaxed text-neutral-500">
            {[receipt.contractorEmail, receipt.contractorPhone].filter(Boolean).join(" · ") ? (
              <p className="break-all">{[receipt.contractorEmail, receipt.contractorPhone].filter(Boolean).join(" · ")}</p>
            ) : null}
            {receipt.contractorWebsite ? <p className="break-all">{receipt.contractorWebsite}</p> : null}
            {receipt.contractorAddress ? <p>{receipt.contractorAddress}</p> : null}
            {receipt.registrationLines.map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="text-sm font-semibold uppercase tracking-wide">Response record</p>
          <p className="mt-1 break-all text-xs text-neutral-500">Reference {receipt.reference}</p>
          <p className="mt-2 font-medium">{receipt.outcomeLabel}</p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Client</h2>
          {receipt.clientName ? <p className="mt-1 break-words">{receipt.clientName}</p> : null}
        </div>
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Project</h2>
          {receipt.projectTitle ? <p className="mt-1 break-words">{receipt.projectTitle}</p> : null}
          {receipt.siteAddress ? <p className="break-words">{receipt.siteAddress}</p> : null}
        </div>
      </section>

      <dl className="mt-6 space-y-2">
        <Row label="Variation" value={`Variation ${receipt.variationNumber}, Revision ${receipt.revisionNumber}`} />
        <Row
          label="Master Quote"
          value={receipt.quoteNumber && receipt.quoteRevision != null ? `${receipt.quoteNumber}, Revision ${receipt.quoteRevision}` : null}
        />
        <Row label="Response" value={receipt.respondedAtLabel} />
        <Row label="Responder" value={receipt.responderName} />
        <Row label="Email" value={receipt.responderEmail} />
        <Row label="Source" value={receipt.sourceLabel} />
      </dl>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Adjustment</h2>
        <dl className="mt-2 space-y-1">
          <Row label="Ex GST" value={receipt.adjustmentExLabel} />
          <Row label="GST" value={receipt.adjustmentGstLabel} />
          <Row label="Incl GST" value={receipt.adjustmentInclLabel} />
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Accepted contract</h2>
        <dl className="mt-2 space-y-1">
          <Row label="Previous accepted contract" value={`${receipt.previousContractInclLabel} incl GST`} />
          {receipt.contractUnchanged ? (
            <div className="pt-1 font-medium">Contract value unchanged</div>
          ) : (
            <Row label="Revised accepted contract" value={receipt.revisedContractInclLabel ? `${receipt.revisedContractInclLabel} incl GST` : null} />
          )}
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Supporting attachments ({receipt.attachmentCount})
        </h2>
        {receipt.attachments.length === 0 ? <p className="mt-2">No supporting attachments.</p> : (
          <ul className="mt-2 space-y-2">
            {receipt.attachments.map((file) => (
              <li key={`${file.displayFilename}-${file.byteSize}`} className="min-w-0 break-all">
                {file.displayFilename}
                {file.caption ? <span className="break-words text-neutral-500"> — {file.caption}</span> : null}
                <span className="text-neutral-500"> · {formatAttachmentSize(file.byteSize)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Master Quote terms</h2>
        <p className="mt-2 break-words leading-6">{receipt.masterQuoteStatement}</p>
      </section>

      {receipt.confirmations.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Confirmations</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            {receipt.confirmations.map((line) => <li key={line} className="break-words">{line}</li>)}
          </ul>
        </section>
      ) : null}

      {receipt.declineReason ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Decline reason</h2>
          <p className="mt-2 break-words">{receipt.declineReason}</p>
        </section>
      ) : null}
    </article>
  );
}
