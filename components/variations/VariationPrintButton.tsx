"use client";

import { Button } from "@/components/ui/button";

export function VariationPrintButton() {
  return (
    <div className="mx-auto mb-4 flex max-w-3xl justify-end print:hidden">
      <Button type="button" variant="outline" onClick={() => window.print()}>
        Print / Save as PDF
      </Button>
    </div>
  );
}
