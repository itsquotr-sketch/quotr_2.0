"use client";

import { MaterialsByProductFamily } from "@/components/rates/MaterialsByProductFamily";

/**
 * Local browser QA harness for RATES-MATERIALS-UI-01.
 * Available only when MATERIALS_UI_BROWSER_QA=1. Not for Production.
 */
export default function MaterialsUiBrowserQaPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-3 py-6">
      <p className="text-xs text-muted-foreground">
        Local Materials UI browser QA harness (MATERIALS_UI_BROWSER_QA=1).
      </p>
      <MaterialsByProductFamily
        rates={[]}
        readOnly={false}
        companyGrossMarginPercent={20}
        onRatesChange={() => undefined}
      />
    </main>
  );
}
