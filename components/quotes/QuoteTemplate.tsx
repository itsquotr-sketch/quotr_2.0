import type { CSSProperties } from "react";
import { formatPricingDate, formatPricingMoney } from "@/lib/pricing/format";
import {
  formatCompanyAddress,
  formatQuoteDocumentTitle,
  getCompanyDisplayName,
} from "@/lib/quotes/display";
import {
  groupQuoteItemsBySection,
  type QuoteItemSection,
} from "@/lib/quotes/mappers";
import type { Quote, QuoteItem } from "@/lib/quotes/types";
import type { CompanySettings } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

export type QuoteTemplateProps = {
  quote: Quote;
  quoteItems: QuoteItem[];
  companySettings: CompanySettings | null;
  sections?: QuoteItemSection[];
};

function QuoteLineItemRow({ item }: { item: QuoteItem }) {
  return (
    <>
      <tr
        className={cn(
          "hidden border-b border-border/40 sm:table-row last:border-0",
          item.optional && "text-muted-foreground"
        )}
      >
        <td className="py-2.5 pr-4 align-top">
          <p className="font-medium text-foreground">
            {item.label}
            {item.optional ? (
              <span className="ml-1 text-xs font-normal">(optional)</span>
            ) : null}
          </p>
          {item.description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </td>
        <td className="py-2.5 pr-4 text-right align-top whitespace-nowrap tabular-nums">
          {item.quantity != null ? item.quantity : "—"}
        </td>
        <td className="py-2.5 pr-4 text-right align-top whitespace-nowrap text-muted-foreground">
          {item.unit ?? "—"}
        </td>
        <td className="py-2.5 pr-4 text-right align-top whitespace-nowrap tabular-nums">
          {item.unit_price != null ? formatPricingMoney(item.unit_price) : "—"}
        </td>
        <td className="py-2.5 text-right align-top font-medium whitespace-nowrap tabular-nums">
          {formatPricingMoney(item.total)}
        </td>
      </tr>

      <tr className="sm:hidden">
        <td colSpan={5} className="border-b border-border/40 py-3 last:border-0">
          <div
            className={cn(
              "space-y-1.5",
              item.optional && "text-muted-foreground"
            )}
          >
            <p className="font-medium text-foreground">
              {item.label}
              {item.optional ? (
                <span className="ml-1 text-xs font-normal">(optional)</span>
              ) : null}
            </p>
            {item.description ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Qty: {item.quantity != null ? item.quantity : "—"}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
              <span>
                Unit price:{" "}
                {item.unit_price != null
                  ? formatPricingMoney(item.unit_price)
                  : "—"}
              </span>
            </div>
            <p className="text-sm font-medium tabular-nums">
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
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="quote-template-section break-inside-avoid">
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function TextBlockSection({
  title,
  content,
}: {
  title: string;
  content: string | null;
}) {
  if (!content?.trim()) return null;

  return (
    <section className="quote-template-section break-inside-avoid">
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
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

  const brandPrimary = companySettings?.brandPrimaryColour?.trim() || null;
  const brandAccent = companySettings?.brandAccentColour?.trim() || null;

  const sections = (sectionsProp ?? groupQuoteItemsBySection(quoteItems))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.visible),
    }))
    .filter((section) => section.items.length > 0);

  const contactLines = [
    companySettings?.contactEmail,
    companySettings?.contactPhone,
    companySettings?.website,
  ].filter((line): line is string => Boolean(line?.trim()));

  const footerLines = [
    companyAddress,
    companySettings?.gstNumber
      ? `GST: ${companySettings.gstNumber}`
      : null,
    companySettings?.nzbn ? `NZBN: ${companySettings.nzbn}` : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <article
      id="quote-template"
      className={cn(
        "quote-template mx-auto w-full max-w-[210mm] rounded-xl border border-border/60 bg-white p-6 shadow-sm sm:p-8",
        "print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      )}
      style={
        brandPrimary
          ? ({ "--quote-brand-primary": brandPrimary } as CSSProperties)
          : undefined
      }
    >
      <header
        className={cn(
          "quote-template-header mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between",
          brandPrimary && "border-[var(--quote-brand-primary)]"
        )}
      >
        <div className="min-w-0">
          {companySettings?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={companySettings.logoUrl}
              alt={companyName || "Company logo"}
              className="mb-3 max-h-14 w-auto max-w-[200px] object-contain object-left"
            />
          ) : companyName ? (
            <p
              className="mb-1 text-lg font-semibold tracking-tight"
              style={brandPrimary ? { color: brandPrimary } : undefined}
            >
              {companyName}
            </p>
          ) : null}
        </div>

        {contactLines.length > 0 || footerLines.length > 0 ? (
          <div className="text-sm leading-relaxed text-muted-foreground sm:text-right">
            {contactLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {companyAddress ? (
              <p className="mt-1 hidden sm:block">{companyAddress}</p>
            ) : null}
          </div>
        ) : null}
      </header>

      <section className="quote-template-section mb-8 break-inside-avoid">
        <h2
          className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
          style={brandAccent ? { color: brandAccent } : undefined}
        >
          {formatQuoteDocumentTitle(quote)}
        </h2>
        {quote.revision_number > 1 ? (
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Revision {quote.revision_number}
          </p>
        ) : null}

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {quote.client_name ? (
            <div>
              <dt className="text-muted-foreground">Client</dt>
              <dd className="font-medium">{quote.client_name}</dd>
            </div>
          ) : null}
          {quote.site_address ? (
            <div>
              <dt className="text-muted-foreground">Site</dt>
              <dd className="font-medium">{quote.site_address}</dd>
            </div>
          ) : null}
          {quote.issue_date ? (
            <div>
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{formatPricingDate(quote.issue_date)}</dd>
            </div>
          ) : null}
          {quote.valid_until ? (
            <div>
              <dt className="text-muted-foreground">Valid until</dt>
              <dd>{formatPricingDate(quote.valid_until)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {quote.scope_summary?.trim() ? (
        <section className="quote-template-section mb-8 break-inside-avoid">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Scope summary
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {quote.scope_summary}
          </p>
        </section>
      ) : null}

      {quote.inclusions.length > 0 ? (
        <div className="mb-8">
          <TextListSection title="Inclusions" items={quote.inclusions} />
        </div>
      ) : null}

      <div className="quote-template-sections mb-8 space-y-8">
        {sections.map((section) => (
          <section
            key={section.sectionTitle ?? "general"}
            className="quote-template-section break-inside-avoid"
          >
            {section.sectionTitle ? (
              <h3
                className="mb-2 text-base font-semibold text-foreground"
                style={brandAccent ? { color: brandAccent } : undefined}
              >
                {section.sectionTitle}
              </h3>
            ) : null}
            {section.sectionDescription ? (
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {section.sectionDescription}
              </p>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="hidden sm:table-header-group">
                  <tr
                    className="border-b text-left text-xs text-muted-foreground"
                    style={
                      brandPrimary
                        ? { borderColor: `${brandPrimary}40` }
                        : undefined
                    }
                  >
                    <th className="pb-2 pr-4 font-medium">Item</th>
                    <th className="pb-2 pr-4 text-right font-medium">Qty</th>
                    <th className="pb-2 pr-4 text-right font-medium">Unit</th>
                    <th className="pb-2 pr-4 text-right font-medium">
                      Unit price
                    </th>
                    <th className="pb-2 text-right font-medium">Total</th>
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
        ))}
      </div>

      <div className="quote-template-terms mb-8 space-y-6">
        <TextListSection title="Assumptions" items={quote.assumptions} />
        <TextListSection title="Exclusions" items={quote.exclusions} />
        <TextBlockSection title="Terms" content={quote.terms} />
        <TextBlockSection
          title="Notes to client"
          content={quote.notes_to_client}
        />
      </div>

      <section className="quote-template-totals break-inside-avoid border-t pt-6">
        <div className="ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">
              {formatPricingMoney(quote.subtotal)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">
              GST ({quote.gst_rate}%)
            </span>
            <span className="tabular-nums">
              {formatPricingMoney(quote.gst_amount)}
            </span>
          </div>
          <div
            className="flex justify-between gap-4 border-t pt-2 text-base font-semibold"
            style={brandPrimary ? { borderColor: `${brandPrimary}40` } : undefined}
          >
            <span>Total incl. GST</span>
            <span className="tabular-nums">
              {formatPricingMoney(quote.total_incl_gst)}
            </span>
          </div>
        </div>
      </section>

      {footerLines.length > 0 ? (
        <footer className="quote-template-footer mt-8 break-inside-avoid border-t pt-6 text-xs leading-relaxed text-muted-foreground sm:hidden">
          {footerLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </footer>
      ) : null}

      {companySettings?.gstNumber || companySettings?.nzbn ? (
        <footer className="quote-template-footer mt-8 hidden break-inside-avoid border-t pt-6 text-xs leading-relaxed text-muted-foreground sm:block">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {companySettings.gstNumber ? (
              <span>GST: {companySettings.gstNumber}</span>
            ) : null}
            {companySettings.nzbn ? (
              <span>NZBN: {companySettings.nzbn}</span>
            ) : null}
          </div>
        </footer>
      ) : null}
    </article>
  );
}
