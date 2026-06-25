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
import { cn } from "@/lib/utils";

type QuoteTermsCardProps = {
  assumptions: string[];
  exclusions: string[];
  inclusions: string[];
  terms: string | null;
  notesToClient: string | null;
  onChange: (updates: QuoteInput) => void;
  bare?: boolean;
};

export function QuoteTermsCard({
  assumptions,
  exclusions,
  inclusions,
  terms,
  notesToClient,
  onChange,
  bare = false,
}: QuoteTermsCardProps) {
  const fields = (
    <div className="grid gap-4">
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
          Assumptions
        </Label>
        <p className="text-[11px] text-muted-foreground">One item per line</p>
        <Textarea
          id="quote-assumptions"
          rows={4}
          defaultValue={arrayToTextList(assumptions)}
          onChange={(event) =>
            onChange({ assumptions: textListToArray(event.target.value) })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quote-exclusions" className="text-xs">
          Exclusions
        </Label>
        <p className="text-[11px] text-muted-foreground">One item per line</p>
        <Textarea
          id="quote-exclusions"
          rows={4}
          defaultValue={arrayToTextList(exclusions)}
          onChange={(event) =>
            onChange({ exclusions: textListToArray(event.target.value) })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quote-terms" className="text-xs">
          Quote terms
        </Label>
        <Textarea
          id="quote-terms"
          rows={5}
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
          rows={4}
          defaultValue={notesToClient ?? ""}
          onChange={(event) =>
            onChange({ notes_to_client: event.target.value || null })
          }
        />
      </div>
    </div>
  );

  if (bare) {
    return <div className={cn("px-3 py-3")}>{fields}</div>;
  }

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Terms & client notes</CardTitle>
        <CardDescription className="text-xs">
          Client-facing assumptions, exclusions and terms
        </CardDescription>
      </CardHeader>
      <CardContent>{fields}</CardContent>
    </Card>
  );
}
