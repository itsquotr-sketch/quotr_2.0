"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionCard } from "@/components/layout/section-card";
import { SettingsSectionNav } from "@/components/layout/section-nav";
import { StatusMessage } from "@/components/layout/status-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_QUOTE_ASSUMPTIONS,
  DEFAULT_QUOTE_EXCLUSIONS,
  DEFAULT_QUOTE_TERMS,
} from "@/lib/settings/defaults";
import {
  getCompanySettings,
  updateCompanySettings,
} from "@/lib/settings/company-actions";
import { sanitizeBrandColour } from "@/lib/settings/branding";
import type { CompanySettings } from "@/lib/settings/types";
import { CompanyLogoField } from "@/components/settings/CompanyLogoField";
import {
  isOrganisationBrandingPublicUrl,
  validateLegacyLogoUrl,
} from "@/lib/settings/logo";
import {
  COMPANY_SECTION_IDS,
  parseCompanySettingsSection,
  type CompanySettingsSectionId,
} from "@/lib/setup/recommendation-destinations";
import { ORG_TIMEZONE_CATALOGUE } from "@/lib/org/timezone";
import { cn } from "@/lib/utils";

type CompanySettingsContentProps = {
  initialSettings: CompanySettings;
  userEmail?: string;
  userFullName?: string | null;
  /** Deep-link from Setup recommendations (`?section=`). */
  initialSection?: CompanySettingsSectionId;
};

const COMPANY_SECTION_LABELS: Record<CompanySettingsSectionId, string> = {
  general: "General",
  pricing: "Pricing defaults",
  quotes: "Quotes",
  advanced: "Advanced",
};

const COMPANY_SECTIONS = COMPANY_SECTION_IDS.map((id) => ({
  id,
  label: COMPANY_SECTION_LABELS[id],
}));

function ColourField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const safeColour = sanitizeBrandColour(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-9 shrink-0 rounded-md border border-border/60",
            !safeColour && "bg-muted"
          )}
          style={safeColour ? { backgroundColor: safeColour } : undefined}
          aria-hidden
        />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="font-mono text-sm"
        />
      </div>
      {value.trim() && !safeColour ? (
        <p className="text-xs text-muted-foreground">
          Enter a valid hex colour (e.g. #1a1a1a). Invalid values are ignored on
          quotes.
        </p>
      ) : null}
    </div>
  );
}

