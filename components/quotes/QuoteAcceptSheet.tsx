"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QuoteSignaturePad } from "@/components/quotes/QuoteSignaturePad";
import {
  buildQuoteAcceptanceDeclarationFromQuote,
} from "@/lib/quotes/acceptance";
import { acceptPublicQuoteByToken } from "@/lib/quotes/acceptance-actions";
import { formatQuoteNumberRevision, getCompanyDisplayName } from "@/lib/quotes/display";
import { quoteDocumentViewModel } from "@/lib/quotes/financial-view-model";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { resolveQuoteIssuerSettings } from "@/lib/quotes/issuer-snapshot";
import type { Quote } from "@/lib/quotes/types";
import type { QuoteSignatureMethod } from "@/lib/quotes/acceptance-types";

export function QuoteAcceptSheet({
  quote,
  token,
  seedName,
  seedEmail,
  open,
  onOpenChange,
}: {
  quote: Quote;
  token: string;
  seedName: string;
  seedEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [isPending, startTransition] = useTransition();
  const [signerName, setSignerName] = useState(seedName);
  const [signerEmail, setSignerEmail] = useState(seedEmail);
  const [declared, setDeclared] = useState(false);
  const [method, setMethod] = useState<QuoteSignatureMethod>("typed");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const declaration = useMemo(
    () => buildQuoteAcceptanceDeclarationFromQuote(quote),
    [quote]
  );
  const view = quoteDocumentViewModel(quote);
  const companyName = getCompanyDisplayName(
    resolveQuoteIssuerSettings(quote, null)
  );

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptPublicQuoteByToken({
        token,
        signerName,
        signerEmail,
        declared,
        declaration,
        signatureMethod: method,
        signatureValue: method === "drawn" ? drawn : signerName,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  };

  const fields = (
    <div className="space-y-4">
      <div
        className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
        data-quote-accept-summary="true"
      >
        <p className="font-medium">{formatQuoteNumberRevision(quote)}</p>
        {companyName ? (
          <p className="text-neutral-600">{companyName}</p>
        ) : null}
        <p className="mt-1 font-medium tabular-nums">
          {view.showGst
            ? `${view.totalInclGstFormatted} incl GST`
            : view.totalInclGstFormatted}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quote-accept-name">Your name</Label>
        <Input
          id="quote-accept-name"
          value={signerName}
          autoComplete="name"
          onChange={(event) => setSignerName(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quote-accept-email">Your email</Label>
        <Input
          id="quote-accept-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={signerEmail}
          onChange={(event) => setSignerEmail(event.target.value)}
        />
      </div>
      <label className="flex items-start gap-3 text-sm leading-relaxed">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          checked={declared}
          onChange={(event) => setDeclared(event.target.checked)}
        />
        <span>{declaration}</span>
      </label>
      <div className="space-y-2">
        <p className="text-sm font-medium">Signature</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={method === "typed" ? "default" : "outline"}
            onClick={() => setMethod("typed")}
          >
            Type
          </Button>
          <Button
            type="button"
            size="sm"
            variant={method === "drawn" ? "default" : "outline"}
            onClick={() => setMethod("drawn")}
          >
            Draw
          </Button>
        </div>
        {method === "typed" ? (
          <p
            className="font-serif text-2xl italic text-neutral-900"
            data-quote-signature-method="typed"
          >
            {signerName.trim() || "Your name"}
          </p>
        ) : (
          <QuoteSignaturePad onChange={setDrawn} />
        )}
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );

  const actions = (
    <Button
      type="button"
      className="h-11 w-full"
      disabled={isPending}
      onClick={submit}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : "Accept quote"}
    </Button>
  );

  const dialogOpen = open && isDesktop;
  const sheetOpen = open && !isDesktop;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
        <DialogContent
          data-quote-accept-mode="dialog"
          className="max-h-[90vh] overflow-y-auto sm:max-w-[36rem]"
        >
          <DialogHeader>
            <DialogTitle>Accept quote</DialogTitle>
            <DialogDescription>
              Record your digital acceptance of this quote. This is not an
              identity-verified signature.
            </DialogDescription>
          </DialogHeader>
          {fields}
          <DialogFooter>{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={sheetOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          data-quote-accept-mode="sheet"
          className="h-[100dvh] max-h-[100dvh] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Accept quote</SheetTitle>
            <SheetDescription>
              Record your digital acceptance of this quote. This is not an
              identity-verified signature.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-4">{fields}</div>
          <SheetFooter>{actions}</SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
