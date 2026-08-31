"use client";

import { useMemo } from "react";
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
import { partitionClientNarrative } from "@/lib/quotes/client-narrative";

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
  const { client: clientAssumptions, internal: internalAssumptions } = useMemo(
    () => partitionClientNarrative(assumptions),
    [assumptions]
  );

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Terms, assumptions & notes</CardTitle>
        <CardDescription className="text-xs">
          Client assumptions, exclusions and terms appear on the quote.
          Internal notes stay on pricing only.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {internalAssumptions.length > 0 ? (
          <details className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium">
              Internal estimate notes ({internalAssumptions.length}) — not shown
              on quote
            </summary>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {internalAssumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="pricing-assumptions" className="text-xs">
            Client assumptions (one per line)
          </Label>
          <Textarea
            id="pricing-assumptions"
            rows={3}
            defaultValue={arrayToTextList(clientAssumptions)}
            onChange={(event) =>
              onChange({ assumptions: textListToArray(event.target.value) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricing-exclusions" className="text-xs">
            Client exclusions (one per line)
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
          <Label htmlFor="pricing-terms" className="text-xs">
            Client terms
          </Label>
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