export function CompanySettingsContent({
  initialSettings,
  userEmail,
  userFullName,
  initialSection = "general",
}: CompanySettingsContentProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [tradingName, setTradingName] = useState(settings.tradingName ?? "");
  const [legalName, setLegalName] = useState(settings.legalName ?? "");
  const [contactEmail, setContactEmail] = useState(settings.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(settings.contactPhone ?? "");
  const [website, setWebsite] = useState(settings.website ?? "");
  const [addressLine1, setAddressLine1] = useState(settings.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(settings.addressLine2 ?? "");
  const [city, setCity] = useState(settings.city ?? "");
  const [region, setRegion] = useState(settings.region ?? "");
  const [timezone, setTimezone] = useState(settings.timezone ?? "");
  const [postcode, setPostcode] = useState(settings.postcode ?? "");
  const [addressCountry, setAddressCountry] = useState(
    settings.addressCountry ?? "New Zealand"
  );
  const [nzbn, setNzbn] = useState(settings.nzbn ?? "");
  const [gstNumber, setGstNumber] = useState(settings.gstNumber ?? "");
  const [defaultGstRate, setDefaultGstRate] = useState(
    String(settings.defaultGstRate)
  );
  const [defaultQuoteValidityDays, setDefaultQuoteValidityDays] = useState(
    String(settings.defaultQuoteValidityDays)
  );
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(
    settings.defaultPaymentTerms ?? DEFAULT_PAYMENT_TERMS
  );
  const [defaultQuoteTerms, setDefaultQuoteTerms] = useState(
    settings.defaultQuoteTerms ?? DEFAULT_QUOTE_TERMS
  );
  const [defaultQuoteExclusions, setDefaultQuoteExclusions] = useState(
    settings.defaultQuoteExclusions ?? DEFAULT_QUOTE_EXCLUSIONS
  );
  const [defaultQuoteAssumptions, setDefaultQuoteAssumptions] = useState(
    settings.defaultQuoteAssumptions ?? DEFAULT_QUOTE_ASSUMPTIONS
  );
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [brandPrimaryColour, setBrandPrimaryColour] = useState(
    settings.brandPrimaryColour ?? ""
  );
  const [brandAccentColour, setBrandAccentColour] = useState(
    settings.brandAccentColour ?? ""
  );
  const [defaultMaterialWastagePercent, setDefaultMaterialWastagePercent] =
    useState(String(settings.defaultMaterialWastagePercent));
  const [deckingWastagePercent, setDeckingWastagePercent] = useState(
    settings.deckingWastagePercent != null
      ? String(settings.deckingWastagePercent)
      : ""
  );
  const [sheetMaterialWastagePercent, setSheetMaterialWastagePercent] =
    useState(
      settings.sheetMaterialWastagePercent != null
        ? String(settings.sheetMaterialWastagePercent)
        : ""
    );
  const [flooringWastagePercent, setFlooringWastagePercent] = useState(
    settings.flooringWastagePercent != null
      ? String(settings.flooringWastagePercent)
      : ""
  );
  const [paintWastagePercent, setPaintWastagePercent] = useState(
    settings.paintWastagePercent != null ? String(settings.paintWastagePercent) : ""
  );
  const [timberFramingWastagePercent, setTimberFramingWastagePercent] =
    useState(
      settings.timberFramingWastagePercent != null
        ? String(settings.timberFramingWastagePercent)
        : ""
    );

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<CompanySettingsSectionId>(
    () => parseCompanySettingsSection(initialSection) ?? "general"
  );

  function selectSection(id: string) {
    const next = parseCompanySettingsSection(id) ?? "general";
    setActiveSection(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", next);
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSavedMessage(null);
    setSaving(true);

    const result = await updateCompanySettings({
      tradingName,
      legalName,
      contactEmail,
      contactPhone,
      website,
      addressLine1,
      addressLine2,
      city,
      region,
      timezone: timezone || null,
      postcode,
      addressCountry,
      nzbn,
      gstNumber,
      defaultGstRate: Number(defaultGstRate),
      defaultQuoteValidityDays: Number(defaultQuoteValidityDays),
      defaultPaymentTerms,
      defaultQuoteTerms,
      defaultQuoteExclusions,
      defaultQuoteAssumptions,
      logoUrl,
      brandPrimaryColour,
      brandAccentColour,
      defaultMaterialWastagePercent: Number(defaultMaterialWastagePercent),
      deckingWastagePercent:
        deckingWastagePercent.trim() === ""
          ? null
          : Number(deckingWastagePercent),
      sheetMaterialWastagePercent:
        sheetMaterialWastagePercent.trim() === ""
          ? null
          : Number(sheetMaterialWastagePercent),
      flooringWastagePercent:
        flooringWastagePercent.trim() === ""
          ? null
          : Number(flooringWastagePercent),
      paintWastagePercent:
        paintWastagePercent.trim() === "" ? null : Number(paintWastagePercent),
      timberFramingWastagePercent:
        timberFramingWastagePercent.trim() === ""
          ? null
          : Number(timberFramingWastagePercent),
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return;
    }

    if (result.settings) {
      setSettings(result.settings);
      setSavedMessage("Company settings saved.");
    } else {
      const refreshed = await getCompanySettings();
      if (refreshed) {
        setSettings(refreshed);
      }
      setSavedMessage("Company settings saved.");
    }
  }

  const displayName =
    settings.tradingName?.trim() ||
    settings.legalName?.trim() ||
    settings.organisationName;

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card className="border-border/60 bg-muted/20 shadow-none">
        <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              Signed in as {userFullName ?? "User"}
              {userEmail ? ` · ${userEmail}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/app/setup"
              className="text-primary underline-offset-4 hover:underline"
            >
              Setup wizard
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              href="/app/rates"
              className="text-primary underline-offset-4 hover:underline"
            >
              Rates
            </Link>
          </div>
        </CardContent>
      </Card>

      {error ? <StatusMessage variant="error">{error}</StatusMessage> : null}
      {savedMessage ? (
        <StatusMessage variant="success">{savedMessage}</StatusMessage>
      ) : null}

      <SettingsSectionNav
        items={[...COMPANY_SECTIONS]}
        activeId={activeSection}
        onChange={selectSection}
      />

      {activeSection === "general" ? (
      <SectionCard
        title="General"
        description="Company identity and address shown on quote previews. Personal Profile fields live under Account → Profile."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legal-name">Legal name</Label>
            <Input
              id="legal-name"
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              placeholder={settings.organisationName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trading-name">Trading name</Label>
            <Input
              id="trading-name"
              value={tradingName}
              onChange={(event) => setTradingName(event.target.value)}
              placeholder="Name shown to clients"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
            {fieldErrors.contactEmail?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.contactEmail[0]}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gst-number">GST number</Label>
            <Input
              id="gst-number"
              value={gstNumber}
              onChange={(event) => setGstNumber(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nzbn">NZBN</Label>
            <Input
              id="nzbn"
              value={nzbn}
              onChange={(event) => setNzbn(event.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-border/60 pt-4">
          <p className="mb-4 text-sm font-medium">Business address</p>
        <div className="space-y-2">
          <Label htmlFor="address-line-1">Address line 1</Label>
          <Input
            id="address-line-1"
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address-line-2">Address line 2</Label>
          <Input
            id="address-line-2"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="e.g. Auckland"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-timezone">Timezone</Label>
          <select
            id="company-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          >
            <option value="">
              Not set — times shown as Auckland / Wellington
            </option>
            {ORG_TIMEZONE_CATALOGUE.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldErrors.timezone?.[0] ? (
            <p className="text-sm text-destructive">
              {fieldErrors.timezone[0]}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Used to show quote acceptance and send times in your local time.
            Changing this does not rewrite stored UTC evidence.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-country">Country</Label>
            <Input
              id="address-country"
              value={addressCountry}
              onChange={(event) => setAddressCountry(event.target.value)}
              required
            />
          </div>
        </div>
        </div>
      </SectionCard>
      ) : null}

      {activeSection === "pricing" ? (
      <SectionCard
        title="Pricing defaults"
        description="Tax defaults for new pricing documents. Labour rates and default margin live on Rates."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-gst-rate">Default GST rate %</Label>
            <Input
              id="default-gst-rate"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.01"
              value={defaultGstRate}
              onChange={(event) => setDefaultGstRate(event.target.value)}
              required
              className="h-11"
            />
            {fieldErrors.defaultGstRate?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.defaultGstRate[0]}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-validity-pricing">
              Default quote validity (days)
            </Label>
            <Input
              id="default-validity-pricing"
              type="number"
              inputMode="numeric"
              min="1"
              max="365"
              step="1"
              value={defaultQuoteValidityDays}
              onChange={(event) =>
                setDefaultQuoteValidityDays(event.target.value)
              }
              required
              className="h-11"
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Set labour rates and default gross margin (20% standard) on{" "}
          <Link
            href="/app/rates"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Rates
          </Link>
          .
        </p>
      </SectionCard>
      ) : null}

      {activeSection === "quotes" ? (
      <>
      <SectionCard
        title="Quote defaults"
        description="Validity and commercial wording copied into new quotes. Existing documents are not changed."
      >
        <div className="space-y-2">
          <Label htmlFor="default-validity">Default quote validity (days)</Label>
          <Input
            id="default-validity"
            type="number"
            inputMode="numeric"
            min="1"
            max="365"
            step="1"
            value={defaultQuoteValidityDays}
            onChange={(event) =>
              setDefaultQuoteValidityDays(event.target.value)
            }
            required
            className="h-11"
          />
          {fieldErrors.defaultQuoteValidityDays?.[0] ? (
            <p className="text-sm text-destructive">
              {fieldErrors.defaultQuoteValidityDays[0]}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="default-payment-terms">Payment terms</Label>
          <Textarea
            id="default-payment-terms"
            value={defaultPaymentTerms}
            onChange={(event) => setDefaultPaymentTerms(event.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="default-quote-terms">Quote terms</Label>
          <Textarea
            id="default-quote-terms"
            value={defaultQuoteTerms}
            onChange={(event) => setDefaultQuoteTerms(event.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="default-exclusions">Default exclusions</Label>
          <p className="text-[11px] text-muted-foreground">
            One item per line when copied into pricing and quotes.
          </p>
          <Textarea
            id="default-exclusions"
            value={defaultQuoteExclusions}
            onChange={(event) => setDefaultQuoteExclusions(event.target.value)}
            rows={5}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="default-assumptions">Default assumptions</Label>
          <p className="text-[11px] text-muted-foreground">
            One item per line when copied into new documents.
          </p>
          <Textarea
            id="default-assumptions"
            value={defaultQuoteAssumptions}
            onChange={(event) => setDefaultQuoteAssumptions(event.target.value)}
            rows={5}
          />
        </div>
      </SectionCard>
      <SectionCard
        title="Branding"
        description="Your logo and colours appear on quotes."
      >
        <CompanyLogoField
          logoUrl={logoUrl.trim() ? logoUrl : null}
          onSettingsChange={(next) => {
            setLogoUrl(next.logoUrl ?? "");
            // Keep local form settings in sync when upload/remove returns full row.
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ColourField
            id="brand-primary"
            label="Primary colour"
            value={brandPrimaryColour}
            onChange={setBrandPrimaryColour}
            placeholder="#1a1a1a"
          />
          <ColourField
            id="brand-accent"
            label="Accent colour"
            value={brandAccentColour}
            onChange={setBrandAccentColour}
            placeholder="#2563eb"
          />
        </div>
        <details className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Advanced — legacy logo link
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Prefer Upload logo above. A webpage link (for example an Imgur
              page) will not display on quotes — use a direct image file link
              only if you must.
            </p>
            <Label htmlFor="logo-url">Legacy logo URL</Label>
            <Input
              id="logo-url"
              value={
                isOrganisationBrandingPublicUrl(
                  logoUrl,
                  process.env.NEXT_PUBLIC_SUPABASE_URL
                )
                  ? ""
                  : logoUrl
              }
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://example.com/logo.png"
            />
            {(() => {
              const check = validateLegacyLogoUrl(
                isOrganisationBrandingPublicUrl(
                  logoUrl,
                  process.env.NEXT_PUBLIC_SUPABASE_URL
                )
                  ? ""
                  : logoUrl
              );
              if (!check.ok) {
                return (
                  <p className="text-sm text-destructive" role="alert">
                    {check.error}
                  </p>
                );
              }
              return null;
            })()}
          </div>
        </details>
      </SectionCard>
      </>
      ) : null}

      {activeSection === "advanced" ? (
      <SectionCard
        title="Advanced"
        description="Material wastage defaults used before final pricing. You can still adjust pricing later."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-material-wastage">
              Default material wastage %
            </Label>
            <Input
              id="default-material-wastage"
              type="number"
              inputMode="decimal"
              min="0"
              max="50"
              step="0.1"
              value={defaultMaterialWastagePercent}
              onChange={(event) =>
                setDefaultMaterialWastagePercent(event.target.value)
              }
              required
              className="h-11"
            />
            {fieldErrors.defaultMaterialWastagePercent?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.defaultMaterialWastagePercent[0]}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="decking-wastage">Decking board wastage %</Label>
            <Input
              id="decking-wastage"
              type="number"
              inputMode="decimal"
              min="0"
              max="50"
              step="0.1"
              value={deckingWastagePercent}
              onChange={(event) => setDeckingWastagePercent(event.target.value)}
              placeholder="Uses default"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sheet-material-wastage">
              Sheet material wastage %
            </Label>
            <Input
              id="sheet-material-wastage"
              type="number"
              inputMode="decimal"
              min="0"
              max="50"
              step="0.1"
              value={sheetMaterialWastagePercent}
              onChange={(event) =>
                setSheetMaterialWastagePercent(event.target.value)
              }
              placeholder="Uses default"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flooring-wastage">Flooring wastage %</Label>
            <Input
              id="flooring-wastage"
              type="number"
              inputMode="decimal"
              min="0"
              max="50"
              step="0.1"
              value={flooringWastagePercent}
              onChange={(event) => setFlooringWastagePercent(event.target.value)}
              placeholder="Uses default"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paint-wastage">Paint wastage %</Label>
            <Input
              id="paint-wastage"
              type="number"
              inputMode="decimal"
              min="0"
              max="50"
              step="0.1"
              value={paintWastagePercent}
              onChange={(event) => setPaintWastagePercent(event.target.value)}
              placeholder="Uses default"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timber-framing-wastage">
              Timber/framing wastage %
            </Label>
            <Input
              id="timber-framing-wastage"
              type="number"
              inputMode="decimal"
              min="0"
              max="50"
              step="0.1"
              value={timberFramingWastagePercent}
              onChange={(event) =>
                setTimberFramingWastagePercent(event.target.value)
              }
              placeholder="Uses default"
              className="h-11"
            />
          </div>
        </div>
      </SectionCard>
      ) : null}

      <Card className="sticky bottom-0 z-10 border-border/60 bg-background/95 shadow-none backdrop-blur-sm">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {savedMessage ?? "Changes apply to new pricing and quotes."}
          </p>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save company settings"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
