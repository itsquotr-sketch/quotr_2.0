"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  removeCompanyLogo,
  uploadCompanyLogo,
} from "@/lib/settings/logo-actions";
import {
  COMPANY_LOGO_MAX_BYTES,
  validateCompanyLogoFileMeta,
} from "@/lib/settings/logo";
import type { CompanySettings } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

type CompanyLogoFieldProps = {
  logoUrl: string | null;
  onSettingsChange: (settings: CompanySettings) => void;
  className?: string;
  readOnly?: boolean;
};

export function CompanyLogoField({
  logoUrl,
  onSettingsChange,
  className,
  readOnly = false,
}: CompanyLogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "saved" | "removing">(
    "idle"
  );
  const [brokenRemote, setBrokenRemote] = useState(false);

  const displaySrc = localPreview ?? (brokenRemote ? null : logoUrl?.trim() || null);
  const hasLogo = Boolean(displaySrc);

  function revokeLocalPreview() {
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
  }

  function pickFile() {
    setError(null);
    inputRef.current?.click();
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const meta = validateCompanyLogoFileMeta({
      size: file.size,
      mime: file.type || null,
    });
    if (!meta.ok) {
      setError(meta.error);
      return;
    }
    if (file.size > COMPANY_LOGO_MAX_BYTES) {
      setError("Logo must be 2 MB or smaller.");
      return;
    }

    revokeLocalPreview();
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setBrokenRemote(false);
    setStatus("uploading");
    setError(null);

    const body = new FormData();
    body.set("logo", file);

    startTransition(async () => {
      const result = await uploadCompanyLogo(body);
      if (result.error) {
        setError(result.error);
        setStatus("idle");
        revokeLocalPreview();
        return;
      }
      if (result.settings) {
        onSettingsChange(result.settings);
      }
      revokeLocalPreview();
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    });
  }

  function onRemove() {
    setError(null);
    setStatus("removing");
    startTransition(async () => {
      const result = await removeCompanyLogo();
      if (result.error) {
        setError(result.error);
        setStatus("idle");
        return;
      }
      revokeLocalPreview();
      setBrokenRemote(false);
      if (result.settings) {
        onSettingsChange(result.settings);
      }
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label>Company logo</Label>
        {readOnly ? null : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            PNG, JPG or WebP · max 2 MB. Used on your quotes.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className={cn(
            "flex h-20 w-full max-w-[220px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-3",
            hasLogo && "border-solid"
          )}
        >
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displaySrc}
              alt="Company logo preview"
              className="max-h-16 max-w-full object-contain"
              onError={() => {
                if (!localPreview) setBrokenRemote(true);
              }}
            />
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {brokenRemote
                ? readOnly
                  ? "Current logo could not be shown."
                  : "Current logo link could not be shown. Upload a new logo."
                : "No logo yet"}
            </p>
          )}
        </div>

        {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            className="sr-only"
            aria-label="Upload company logo"
            disabled={pending}
            onChange={onFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={pickFile}
          >
            {hasLogo ? "Replace logo" : "Upload logo"}
          </Button>
          {logoUrl?.trim() || localPreview ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
          {status === "uploading" || status === "removing" ? (
            <span className="text-xs text-muted-foreground">
              {status === "uploading" ? "Uploading…" : "Removing…"}
            </span>
          ) : null}
          {status === "saved" ? (
            <span className="text-xs text-muted-foreground">Saved</span>
          ) : null}
        </div>
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
