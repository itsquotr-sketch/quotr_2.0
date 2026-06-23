import type { CSSProperties } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { formatPricingDate, formatPricingMoney } from "@/lib/pricing/format";
import {
  DEFAULT_VARIATION_WORDING,
  formatCompanyAddress,
  formatGstTreatmentNote,
  formatQuoteReference,
  formatRegistrationLines,
  getCompanyDisplayName,
} from "@/lib/quotes/display";
import {
  groupQuoteItemsBySection,
  type QuoteItemSection,
} from "@/lib/quotes/mappers";
import { sanitizeClientQuoteDescription } from "@/lib/quotes/sanitize";
import type { Quote, QuoteItem } from "@/lib/quotes/types";
import {
  brandColourTint,
  getBrandColours,
} from "@/lib/settings/branding";
import type { CompanySettings } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

// QuoteTemplate is client-facing. Do not render internal pricing fields here.

export type QuoteTemplateProps = {
  quote: Quote;
  quoteItems: QuoteItem[];
  companySettings: CompanySettings | null;
  sections?: QuoteItemSection[];
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm leading-snug text-neutral-700">
      <span className="text-neutral-500">{label}: </span>
      <span className="font-medium text-neutral-900">{value}</span>
    </p>
  );
}

function QuoteLineItemRow({ item }: { item: QuoteItem }) {
  const description = sanitizeClientQuoteDescription(item.description);

  return (
    <>
      <tr
        className={cn(
          "hidden border-b border-neutral-200 sm:table-row print:table-row last:border-0",
          item.optional && "text-neutral-500"
        )}
      >
        <td className="py-1.5 pr-3 align-top print:py-1 print:pr-2">
          <p className="font-medium text-neutral-900 print:text-[9.5pt]">
            {item.label}
            {item.optional ? (
              <span className="ml-1 text-[10px] font-normal">(optional)</span>
            ) : null}
          </p>
          {description ? (
            <p className="mt-0.5 text-xs leading-snug text-neutral-500 print:text-[9pt]">
              {description}
            </p>
          ) : null}
        </td>
        <td className="w-14 py-1.5 pr-2 text-right align-top whitespace-nowrap tabular-nums text-neutral-700 print:w-12 print:py-1 print:text-[9pt]">
          {item.quantity != null ? item.quantity : "—"}
        </td>
        <td className="w-16 py-1.5 pr-2 text-right align-top whitespace-nowrap text-neutral-500 print:w-14 print:py-1 print:text-[9pt]">
          {item.unit ?? "—"}
        </td>
        <td className="w-24 py-1.5 pr-2 text-right align-top whitespace-nowrap tabular-nums text-neutral-700 print:w-20 print:py-1 print:text-[9pt]">
          {item.unit_price != null ? formatPricingMoney(item.unit_price) : "—"}
        </td>
        <td className="w-24 py-1.5 text-right align-top font-medium whitespace-nowrap tabular-nums text-neutral-900 print:w-20 print:py-1 print:text-[9pt]">
          {formatPricingMoney(item.total)}
        </td>
      </tr>

      <tr className="sm:hidden print:hidden">
        <td colSpan={5} className="border-b border-neutral-200 py-2.5 last:border-0">
          <div
            className={cn(
              "space-y-1",
              item.optional && "text-neutral-500"
            )}
          >
            <p className="font-medium text-neutral-900">{item.label}</p>
            {description ? (
              <p className="text-xs leading-snug text-neutral-500">
                {description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500">
              <span>
                Qty: {item.quantity != null ? item.quantity : "—"}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
              <span>
                Unit:{" "}
                {item.unit_price != null
                  ? formatPricingMoney(item.unit_price)
                  : "—"}
              </span>
            </div>
            <p className="text-sm font-medium tabular-nums text-neutral-900">
              {formatPricingMoney(item.total)}
            </p>
          </div>
        </td>
      </tr>
    </>
  );
}

function TextListSection({
  title,
  items,
  accentColour,
}: {
  title: string;
  items: string[];
  accentColour: string | null;
}) {
  if (items.length === 0) return null;

  return (
    <section className="quote-template-terms-section break-inside-avoid">
      <h4
        className="mb-1.5 text-sm font-semibold text-neutral-900 print:text-[10.5pt]"
        style={accentColour ? { color: accentColour } : undefined}
      >
        {title}
      </h4>
      <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-neutral-600 print:text-[10pt]">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TextBlockSection({
  title,
  content,
  accentColour,
}: {
  title: string;
  content: string | null;
  accentColour: string | null;
}) {
  if (!content?.trim()) return null;

  return (
    <section className="quote-template-terms-section break-inside-avoid">
      <h4
        className="mb-1.5 text-sm font-semibold text-neutral-900 print:text-[10.5pt]"
        style={accentColour ? { color: accentColour } : undefined}
      >
        {title}
      </h4>
      <p className="break-words text-sm leading-relaxed text-neutral-600 whitespace-pre-wrap print:text-[10pt]">
        {content}
      </p>
    </section>
  );
}

export function QuoteTemplate({
  quote,
  quoteItems,
  companySettings,
  sections: sectionsProp,
}: QuoteTemplateProps) {
  const companyName = getCompanyDisplayName(companySettings);
  const companyAddress = companySettings
    ? formatCompanyAddress(companySettings)
    : null;
  const quoteReference = formatQuoteReference(quote);
  const registrationLines = formatRegistrationLines(companySettings);

  const { primary: brandPrimary, accent: brandAccent } =
    getBrandColours(companySettings);

  const sections = (sectionsProp ?? groupQuoteItemsBySection(quoteItems))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.visible),
    }))
    .filter((section) => section.items.length > 0);

  const email = companySettings?.contactEmail?.trim();
  const phone = companySettings?.contactPhone?.trim();
  const website = companySettings?.website?.trim();
  const contactPrimary = [email, phone].filter(Boolean).join(" · ");

  const gstTreatmentNote = formatGstTreatmentNote(companySettings);
  const paymentTerms = companySettings?.defaultPaymentTerms?.trim() || null;

  const brandStyle = brandPrimary
    ? ({ "--quote-brand-primary": brandPrimary } as CSSProperties)
    : undefined;

  return (
    <article
      id="quote-template"
      className={cn(
        "quote-template mx-auto w-full max-w-[960px] rounded-xl border border-border/60 bg-white p-5 text-neutral-900 shadow-sm sm:p-7",
        "print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:text-[10pt] print:leading-normal print:shadow-none print:text-black"
      )}
      style={brandStyle}
    >
      <header
        className={cn(
          "quote-template-header mb-5 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between print:mb-4 print:gap-3 print:pb-3",
          brandPrimary ? "border-[var(--quote-brand-primary)]" : "border-neutral-200"
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          {companySettings?.logoUrl?.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={companySettings.logoUrl}
              alt={companyName || "Company logo"}
              className="mb-1 max-h-12 w-auto max-w-[200px] object-contain object-left print:max-h-10"
            />
          ) : companyName ? (
            <p
              className="text-base font-semibold tracking-tight text-neutral-900 print:text-[13pt]"
              style={brandPrimary ? { color: brandPrimary } : undefined}
            >
              {companyName}
            </p>
          ) : null}
          <div className="space-y-0.5 text-xs leading-relaxed text-neutral-500 print:text-[9.5pt]">
            {contactPrimary ? <p>{contactPrimary}</p> : null}
            {website ? <p>{website}</p> : null}
            {companyAddress ? <p>{companyAddress}</p> : null}
            {registrationLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="shrink-0 sm:min-w-[220px] sm:text-right">
          <div className="flex items-center gap-2 sm:justify-end">
            <p
              className="text-sm font-semibold uppercase tracking-wide text-neutral-900 print:text-[12pt]"
              style={brandAccent ? { color: brandAccent } : undefined}
            >
              Quote
            </p>
            {quote.status === "draft" ? (
              <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 print:border-amber-400 print:bg-transparent print:text-amber-900">
                Draft
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 space-y-0.5 sm:text-right">
            <MetaRow label="Quote" value={quoteReference} />
            {quote.revision_number > 1 ? (
              <MetaRow
                label="Revision"
                value={String(quote.revision_number)}
              />
            ) : null}
            {quote.issue_date ? (
              <MetaRow
                label="Issued"
                value={formatPricingDate(quote.issue_date)}
              />
            ) : null}
            {quote.valid_until ? (
              <MetaRow
                label="Valid until"
                value={formatPricingDate(quote.valid_until)}
              />
            ) : null}
            {quote.client_name ? (
              <MetaRow label="Bill to" value={quote.client_name} />
            ) : null}
            {quote.site_address ? (
              <MetaRow label="Site" value={quote.site_address} />
            ) : null}
          </div>
        </div>
      </header>

      {quote.scope_summary?.trim() ? (
        <section className="quote-template-section mb-5 break-inside-avoid print:mb-4">
          <h3
            className="mb-1.5 text-sm font-semibold text-neutral-900 print:text-[11pt]"
            style={brandAccent ? { color: brandAccent } : undefined}
          >
            Scope summary
          </h3>
          <p className="text-sm leading-relaxed text-neutral-600 whitespace-pre-wrap print:text-[10pt]">
            {quote.scope_summary}
          </p>
        </section>
      ) : null}

      {quote.inclusions.length > 0 ? (
        <div className="mb-5 print:mb-4">
          <TextListSection
            title="Inclusions"
            items={quote.inclusions}
            accentColour={brandAccent}
          />
        </div>
      ) : null}

      <div className="quote-template-sections mb-5 space-y-5 print:mb-4 print:space-y-4">
        {sections.length === 0 ? (
          <EmptyState
            title="No quote items"
            description="This quote has no visible line items yet. Refresh from final pricing or check item visibility."
            className="border-neutral-200 bg-neutral-50/50 print:hidden"
          />
        ) : (
          sections.map((section) => (
            <section
              key={section.sectionTitle ?? "general"}
              className="quote-template-section break-inside-avoid-page"
            >
              {section.sectionTitle ? (
                <h3
                  className="mb-1 text-sm font-semibold text-neutral-900 print:text-[11pt]"
                  style={brandAccent ? { color: brandAccent } : undefined}
                >
                  {section.sectionTitle}
                </h3>
              ) : null}
              {section.sectionDescription ? (
                <p className="mb-2 text-sm leading-relaxed text-neutral-600 whitespace-pre-wrap print:mb-1.5 print:text-[9.5pt]">
                  {section.sectionDescription}
                </p>
              ) : null}

              <div className="overflow-x-auto">
                <table className="quote-template-table w-full table-fixed text-xs print:text-[9pt]">
                  <colgroup>
                    <col />
                    <col className="w-14 print:w-12" />
                    <col className="w-16 print:w-14" />
                    <col className="w-24 print:w-20" />
                    <col className="w-24 print:w-20" />
                  </colgroup>
                  <thead className="hidden sm:table-header-group print:table-header-group">
                    <tr
                      className="border-b text-left text-[11px] text-neutral-500 print:text-[9pt]"
                      style={
                        brandPrimary
                          ? { borderColor: brandColourTint(brandPrimary) }
                          : undefined
                      }
                    >
                      <th className="pb-1 pr-3 font-medium">Item</th>
                      <th className="pb-1 pr-2 text-right font-medium">Qty</th>
                      <th className="pb-1 pr-2 text-right font-medium">Unit</th>
                      <th className="pb-1 pr-2 text-right font-medium">
                        Unit price
                      </th>
                      <th className="pb-1 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item) => (
                      <QuoteLineItemRow key={item.id} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>

      <section
        className={cn(
          "quote-template-totals mb-5 break-inside-avoid rounded-md border px-4 py-3 print:mb-0 print:border-neutral-300 print:bg-white print:py-2.5",
          brandPrimary
            ? "border-[var(--quote-brand-primary)]/20 bg-neutral-50/50"
            : "border-neutral-200 bg-neutral-50/80"
        )}
        style={
          brandPrimary
            ? {
                borderColor: brandColourTint(brandPrimary),
                backgroundColor: `${brandColourTint(brandPrimary, "0d")}`,
              }
            : undefined
        }
      >
        <p className="mb-2 text-xs text-neutral-500 print:mb-1.5 print:text-[9pt]">
          {gstTreatmentNote}
        </p>
        <div className="ml-auto max-w-[240px] space-y-1 text-sm print:max-w-[220px] print:text-[10pt]">
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">Subtotal</span>
            <span className="tabular-nums text-neutral-900">
              {formatPricingMoney(quote.subtotal)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">GST ({quote.gst_rate}%)</span>
            <span className="tabular-nums text-neutral-900">
              {formatPricingMoney(quote.gst_amount)}
            </span>
          </div>
          <div
            className="flex justify-between gap-4 border-t pt-1.5 text-sm font-semibold text-neutral-900 print:text-[11pt]"
            style={
              brandPrimary
                ? { borderColor: brandColourTint(brandPrimary) }
                : undefined
            }
          >
            <span>Total incl. GST</span>
            <span className="tabular-nums">
              {formatPricingMoney(quote.total_incl_gst)}
            </span>
          </div>
        </div>
      </section>

      <div className="quote-template-terms mt-6 space-y-4 break-words border-t border-neutral-200 pt-5 print:mt-0 print:break-before-page print:pt-4 print:text-[10pt]">
          <h3
            className="text-sm font-semibold text-neutral-900 print:text-[12pt]"
            style={brandAccent ? { color: brandAccent } : undefined}
          >
            Quote terms, assumptions and exclusions
          </h3>

          {quote.valid_until ? (
            <TextBlockSection
              title="Validity"
              content={`This quote is valid until ${formatPricingDate(quote.valid_until)}.`}
              accentColour={brandAccent}
            />
          ) : null}

          <TextListSection
            title="Assumptions"
            items={quote.assumptions}
            accentColour={brandAccent}
          />
          <TextListSection
            title="Exclusions"
            items={quote.exclusions}
            accentColour={brandAccent}
          />
          {paymentTerms ? (
            <TextBlockSection
              title="Payment terms"
              content={paymentTerms}
              accentColour={brandAccent}
            />
          ) : null}
          <TextBlockSection
            title="Terms"
            content={quote.terms}
            accentColour={brandAccent}
          />
          <TextBlockSection
            title="Variations"
            content={DEFAULT_VARIATION_WORDING}
            accentColour={brandAccent}
          />
          <TextBlockSection
            title="Notes to client"
            content={quote.notes_to_client}
            accentColour={brandAccent}
          />
      </div>
    </article>
  );
}
