"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type QuotePrintActionsProps = {
  projectId: string;
  quoteId: string;
};

export function QuotePrintActions({
  projectId,
  quoteId,
}: QuotePrintActionsProps) {
  const handlePrint = () => {
    const printUrl = `/app/projects/${projectId}/quotes/${quoteId}/print`;
    window.open(printUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-2 print:hidden">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handlePrint}
      >
        <Printer className="mr-2 size-4" />
        Print / Save as PDF
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Opens a clean print view. Use your browser print dialog to save as PDF.
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Tip: In the browser print dialog, turn off Headers and footers for a
        clean PDF.
      </p>
    </div>
  );
}
