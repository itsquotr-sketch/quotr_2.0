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
  assumptionText?: string;
  exclusionText?: string;
  termsText?: string;
  notesText?: string;
  onAssumptionTextChange?: (value: string) => void;
  onExclusionTextChange?: (value: string) => void;
  onTermsTextChange?: (value: string) => void;
  onNotesTextChange?: (value: string) => void;
};

export function QuoteTermsCard({
  assumptions,
  exclusions,
  inclusions,
  terms,
  notesToClient,
  onChange,
  bare = false,
  assumptionText,
  exclusionText,
  termsText,
  notesText,
  onAssumptionTextChange,
  onExclusionTextChange,
  onTermsTextChange,
  onNotesTextChange,
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
          Client assumptions
        </Label>
        <p className="text-xs text-muted-foreground">
          One item per line. Optional. Internal estimate language is hidden from
          the client preview automatically.
        </p>
        <Textarea
          id="quote-assumptions"
          className="text-base md:text-sm"
          rows={4}
          {...(assumptionText !== undefined
            ? { value: assumptionText }
            : { defaultValue: arrayToTextList(assumptions) })}
          onChange={(event) => {
            onAssumptionTextChange?.(event.target.value);
            onChange({ assumptions: textListToArray(event.target.value) });
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quote-exclusions" className="text-xs">
          Exclusions
        </Label>
        <p className="text-xs text-muted-foreground">
          One item per line. Optional.
        </p>
        <Textarea
          id="quote-exclusions"
          className="text-base md:text-sm"
          rows={4}
          {...(exclusionText !== undefined
            ? { value: exclusionText }
            : { defaultValue: arrayToTextList(exclusions) })}
          onChange={(event) => {
            onExclusionTextChange?.(event.target.value);
            onChange({ exclusions: textListToArray(event.target.value) });
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quote-terms" className="text-xs">
          Quote terms
        </Label>
        <p className="text-xs text-muted-foreground">
          Optional. This does not add legal wording for you.
        </p>
        <Textarea
          id="quote-terms"
          className="text-base md:text-sm"
          rows={5}
          {...(termsText !== undefined
            ? { value: termsText }
            : { defaultValue: terms ?? "" })}
          onChange={(event) => {
            onTermsTextChange?.(event.target.value);
            onChange({ terms: event.target.value || null });
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quote-notes" className="text-xs">
          Notes to client
        </Label>
        <Textarea
          id="quote-notes"
          className="text-base md:text-sm"
          rows={4}
          {...(notesText !== undefined
            ? { value: notesText }
            : { defaultValue: notesToClient ?? "" })}
          onChange={(event) => {
            onNotesTextChange?.(event.target.value);
            onChange({ notes_to_client: event.target.value || null });
          }}
        />
      </div>
    </div>
  );

  if (bare) {
    return <div className={cn("px-3 py-3")}>{fields}</div>;
  }

  return (
    <Card className="rounded-xl border-border/60 shadow-none ring-0">
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
