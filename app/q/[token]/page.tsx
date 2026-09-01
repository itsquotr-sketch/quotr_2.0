import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuotePublicDocument } from "@/components/quotes/QuotePublicDocument";
import { lookupPublicQuoteByToken } from "@/lib/quotes/public-lookup";
import { formatQuoteReference } from "@/lib/quotes/display";
import { connection } from "next/server";

type PublicQuotePageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({
  params,
}: PublicQuotePageProps): Promise<Metadata> {
  const { token } = await params;
  const document = await lookupPublicQuoteByToken(token);
  if (!document) {
    return { title: "Quote", robots: { index: false, follow: false } };
  }
  return {
    title: `Quote ${formatQuoteReference(document.quote)}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicQuotePage({ params }: PublicQuotePageProps) {
  await connection();
  const { token } = await params;
  const document = await lookupPublicQuoteByToken(token);
  if (!document) {
    notFound();
  }

  return (
    <QuotePublicDocument
      quote={document.quote}
      items={document.items}
      superseded={document.superseded}
      token={token}
      recipient={document.recipient}
      acceptance={document.acceptance}
    />
  );
}
