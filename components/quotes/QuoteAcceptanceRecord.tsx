import { formatPricingMoney } from "@/lib/pricing/format";
import { formatQuoteDateTime, formatQuoteNumberRevision } from "@/lib/quotes/display";
import { isValidDrawnSignatureSvg } from "@/lib/quotes/acceptance";
import type { QuoteAcceptanceRecord } from "@/lib/quotes/acceptance-types";
import type { Quote } from "@/lib/quotes/types";

export function QuoteAcceptanceRecordSection({
  quote,
  acceptance,
  timeZone,
}: {
  quote: Quote;
  acceptance: QuoteAcceptanceRecord | null;
  timeZone?: string;
}) {
  if (!acceptance || quote.status !== "accepted") return null;

  const acceptedAt = formatQuoteDateTime(acceptance.accepted_at, timeZone);
  const isClient = acceptance.source === "client";

  return (
    <section
      data-quote-acceptance-record="true"
      className="quote-template-acceptance mt-6 break-inside-avoid border-t border-neutral-200 pt-5 print:mt-0 print:break-before-page print:pt-4"
    >
      <h3 className="text-sm font-semibold text-neutral-900 print:text-[12pt]">
        Acceptance
      </h3>
      <dl className="mt-3 space-y-1.5 text-sm text-neutral-700 print:text-[10pt]">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Quote</dt>
          <dd className="font-medium text-neutral-900">
            {formatQuoteNumberRevision(quote)}
          </dd>
        </div>
        {isClient && acceptance.signer_name ? (
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Accepted by</dt>
            <dd className="font-medium text-neutral-900">{acceptance.signer_name}</dd>
          </div>
        ) : (
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Recorded as</dt>
            <dd className="font-medium text-neutral-900">Marked accepted manually</dd>
          </div>
        )}
        {acceptedAt ? (
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Date/time</dt>
            <dd className="font-medium text-neutral-900">{acceptedAt}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Total incl. GST</dt>
          <dd className="font-medium tabular-nums text-neutral-900">
            {formatPricingMoney(acceptance.accepted_total_incl_gst)}
          </dd>
        </div>
      </dl>
      {acceptance.acceptance_declaration ? (
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 print:text-[10pt]">
          {acceptance.acceptance_declaration}
        </p>
      ) : null}
      {isClient && acceptance.signature_method === "typed" && acceptance.signer_name ? (
        <p
          className="mt-4 font-serif text-2xl italic text-neutral-900 print:text-[16pt]"
          data-quote-signature-method="typed"
        >
          {acceptance.signer_name}
        </p>
      ) : null}
      {isClient &&
      acceptance.signature_method === "drawn" &&
      acceptance.signature_value &&
      isValidDrawnSignatureSvg(acceptance.signature_value) ? (
        <div
          className="mt-4 max-w-xs text-neutral-900"
          data-quote-signature-method="drawn"
          dangerouslySetInnerHTML={{ __html: acceptance.signature_value }}
        />
      ) : null}
    </section>
  );
}
