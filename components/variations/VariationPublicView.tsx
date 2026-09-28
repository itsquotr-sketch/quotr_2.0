import { VariationDocument } from "@/components/variations/VariationDocument";
import type { VariationPublicView as PublicView } from "@/lib/variations/public-lookup";

export function VariationPublicView({ view }: { view: PublicView }) {
  if (view.state === "withdrawn") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-sm print:bg-white">
        <p>This Variation has been withdrawn. Contact the builder if you received this link in error.</p>
      </main>
    );
  }
  if (view.state === "unavailable") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-sm print:bg-white">
        <p>This Variation is unavailable.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-[960px] px-3 py-4 sm:px-4 sm:py-6 print:bg-white print:p-0">
      <VariationDocument model={view.document} />
    </main>
  );
}
