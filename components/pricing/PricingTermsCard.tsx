"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { arrayToTextList, textListToArray } from "@/lib/pricing/calculations";
import type { PricingDocumentInput } from "@/lib/pricing/types";

type PricingTermsCardProps = {
  assumptions: string[];
  exclusions: string[];
  terms: string | null;
  internalNotes: string | null;
  onChange: (updates: PricingDocumentInput) => void;
};

export function PricingTermsCard({
  assumptions,
  exclusions,
  terms,
  internalNotes,
  onChange,
}: PricingTermsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Terms, assumptions & notes</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="pricing-assumptions">Assumptions (one per line)</Label>
          <Textarea
            id="pricing-assumptions"
            rows={4}
            defaultValue={arrayToTextList(assumptions)}
            onChange={(event) =>
              onChange({ assumptions: textListToArray(event.target.value) })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pricing-exclusions">Exclusions (one per line)</Label>
          <Textarea
            id="pricing-exclusions"
            rows={4}
            defaultValue={arrayToTextList(exclusions)}
            onChange={(event) =>
              onChange({ exclusions: textListToArray(event.target.value) })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pricing-terms">Terms</Label>
          <Textarea
            id="pricing-terms"
            rows={5}
            defaultValue={terms ?? ""}
            onChange={(event) =>
              onChange({ terms: event.target.value || null })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pricing-internal-notes">Internal notes</Label>
          <Textarea
            id="pricing-internal-notes"
            rows={3}
            defaultValue={internalNotes ?? ""}
            onChange={(event) =>
              onChange({ internal_notes: event.target.value || null })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
