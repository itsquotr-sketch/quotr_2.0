import { connection } from "next/server";
import { notFound } from "next/navigation";
import { VariationPrintButton } from "@/components/variations/VariationPrintButton";
import { VariationResponseReceiptView } from "@/components/variations/VariationResponseReceipt";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { loadInternalVariationResponseRecord } from "@/lib/variations/response-receipt-load";

export const runtime = "nodejs";

type PageProps = { params: Promise<{ projectId: string; variationId: string }> };

export default async function VariationResponseRecordPage({ params }: PageProps) {
  await connection();
  const auth = await requireAuthOrgContext();
  if (!auth.ok) notFound();
  const { projectId, variationId } = await params;
  const loaded = await loadInternalVariationResponseRecord(projectId, variationId);
  if (!loaded.ok) notFound();
  return (
    <main className="min-h-dvh bg-neutral-100 print:bg-white">
    <div className="mx-auto w-full min-w-0 max-w-[960px] overflow-x-hidden px-3 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6 print:bg-white print:p-0">
      <VariationPrintButton />
      <VariationResponseReceiptView receipt={loaded.receipt} backHref={loaded.backHref} />
      {loaded.manual ? (
        <aside className="mx-auto mt-4 max-w-[960px] rounded-xl border bg-white p-4 text-sm print:hidden" data-variation-manual-evidence="true">
          <h2 className="font-semibold">Internal evidence</h2>
          <dl className="mt-2 space-y-1">
            <div className="flex flex-wrap justify-between gap-3"><dt>Evidence type</dt><dd>{loaded.manual.evidenceTypeLabel}</dd></div>
            <div className="flex flex-wrap justify-between gap-3"><dt>Evidence note</dt><dd className="min-w-0 break-words">{loaded.manual.evidenceNote}</dd></div>
            <div className="flex flex-wrap justify-between gap-3"><dt>Recorded by</dt><dd className="break-words">{loaded.manual.recordedByName}</dd></div>
            <div className="flex flex-wrap justify-between gap-3"><dt>Recorded time</dt><dd>{loaded.manual.recordedAtLabel}</dd></div>
            {loaded.recordedDeclineReason ? <div className="flex flex-wrap justify-between gap-3"><dt>Decline reason</dt><dd className="min-w-0 break-words">{loaded.recordedDeclineReason}</dd></div> : null}
          </dl>
        </aside>
      ) : null}
    </div>
    </main>
  );
}
