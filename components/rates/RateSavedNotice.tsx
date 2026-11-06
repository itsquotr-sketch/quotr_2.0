"use client";

import Link from "next/link";

export const COMPANY_RATE_SAVED_NOTICE =
  "Saved as a company rate for future estimates. This estimate has not changed yet. Return to the work area and update the estimate to apply it. This editor does not save a project-only override or a manual Pricing amount.";

export function RateSavedNotice({
  notice,
  returnHref,
  tone = "status",
}: {
  notice: string | null;
  returnHref?: string | null;
  tone?: "status" | "alert";
}) {
  if (!notice) return null;
  const returning = Boolean(returnHref) && notice === COMPANY_RATE_SAVED_NOTICE;
  return (
    <p
      role={tone === "alert" ? "alert" : "status"}
      className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
      data-rate-saved-return={returning ? "true" : "false"}
    >
      {notice}{" "}
      {returning && returnHref ? (
        <Link href={returnHref} className="font-medium text-foreground underline" data-rate-return-link="true">
          Return to the work area
        </Link>
      ) : null}
    </p>
  );
}
