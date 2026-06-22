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
import type { QuoteInput } from "@/lib/quotes/types";

type QuoteTermsCardProps = {
  assumptions: string[];
  exclusions: string[];
  inclusions: string[];
  terms: string | null;
  notesToClient: string | null;
  onChange: (updates: QuoteInput) => void;
};

export function QuoteTermsCard({
  assumptions,
  exclusions,
  inclusions,
  terms,
  notesToClient,
  onChange,
}: QuoteTermsCardProps) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Terms & client notes</CardTitle>
        <CardDescription className="text-xs">
          Client-facing assumptions, exclusions and terms
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {inclusions.length > 0 ? (
          <div className="space-y-1">
            <Label className="text-xs">Inclusions</Label>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {inclusions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="quote-assumptions" className="text-xs">
            Assumptions (one per line)
          </Label>
          <Textarea
            id="quote-assumptions"
            rows={3}
            defaultValue={arrayToTextList(assumptions)}
            onChange={(event) =>
              onChange({ assumptions: textListToArray(event.target.value) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-exclusions" className="text-xs">
            Exclusions (one per line)
          </Label>
          <Textarea
            id="quote-exclusions"
            rows={3}
            defaultValue={arrayToTextList(exclusions)}
            onChange={(event) =>
              onChange({ exclusions: textListToArray(event.target.value) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-terms" className="text-xs">
            Terms
          </Label>
          <Textarea
            id="quote-terms"
            rows={4}
            defaultValue={terms ?? ""}
            onChange={(event) =>
              onChange({ terms: event.target.value || null })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-notes" className="text-xs">
            Notes to client
          </Label>
          <Textarea
            id="quote-notes"
            rows={3}
            defaultValue={notesToClient ?? ""}
            onChange={(event) =>
              onChange({ notes_to_client: event.target.value || null })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
