"use client";

import { useState } from "react";
import { resolveCompanyLogoSrc } from "@/lib/settings/logo";
import { cn } from "@/lib/utils";

type QuoteCompanyLogoProps = {
  logoUrl: string | null | undefined;
  companyName: string;
  brandPrimary?: string | null;
  className?: string;
  imgClassName?: string;
};

/**
 * Quote/print logo with graceful fallback — never leaves a broken-image icon.
 */
export function QuoteCompanyLogo({
  logoUrl,
  companyName,
  brandPrimary,
  className,
  imgClassName,
}: QuoteCompanyLogoProps) {
  const src = resolveCompanyLogoSrc(logoUrl);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  if (showImage && src) {
    return (
      <div className={cn("mb-1", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={companyName || "Company logo"}
          className={cn(
            "max-h-12 w-auto max-w-[200px] object-contain object-left print:max-h-10",
            imgClassName
          )}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  if (!companyName) {
    return null;
  }

  return (
    <p
      className={cn(
        "mb-1 text-base font-semibold tracking-tight text-neutral-900 print:text-[13pt]",
        className
      )}
      style={brandPrimary ? { color: brandPrimary } : undefined}
    >
      {companyName}
    </p>
  );
}
