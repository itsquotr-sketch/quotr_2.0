"use client";

import {
  Card,
  CardContent,
  CardDescription,
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
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Terms, assumptions & notes</CardTitle>
        <CardDescription className="text-xs">
          Internal pricing notes for now. Future quote builder will use
          client-facing versions of these fields.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pricing-assumptions" className="text-xs">
            Assumptions (one per line)
          </Label>
          <Textarea
            id="pricing-assumptions"
            rows={3}
            defaultValue={arrayToTextList(assumptions)}
            onChange={(event) =>
              onChange({ assumptions: textListToArray(event.target.value) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricing-exclusions" className="text-xs">
            Exclusions (one per line)
          </Label>
          <Textarea
            id="pricing-exclusions"
            rows={3}
            defaultValue={arrayToTextList(exclusions)}
            onChange={(event) =>
              onChange({ exclusions: textListToArray(event.target.value) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricing-terms" className="text-xs">Terms</Label>
          <Textarea
            id="pricing-terms"
            rows={4}
            defaultValue={terms ?? ""}
            onChange={(event) =>
              onChange({ terms: event.target.value || null })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricing-internal-notes" className="text-xs">
            Internal notes
          </Label>
          <Textarea
            id="pricing-internal-notes"
            rows={2}
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
