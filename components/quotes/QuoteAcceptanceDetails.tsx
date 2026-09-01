"use client";

import { formatPricingMoney } from "@/lib/pricing/format";
import {
  formatQuoteDateTime,
  formatQuoteNumberRevision,
} from "@/lib/quotes/display";
import { formatAcceptanceSourceLabel } from "@/lib/quotes/acceptance";
import { isValidDrawnSignatureSvg } from "@/lib/quotes/acceptance";
import type { QuoteAcceptanceRecord } from "@/lib/quotes/acceptance-types";
import type { Quote } from "@/lib/quotes/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function QuoteAcceptanceDetails({
  quote,
  acceptance,
}: {
  quote: Quote;
  acceptance: QuoteAcceptanceRecord | null;
}) {
  if (!acceptance || quote.status !== "accepted") return null;

  return (
    <div
      data-quote-acceptance-details="true"
      className="rounded-lg border border-border/60 bg-card px-3 py-2.5 print:hidden"
    >
      <p className="text-xs font-medium text-muted-foreground">Acceptance</p>
      <p className="mt-1 text-sm font-medium">
        {formatAcceptanceSourceLabel(acceptance.source)}
      </p>
      {acceptance.source === "client" && acceptance.signer_name ? (
        <p className="text-sm text-muted-foreground">
          Accepted by {acceptance.signer_name}
          {formatQuoteDateTime(acceptance.accepted_at)
            ? ` · ${formatQuoteDateTime(acceptance.accepted_at)}`
            : ""}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {formatQuoteDateTime(acceptance.accepted_at) ?? "Recorded"}
        </p>
      )}
      <Sheet>
        <SheetTrigger className="mt-2 h-8 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          Acceptance details
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Acceptance details</SheetTitle>
            <SheetDescription>
              Immutable evidence for {formatQuoteNumberRevision(quote)}.
            </SheetDescription>
          </SheetHeader>
          <dl className="space-y-2 px-6 pb-6 text-sm">
            <div>
              <dt className="text-muted-foreground">Source</dt>
              <dd>{formatAcceptanceSourceLabel(acceptance.source)}</dd>
            </div>
            {acceptance.signer_name ? (
              <div>
                <dt className="text-muted-foreground">Signer</dt>
                <dd>{acceptance.signer_name}</dd>
              </div>
            ) : null}
            {acceptance.signer_email ? (
              <div>
                <dt className="text-muted-foreground">Signer email</dt>
                <dd>{acceptance.signer_email}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Accepted</dt>
              <dd>{formatQuoteDateTime(acceptance.accepted_at) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quote / revision</dt>
              <dd>{formatQuoteNumberRevision(quote)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Accepted total incl GST</dt>
              <dd className="tabular-nums">
                {formatPricingMoney(acceptance.accepted_total_incl_gst)}
              </dd>
            </div>
            {acceptance.snapshot_fingerprint ? (
              <div>
                <dt className="text-muted-foreground">Fingerprint</dt>
                <dd className="break-all font-mono text-xs">
                  {acceptance.snapshot_fingerprint}
                </dd>
              </div>
            ) : null}
            {acceptance.acceptance_declaration ? (
              <div>
                <dt className="text-muted-foreground">Declaration</dt>
                <dd className="leading-relaxed">
                  {acceptance.acceptance_declaration}
                </dd>
              </div>
            ) : null}
            {acceptance.signature_method === "typed" && acceptance.signer_name ? (
              <div>
                <dt className="text-muted-foreground">Signature</dt>
                <dd className="font-serif text-xl italic">{acceptance.signer_name}</dd>
              </div>
            ) : null}
            {acceptance.signature_method === "drawn" &&
            acceptance.signature_value &&
            isValidDrawnSignatureSvg(acceptance.signature_value) ? (
              <div>
                <dt className="text-muted-foreground">Signature</dt>
                <dd
                  className="max-w-xs"
                  dangerouslySetInnerHTML={{ __html: acceptance.signature_value }}
                />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Technical network evidence is stored privately and is not shown here.
            </p>
          </dl>
        </SheetContent>
      </Sheet>
    </div>
  );
}
