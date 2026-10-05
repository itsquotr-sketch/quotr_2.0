"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PricingReadOnlyValue } from "@/components/pricing/PricingReadOnlyValue";
import { formatPricingDate } from "@/lib/pricing/format";
import type { PricingDocumentInput } from "@/lib/pricing/types";

type PricingDetailsCardProps = {
  title: string;
  clientName: string | null;
  siteAddress: string | null;
  pricingDate: string | null;
  validUntil: string | null;
  scopeSummary: string | null;
  readOnly?: boolean;
  onChange: (updates: PricingDocumentInput) => void;
};

/**
 * Client/site inputs are controlled from parent document state.
 * PricingWorkspace keeps draft overlays so unsaved local edits are not
 * silently overwritten by refreshed project props.
 */
export function PricingDetailsCard({
  title,
  clientName,
  siteAddress,
  pricingDate,
  validUntil,
  scopeSummary,
  readOnly = false,
  onChange,
}: PricingDetailsCardProps) {
  if (readOnly) {
    return (
      <Card className="border-0 bg-transparent p-0 shadow-none ring-0 rounded-none [--card-spacing:0]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pricing details</CardTitle>
          <CardDescription className="text-xs">
            Client and site details update the project record. Draft pricing keeps
            a matching snapshot; issued quotes retain their own snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PricingReadOnlyValue label="Title" value={title} />
          </div>
          <PricingReadOnlyValue label="Client" value={clientName} />
          <PricingReadOnlyValue label="Site address" value={siteAddress} />
          <PricingReadOnlyValue label="Pricing date" value={formatPricingDate(pricingDate)} />
          <PricingReadOnlyValue label="Valid until" value={formatPricingDate(validUntil)} />
          <div className="sm:col-span-2">
            <PricingReadOnlyValue label="Scope summary" value={scopeSummary} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-transparent p-0 shadow-none ring-0 rounded-none [--card-spacing:0]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pricing details</CardTitle>
        <CardDescription className="text-xs">
          Client and site details update the project record. Draft pricing keeps
          a matching snapshot; issued quotes retain their own snapshot.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pricing-title" className="text-xs">Title</Label>
          <Input
            id="pricing-title"
            className="h-11 md:h-8"
            defaultValue={title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricing-client-name" className="text-xs">
            Client
          </Label>
          <Input
            id="pricing-client-name"
            className="h-11 md:h-8"
            value={clientName ?? ""}
            placeholder="Client name"
            onChange={(event) =>
              onChange({ client_name: event.target.value || null })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricing-site-address" className="text-xs">
            Site address
          </Label>
          <Input
            id="pricing-site-address"
            className="h-11 md:h-8"
            value={siteAddress ?? ""}
            placeholder="Site address"
            onChange={(event) =>
              onChange({ site_address: event.target.value || null })
            }
          />
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Pricing date</p>
          <p className="text-sm">{formatPricingDate(pricingDate)}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricing-valid-until" className="text-xs">
            Valid until
          </Label>
          <Input
            id="pricing-valid-until"
            type="date"
            className="h-11 md:h-8"
            defaultValue={validUntil ?? ""}
            onChange={(event) =>
              onChange({ valid_until: event.target.value || null })
            }
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pricing-scope-summary" className="text-xs">
            Scope summary
          </Label>
          <Textarea
            id="pricing-scope-summary"
            rows={2}
            defaultValue={scopeSummary ?? ""}
            onChange={(event) =>
              onChange({ scope_summary: event.target.value || null })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
