import type { Metadata } from "next";
import { connection } from "next/server";
import { VariationPrintButton } from "@/components/variations/VariationPrintButton";
import { VariationResponseReceiptView } from "@/components/variations/VariationResponseReceipt";
import { loadPublicVariationResponseReceipt } from "@/lib/variations/response-receipt-load";

export const runtime = "nodejs";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Variation response", robots: { index: false, follow: false } };
}

export default async function PublicVariationResponsePage({ params }: PageProps) {
  await connection();
  const { token } = await params;
  const loaded = await loadPublicVariationResponseReceipt(token);
  if (loaded.state === "withdrawn") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-sm">
        <p>This Variation has been withdrawn.</p>
      </main>
    );
  }
  if (loaded.state !== "receipt") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-sm">
        <p>This Variation response is unavailable.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto w-full min-w-0 max-w-[960px] overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 print:bg-white print:p-0">
      <VariationPrintButton />
      <VariationResponseReceiptView receipt={loaded.receipt} />
    </main>
  );
}
