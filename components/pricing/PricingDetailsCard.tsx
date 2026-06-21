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
import { formatPricingDate } from "@/lib/pricing/format";
import type { PricingDocumentInput } from "@/lib/pricing/types";

type PricingDetailsCardProps = {
  title: string;
  clientName: string | null;
  siteAddress: string | null;
  pricingDate: string | null;
  validUntil: string | null;
  scopeSummary: string | null;
  onChange: (updates: PricingDocumentInput) => void;
};

export function PricingDetailsCard({
  title,
  clientName,
  siteAddress,
  pricingDate,
  validUntil,
  scopeSummary,
  onChange,
}: PricingDetailsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pricing details</CardTitle>
        <CardDescription>
          Internal pricing document — not yet a client quote.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pricing-title">Title</Label>
          <Input
            id="pricing-title"
            defaultValue={title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Client</p>
          <p className="text-sm">{clientName || "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Site address</p>
          <p className="text-sm">{siteAddress || "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Pricing date</p>
          <p className="text-sm">{formatPricingDate(pricingDate)}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pricing-valid-until">Valid until</Label>
          <Input
            id="pricing-valid-until"
            type="date"
            defaultValue={validUntil ?? ""}
            onChange={(event) =>
              onChange({ valid_until: event.target.value || null })
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pricing-scope-summary">Scope summary</Label>
          <Textarea
            id="pricing-scope-summary"
            rows={3}
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
