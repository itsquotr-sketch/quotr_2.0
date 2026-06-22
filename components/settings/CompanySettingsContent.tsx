"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { CompanySettings } from "@/lib/settings/types";

type CompanySettingsContentProps = {
  initialSettings: CompanySettings;
  userEmail?: string;
  userFullName?: string | null;
};

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function CompanySettingsContent({
  initialSettings,
  userEmail,
  userFullName,
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

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

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

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card className="border-border/60 bg-muted/20 shadow-none">
        <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{settings.organisationName}</p>
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

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {savedMessage ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {savedMessage}
        </p>
      ) : null}

      <SettingsSection
        title="Business details"
        description="Company information copied into new pricing and quotes as a snapshot."
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
            <Label htmlFor="contact-email">Contact email</Label>
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
      </SettingsSection>

      <SettingsSection title="Address">
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
      </SettingsSection>

      <SettingsSection
        title="Tax & quote defaults"
        description="Applied when creating new final pricing and quotes."
      >
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-gst-rate">Default GST rate %</Label>
            <Input
              id="default-gst-rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={defaultGstRate}
              onChange={(event) => setDefaultGstRate(event.target.value)}
              required
            />
            {fieldErrors.defaultGstRate?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.defaultGstRate[0]}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-validity">Default quote validity (days)</Label>
            <Input
              id="default-validity"
              type="number"
              min="1"
              max="365"
              step="1"
              value={defaultQuoteValidityDays}
              onChange={(event) =>
                setDefaultQuoteValidityDays(event.target.value)
              }
              required
            />
            {fieldErrors.defaultQuoteValidityDays?.[0] ? (
              <p className="text-sm text-destructive">
                {fieldErrors.defaultQuoteValidityDays[0]}
              </p>
            ) : null}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Default quote content"
        description="Copied into new documents. Existing quotes are not changed when you edit these."
      >
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
          <Textarea
            id="default-exclusions"
            value={defaultQuoteExclusions}
            onChange={(event) => setDefaultQuoteExclusions(event.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            One item per line when copied into pricing and quotes.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="default-assumptions">Default assumptions</Label>
          <Textarea
            id="default-assumptions"
            value={defaultQuoteAssumptions}
            onChange={(event) => setDefaultQuoteAssumptions(event.target.value)}
            rows={4}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Branding placeholders"
        description="For future PDF export. Logo upload is not enabled yet."
      >
        <div className="space-y-2">
          <Label htmlFor="logo-url">Logo URL</Label>
          <Input
            id="logo-url"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://example.com/logo.png"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand-primary">Primary colour</Label>
            <Input
              id="brand-primary"
              value={brandPrimaryColour}
              onChange={(event) => setBrandPrimaryColour(event.target.value)}
              placeholder="#1a1a1a"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-accent">Accent colour</Label>
            <Input
              id="brand-accent"
              value={brandAccentColour}
              onChange={(event) => setBrandAccentColour(event.target.value)}
              placeholder="#2563eb"
            />
          </div>
        </div>
      </SettingsSection>

      <Card className="border-border/60 shadow-none">
        <CardFooter className="justify-end border-t py-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save company settings"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
