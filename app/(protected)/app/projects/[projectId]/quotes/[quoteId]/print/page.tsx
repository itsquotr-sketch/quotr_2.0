import type { Metadata } from "next";
import { QuoteAutoPrint } from "@/components/quotes/QuoteAutoPrint";
import { QuoteTemplate } from "@/components/quotes/QuoteTemplate";
import { formatQuoteReference } from "@/lib/quotes/display";
import { getQuotePrintData } from "@/lib/quotes/actions";
import { connection } from "next/server";

type QuotePrintPageProps = {
  params: Promise<{ projectId: string; quoteId: string }>;
};

export async function generateMetadata({
  params,
}: QuotePrintPageProps): Promise<Metadata> {
  const { projectId, quoteId } = await params;
  const data = await getQuotePrintData(projectId, quoteId);
  const reference = formatQuoteReference(data.quote);

  return {
    title: `Quote ${reference}`,
  };
}

export default async function QuotePrintPage({ params }: QuotePrintPageProps) {
  await connection();
  const { projectId, quoteId } = await params;
  const data = await getQuotePrintData(projectId, quoteId);

  return (
    <div className="quote-print-page min-h-svh bg-neutral-100 px-4 py-6 print:bg-white print:px-0 print:py-0">
      <QuoteAutoPrint />
      <QuoteTemplate
        quote={data.quote}
        quoteItems={data.items}
        companySettings={data.companySettings}
      />
    </div>
  );
}
