import { QuotePublicViewBeacon } from "@/components/quotes/QuotePublicViewBeacon";
import { QuotePublicShell } from "@/components/quotes/QuotePublicShell";
import { QuotePublicActions } from "@/components/quotes/QuotePublicActions";
import { QuoteTemplate } from "@/components/quotes/QuoteTemplate";
import type { Quote, QuoteItem } from "@/lib/quotes/types";
import type {
  PublicQuoteAcceptanceSummary,
  PublicQuoteRecipientSeed,
} from "@/lib/quotes/acceptance-types";
import type { QuoteAcceptanceRecord } from "@/lib/quotes/acceptance-types";

export function QuotePublicDocument({
  quote,
  items,
  superseded,
  token,
  recipient,
  acceptance,
}: {
  quote: Quote;
  items: QuoteItem[];
  superseded: boolean;
  token: string;
  recipient?: PublicQuoteRecipientSeed | null;
  acceptance?: PublicQuoteAcceptanceSummary | null;
}) {
  const templateAcceptance: QuoteAcceptanceRecord | null =
    quote.status === "accepted" && acceptance
      ? {
          id: "public",
          org_id: "",
          project_id: "",
          quote_id: quote.id,
          quote_number: acceptance.quote_number,
          revision_number: acceptance.revision_number,
          snapshot_fingerprint: null,
          snapshot_fingerprint_version: null,
          source: acceptance.source,
          signer_name: acceptance.signer_name,
          signer_email: null,
          acceptance_declaration: acceptance.acceptance_declaration,
          declaration_version: null,
          signature_method: acceptance.signature_method,
          signature_value: acceptance.signature_value,
          accepted_total_incl_gst:
            acceptance.accepted_total_incl_gst ?? quote.total_incl_gst,
          accepted_at: acceptance.accepted_at,
          ip_address: null,
          user_agent: null,
          access_token_id: null,
          delivery_id: null,
          actor_user_id: null,
          evidence_version: "v1",
          created_at: acceptance.accepted_at,
        }
      : null;

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-4 px-3 py-4 pb-28 sm:px-4 sm:py-6 sm:pb-6">
      <QuotePublicShell
        quote={quote}
        superseded={superseded}
        acceptance={acceptance}
        actions={
          <QuotePublicActions
            quote={quote}
            token={token}
            seedName={recipient?.name || quote.client_name || ""}
            seedEmail={recipient?.email || ""}
            superseded={superseded}
          />
        }
      />
      <QuoteTemplate
        quote={quote}
        quoteItems={items}
        companySettings={null}
        acceptance={templateAcceptance}
      />
      <QuotePublicViewBeacon token={token} />
    </div>
  );
}
