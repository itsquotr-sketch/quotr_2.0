"use client";

import { useEffect, useState } from "react";
import { AddressSearch } from "@/components/addresses/AddressSearch";
import { addressCountryCode } from "@/lib/addresses/map-place";
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
import type { CompanySettings, CompanySettingsInput } from "@/lib/settings/types";
import { CompanyLogoField } from "@/components/settings/CompanyLogoField";
import { WorkAreasStep } from "@/components/setup/WorkAreasStep";
import type { SetupState } from "@/components/setup/types";
import { getCompanyDisplayName } from "@/lib/quotes/display";
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
  /** Deep-link from Setup recommendations (`?section=`). */
  initialSection?: CompanySettingsSectionId;
  canEdit: boolean;
  setupState: SetupState;
};

const COMPANY_SECTION_LABELS: Record<CompanySettingsSectionId, string> = {
  overview: "Overview",
  business: "Business details",
  address: "Address",
  tax: "Tax",
  work: "Work types",
  branding: "Branding",
  documents: "Documents",
};

const COMPANY_SECTIONS = COMPANY_SECTION_IDS.map((id) => ({
  id,
  label: COMPANY_SECTION_LABELS[id],
}));

function stored(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function sameText(current: string, saved: string | null | undefined): boolean {
  return current.trim() === stored(saved);
}

function isAustralia(country: string): boolean {
  const value = country.trim().toLowerCase();
  return value === "australia" || value === "au";
}

function ColourField({
  id,
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  readOnly?: boolean;
}) {
  const safeColour = sanitizeBrandColour(value);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-11 shrink-0 rounded-md border border-border/60",
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
          className="h-11 min-h-11 font-mono text-base md:text-sm"
          readOnly={readOnly}
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

function LockedInput({
  canEdit,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { canEdit: boolean }) {
  return (
    <Input
      {...props}
      readOnly={!canEdit}
      className={cn("h-11 min-h-11", className)}
    />
  );
}

function LockedTextarea({
  canEdit,
  ...props
}: React.ComponentProps<typeof Textarea> & { canEdit: boolean }) {
  return <Textarea {...props} readOnly={!canEdit} />;
}

function CompanySectionPicker({
  activeId,
  onChange,
}: {
  activeId: CompanySettingsSectionId;
  onChange: (id: string) => void;
}) {
  return (
    <>
      <label className="grid gap-1.5 md:hidden" htmlFor="company-section">
        <span className="text-xs font-medium text-muted-foreground">
          Company section
        </span>
        <select
          id="company-section"
          data-company-section-select
          aria-label="Company section"
          className="h-11 min-h-11 w-full rounded-xl border border-border/80 bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          value={activeId}
          onChange={(event) => onChange(event.target.value)}
        >
          {COMPANY_SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </label>
      <SettingsSectionNav
        items={[...COMPANY_SECTIONS]}
        activeId={activeId}
        onChange={onChange}
        label="Company sections"
        touchTargets
        wrap
        className="hidden md:block"
      />
    </>
  );
}

export function CompanySettingsContent({
  initialSettings,
  initialSection = "overview",
  canEdit,
  setupState,
}: CompanySettingsContentProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [tradingName, setTradingName] = useState(stored(settings.tradingName));
  const [legalName, setLegalName] = useState(stored(settings.legalName));
  const [contactEmail, setContactEmail] = useState(stored(settings.contactEmail));
  const [contactPhone, setContactPhone] = useState(stored(settings.contactPhone));
  const [website, setWebsite] = useState(stored(settings.website));
  const [addressLine1, setAddressLine1] = useState(stored(settings.addressLine1));
  const [addressLine2, setAddressLine2] = useState(stored(settings.addressLine2));
  const [city, setCity] = useState(stored(settings.city));
  const [region, setRegion] = useState(stored(settings.region));
  const [timezone, setTimezone] = useState(stored(settings.timezone));
  const [postcode, setPostcode] = useState(stored(settings.postcode));
  const [addressCountry, setAddressCountry] = useState(
    settings.addressCountry ?? "New Zealand"
  );
  const [nzbn, setNzbn] = useState(stored(settings.nzbn));
  const [abn, setAbn] = useState(stored(settings.abn));
  const [gstNumber, setGstNumber] = useState(stored(settings.gstNumber));
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
  const [logoUrl, setLogoUrl] = useState(stored(settings.logoUrl));
  const [brandPrimaryColour, setBrandPrimaryColour] = useState(
    stored(settings.brandPrimaryColour)
  );
  const [brandAccentColour, setBrandAccentColour] = useState(
    stored(settings.brandAccentColour)
  );

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<CompanySettingsSectionId>(
    () => parseCompanySettingsSection(initialSection) ?? "overview"
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("section");
    const parsed = parseCompanySettingsSection(raw);
    if (raw && parsed && raw !== parsed) {
      url.searchParams.set("section", parsed);
      window.history.replaceState(
        { companySection: parsed },
        "",
        `${url.pathname}${url.search}`
      );
    }

    function onPopState() {
      const next =
        parseCompanySettingsSection(
          new URL(window.location.href).searchParams.get("section")
        ) ?? "overview";
      setActiveSection(next);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function selectSection(id: string) {
    const next = parseCompanySettingsSection(id) ?? "overview";
    setActiveSection(next);
    setError(null);
    setSavedMessage(null);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") === next) return;
    url.searchParams.set("section", next);
    window.history.pushState(
      { companySection: next },
      "",
      `${url.pathname}${url.search}`
    );
  }

  async function persist(input: CompanySettingsInput) {
    if (!canEdit) return;
    setError(null);
    setFieldErrors({});
    setSavedMessage(null);
    setSaving(true);
    const result = await updateCompanySettings(input);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return;
    }

    const next = result.settings ?? (await getCompanySettings());
    if (next) {
      setSettings(next);
      setTradingName(stored(next.tradingName));
      setLegalName(stored(next.legalName));
      setContactEmail(stored(next.contactEmail));
      setContactPhone(stored(next.contactPhone));
      setWebsite(stored(next.website));
      setAddressLine1(stored(next.addressLine1));
      setAddressLine2(stored(next.addressLine2));
      setCity(stored(next.city));
      setRegion(stored(next.region));
      setTimezone(stored(next.timezone));
      setPostcode(stored(next.postcode));
      setAddressCountry(next.addressCountry ?? "New Zealand");
      setNzbn(stored(next.nzbn));
      setAbn(stored(next.abn));
      setGstNumber(stored(next.gstNumber));
      setDefaultGstRate(String(next.defaultGstRate));
      setDefaultQuoteValidityDays(String(next.defaultQuoteValidityDays));
      setDefaultPaymentTerms(next.defaultPaymentTerms ?? DEFAULT_PAYMENT_TERMS);
      setDefaultQuoteTerms(next.defaultQuoteTerms ?? DEFAULT_QUOTE_TERMS);
      setDefaultQuoteExclusions(
        next.defaultQuoteExclusions ?? DEFAULT_QUOTE_EXCLUSIONS
      );
      setDefaultQuoteAssumptions(
        next.defaultQuoteAssumptions ?? DEFAULT_QUOTE_ASSUMPTIONS
      );
      setLogoUrl(stored(next.logoUrl));
      setBrandPrimaryColour(stored(next.brandPrimaryColour));
      setBrandAccentColour(stored(next.brandAccentColour));
    }
    setSavedMessage("Company settings saved.");
  }

  const businessDirty =
    !sameText(tradingName, settings.tradingName) ||
    !sameText(legalName, settings.legalName) ||
    !sameText(contactEmail, settings.contactEmail) ||
    !sameText(contactPhone, settings.contactPhone) ||
    !sameText(website, settings.website);
  const addressDirty =
    !sameText(addressLine1, settings.addressLine1) ||
    !sameText(addressLine2, settings.addressLine2) ||
    !sameText(city, settings.city) ||
    !sameText(region, settings.region) ||
    !sameText(postcode, settings.postcode) ||
    addressCountry.trim() !== (settings.addressCountry ?? "New Zealand").trim() ||
    !sameText(timezone, settings.timezone);
  const taxDirty =
    !sameText(gstNumber, settings.gstNumber) ||
    !sameText(nzbn, settings.nzbn) ||
    !sameText(abn, settings.abn) ||
    defaultGstRate.trim() !== String(settings.defaultGstRate);
  const brandingDirty =
    !sameText(logoUrl, settings.logoUrl) ||
    !sameText(brandPrimaryColour, settings.brandPrimaryColour) ||
    !sameText(brandAccentColour, settings.brandAccentColour);
  const documentsDirty =
    defaultQuoteValidityDays.trim() !== String(settings.defaultQuoteValidityDays) ||
    defaultPaymentTerms !== (settings.defaultPaymentTerms ?? DEFAULT_PAYMENT_TERMS) ||
    defaultQuoteTerms !== (settings.defaultQuoteTerms ?? DEFAULT_QUOTE_TERMS) ||
    defaultQuoteExclusions !==
      (settings.defaultQuoteExclusions ?? DEFAULT_QUOTE_EXCLUSIONS) ||
    defaultQuoteAssumptions !==
      (settings.defaultQuoteAssumptions ?? DEFAULT_QUOTE_ASSUMPTIONS);

  const displayName = getCompanyDisplayName({
    ...settings,
    tradingName,
    legalName,
  });
  const enabledWork = setupState.workAreas.filter((area) => area.enabled);
  const currency = setupState.settings?.currency?.trim() || null;
  const timezoneLabel =
    ORG_TIMEZONE_CATALOGUE.find((option) => option.id === timezone)?.label ??
    (timezone || "Auckland / Wellington");
  const logoPreview = /^https?:\/\//i.test(logoUrl.trim()) ? logoUrl.trim() : "";
  const australia = isAustralia(addressCountry);
  const setupLabel =
    setupState.settings?.onboarding_status === "completed"
      ? "Setup complete"
      : setupState.settings?.onboarding_status === "in_progress"
        ? "Setup in progress"
        : "Setup not started";

  const attention: Array<{
    id: CompanySettingsSectionId;
    label: string;
    reason: string;
  }> = [];
  if (!contactEmail.trim()) {
    attention.push({
      id: "business",
      label: "Add a contact email",
      reason: "Quotes and Variations can show this address.",
    });
  }
  if (!addressLine1.trim() || !city.trim()) {
    attention.push({
      id: "address",
      label: "Add the business address",
      reason: "Customer documents can show where the business is based.",
    });
  }
  const nextAction = attention[0] ?? {
    id: "documents" as const,
    label: "Review document wording",
    reason: "Payment terms and quote wording are copied into new documents.",
  };

  function saveFooter(dirty: boolean) {
    if (!canEdit) return null;
    return (
      <Card data-company-save-footer className="rounded-xl border-border/60 shadow-none ring-0">
        <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {savedMessage ? `${savedMessage} ` : null}
            Changes apply to new pricing and quotes. Issued Quotes and
            Variations keep the company details saved on that document.
          </p>
          <Button
            type="submit"
            disabled={saving || !dirty}
            className="h-11 min-h-11 w-full sm:w-auto"
          >
            {saving ? "Saving…" : "Save company settings"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="min-w-0 space-y-4 overflow-x-hidden"
      data-company-settings
      onInput={() => {
        if (savedMessage) setSavedMessage(null);
      }}
      onChange={() => {
        if (savedMessage) setSavedMessage(null);
      }}
    >
      <CompanySectionPicker activeId={activeSection} onChange={selectSection} />

      {canEdit ? null : (
        <p className="text-sm text-muted-foreground">
          Only owners and admins can change company settings.
        </p>
      )}
      {error ? <StatusMessage variant="error">{error}</StatusMessage> : null}

      {activeSection === "overview" ? (
        <div className="grid gap-4 sm:grid-cols-2" data-company-overview>
          <section className="space-y-4 rounded-xl border border-border/60 bg-card px-4 py-4">
            <div className="flex items-start gap-3">
              {logoPreview ? (
                // Saved organisation logo. Decorative beside the name.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt=""
                  className="size-12 shrink-0 rounded-md border border-border/70 bg-white object-contain p-1"
                />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
                  No logo
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-tight">
                  {displayName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{setupLabel}</p>
              </div>
            </div>
            {attention.length > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  <span className="font-medium">{nextAction.label}.</span>{" "}
                  <span className="text-muted-foreground">{nextAction.reason}</span>
                </p>
                <Button
                  type="button"
                  size="touch"
                  className="h-11 min-h-11 w-full sm:w-auto"
                  onClick={() => selectSection(nextAction.id)}
                >
                  {nextAction.label}
                </Button>
              </div>
            ) : null}
            <dl className="divide-y divide-border/60 border-t border-border/60">
              <OverviewItem
                label="Contact"
                value={
                  [contactEmail, contactPhone].filter(Boolean).join(" · ") ||
                  "No contact details yet"
                }
                attention={!contactEmail.trim()}
              />
              <OverviewItem label="Country" value={addressCountry || "Not set"} />
              <OverviewItem label="Currency" value={currency || "Not set"} />
              <OverviewItem label="Timezone" value={timezoneLabel} />
              <OverviewItem label="GST rate" value={`${defaultGstRate}%`} />
              {gstNumber.trim() ? (
                <OverviewItem label="GST number" value={gstNumber.trim()} />
              ) : null}
            </dl>
          </section>
          <div className="space-y-4">
            <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight">Work types</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  className="h-11 min-h-11"
                  onClick={() => selectSection("work")}
                >
                  Edit work types
                </Button>
              </div>
              {enabledWork.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">None selected</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {enabledWork.slice(0, 8).map((area) => (
                    <li
                      key={area.id}
                      className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs"
                    >
                      {area.label}
                    </li>
                  ))}
                  {enabledWork.length > 8 ? (
                    <li>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-full px-2.5 text-xs font-medium text-[var(--brand-orange)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                        onClick={() => selectSection("work")}
                      >
                        +{enabledWork.length - 8} more
                      </button>
                    </li>
                  ) : null}
                </ul>
              )}
            </section>
            <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
              <h2 className="text-sm font-semibold tracking-tight">Documents</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Changes apply to new pricing and documents. Issued Quotes and
                Variations keep the details saved on that document.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  className="h-11 min-h-11 w-full sm:w-auto"
                  onClick={() => selectSection("branding")}
                >
                  Branding
                </Button>
                <Button
                  type="button"
                  size="touch"
                  className="h-11 min-h-11 w-full sm:w-auto"
                  onClick={() => selectSection("documents")}
                >
                  Documents
                </Button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeSection === "business" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void persist({
              tradingName,
              legalName,
              contactEmail,
              contactPhone,
              website,
            });
          }}
        >
          <SectionCard
            title="Business details"
            description="The trading name is the name on Quotes and Variations when it is set. Personal Profile fields live under Account → Profile."
          >
            <div className="space-y-5" data-company-identity>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="legal-name">Legal name</Label>
                  <LockedInput
                    canEdit={canEdit}
                    id="legal-name"
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                    placeholder={settings.organisationName}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="trading-name">Trading name</Label>
                  <LockedInput
                    canEdit={canEdit}
                    id="trading-name"
                    value={tradingName}
                    onChange={(event) => setTradingName(event.target.value)}
                    placeholder="Name shown to clients"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown on customer documents before the legal name.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="contact-email">Email</Label>
                  <LockedInput
                    canEdit={canEdit}
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                  />
                  {fieldErrors.contactEmail?.[0] ? (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors.contactEmail[0]}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="contact-phone">Phone</Label>
                  <LockedInput
                    canEdit={canEdit}
                    id="contact-phone"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="website">Website</Label>
                <LockedInput
                  canEdit={canEdit}
                  id="website"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="https://"
                />
                <p className="text-xs text-muted-foreground">Optional.</p>
              </div>
            </div>
          </SectionCard>
          {saveFooter(businessDirty)}
        </form>
      ) : null}

      {activeSection === "address" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void persist({
              addressLine1,
              addressLine2,
              city,
              region,
              postcode,
              addressCountry,
              timezone: timezone || null,
            });
          }}
        >
          <SectionCard
            title="Address and region"
            description="Search can fill these fields. You can edit every field before saving. This address can appear on Quotes and Variations."
          >
            <div className="space-y-5" data-company-address>
              {canEdit ? (
                <AddressSearch
                  countryCode={addressCountryCode(addressCountry)}
                  onAddress={(mapped) => {
                    setAddressLine1(mapped.street);
                    setAddressLine2(mapped.unit);
                    setCity(mapped.suburbOrCity);
                    setRegion(mapped.region);
                    setPostcode(mapped.postcode);
                    if (mapped.country) setAddressCountry(mapped.country);
                  }}
                />
              ) : null}
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="address-line-1">Address line 1</Label>
                <LockedInput
                  canEdit={canEdit}
                  id="address-line-1"
                  value={addressLine1}
                  onChange={(event) => setAddressLine1(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="address-line-2">Address line 2</Label>
                <LockedInput
                  canEdit={canEdit}
                  id="address-line-2"
                  value={addressLine2}
                  onChange={(event) => setAddressLine2(event.target.value)}
                />
              </div>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="city">City</Label>
                  <LockedInput
                    canEdit={canEdit}
                    id="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="region">Region</Label>
                  <LockedInput
                    canEdit={canEdit}
                    id="region"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    placeholder="e.g. Auckland"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="postcode">Postcode</Label>
                  <LockedInput
                    canEdit={canEdit}
                    id="postcode"
                    value={postcode}
                    onChange={(event) => setPostcode(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="address-country">Country</Label>
                  <LockedInput
                    canEdit={canEdit}
                    id="address-country"
                    value={addressCountry}
                    onChange={(event) => setAddressCountry(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5" data-timezone-field>
                <Label className="text-xs" htmlFor="company-timezone">Timezone</Label>
                <select
                  id="company-timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  disabled={!canEdit}
                  className="flex h-11 min-h-11 w-full rounded-xl border border-border/80 bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm"
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
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.timezone[0]}
                  </p>
                ) : null}
                <p
                  className="pt-1 text-xs leading-relaxed text-muted-foreground"
                  data-timezone-helper
                >
                  Used to show quote acceptance and send times in your local time.
                  Changing this does not rewrite stored UTC evidence.
                  {currency ? ` Currency stays ${currency}.` : ""}
                </p>
              </div>
            </div>
          </SectionCard>
          {saveFooter(addressDirty)}
        </form>
      ) : null}

      {activeSection === "tax" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const gst = Number(defaultGstRate);
            if (!Number.isFinite(gst) || gst < 0 || gst > 100) {
              setFieldErrors({
                defaultGstRate: ["Enter a GST rate from 0 to 100."],
              });
              setError(null);
              return;
            }
            void persist({
              gstNumber,
              nzbn,
              abn,
              defaultGstRate: gst,
            });
          }}
        >
          <SectionCard
            title="Tax and identifiers"
            description="The GST rate is what Quotes and Variations calculate. The GST number is printed on documents and does not change that calculation."
          >
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="default-gst-rate">Default GST rate %</Label>
                <LockedInput
                  canEdit={canEdit}
                  id="default-gst-rate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={defaultGstRate}
                  onChange={(event) => setDefaultGstRate(event.target.value)}
                  required
                />
                {fieldErrors.defaultGstRate?.[0] ? (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.defaultGstRate[0]}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  0% is valid. Quotes and Variations calculate GST from this rate.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="gst-number">GST number</Label>
                <LockedInput
                  canEdit={canEdit}
                  id="gst-number"
                  value={gstNumber}
                  onChange={(event) => setGstNumber(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional document text. A number here does not mean GST
                  registration is stored, and it does not change the rate.
                </p>
              </div>
              <div className="space-y-1.5">
                {australia ? (
                  <>
                    <Label className="text-xs" htmlFor="abn">ABN</Label>
                    <LockedInput
                      canEdit={canEdit}
                      id="abn"
                      value={abn}
                      onChange={(event) => setAbn(event.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <Label className="text-xs" htmlFor="nzbn">NZBN</Label>
                    <LockedInput
                      canEdit={canEdit}
                      id="nzbn"
                      value={nzbn}
                      onChange={(event) => setNzbn(event.target.value)}
                    />
                  </>
                )}
                <p className="text-xs text-muted-foreground">Optional.</p>
              </div>
            </div>
          </SectionCard>
          {saveFooter(taxDirty)}
        </form>
      ) : null}

      {activeSection === "work" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose the work you usually price. Saving here uses the existing
            work-type preferences and does not change which work an estimate
            can include.
          </p>
          <WorkAreasStep state={setupState} mode="improve" />
        </div>
      ) : null}

      {activeSection === "branding" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void persist({
              logoUrl,
              brandPrimaryColour,
              brandAccentColour,
            });
          }}
        >
          <SectionCard
            title="Branding"
            description="Logo and colours appear on Quotes and Variations. Issued documents keep the branding saved with them."
          >
            <CompanyLogoField
              logoUrl={logoUrl.trim() ? logoUrl : null}
              readOnly={!canEdit}
              onSettingsChange={(next) => {
                setSettings(next);
                setLogoUrl(stored(next.logoUrl));
                setSavedMessage("Company settings saved.");
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ColourField
                id="brand-primary"
                label="Primary colour"
                value={brandPrimaryColour}
                onChange={setBrandPrimaryColour}
                placeholder="#1a1a1a"
                readOnly={!canEdit}
              />
              <ColourField
                id="brand-accent"
                label="Accent colour"
                value={brandAccentColour}
                onChange={setBrandAccentColour}
                placeholder="#2563eb"
                readOnly={!canEdit}
              />
            </div>
            {canEdit ? (
              <details className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2">
                <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]">
                  Advanced — legacy logo link
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Prefer Upload logo above. A webpage link (for example an Imgur
                    page) will not display on quotes — use a direct image file link
                    only if you must.
                  </p>
                  <Label className="text-xs" htmlFor="logo-url">Legacy logo URL</Label>
                  <LockedInput
                    canEdit={canEdit}
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
            ) : null}
          </SectionCard>
          {saveFooter(brandingDirty)}
        </form>
      ) : null}

      {activeSection === "documents" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const days = Number(defaultQuoteValidityDays);
            if (!Number.isInteger(days) || days < 1 || days > 365) {
              setFieldErrors({
                defaultQuoteValidityDays: ["Enter a validity from 1 to 365 days."],
              });
              return;
            }
            void persist({
              defaultQuoteValidityDays: days,
              defaultPaymentTerms,
              defaultQuoteTerms,
              defaultQuoteExclusions,
              defaultQuoteAssumptions,
            });
          }}
        >
          <SectionCard
            title="Document defaults"
            description="Validity and commercial wording copied into new quotes. Existing documents are not changed."
          >
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="default-validity">Default quote validity (days)</Label>
              <LockedInput
                canEdit={canEdit}
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
              />
              {fieldErrors.defaultQuoteValidityDays?.[0] ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.defaultQuoteValidityDays[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="default-payment-terms">Payment terms</Label>
              <LockedTextarea
                canEdit={canEdit}
                id="default-payment-terms"
                value={defaultPaymentTerms}
                onChange={(event) => setDefaultPaymentTerms(event.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="default-quote-terms">Quote terms</Label>
              <LockedTextarea
                canEdit={canEdit}
                id="default-quote-terms"
                value={defaultQuoteTerms}
                onChange={(event) => setDefaultQuoteTerms(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="default-exclusions">Default exclusions</Label>
              <p className="text-[11px] text-muted-foreground">
                One item per line when copied into pricing and quotes.
              </p>
              <LockedTextarea
                canEdit={canEdit}
                id="default-exclusions"
                value={defaultQuoteExclusions}
                onChange={(event) => setDefaultQuoteExclusions(event.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="default-assumptions">Default assumptions</Label>
              <p className="text-[11px] text-muted-foreground">
                One item per line when copied into new documents.
              </p>
              <LockedTextarea
                canEdit={canEdit}
                id="default-assumptions"
                value={defaultQuoteAssumptions}
                onChange={(event) =>
                  setDefaultQuoteAssumptions(event.target.value)
                }
                rows={5}
              />
            </div>
          </SectionCard>
          {saveFooter(documentsDirty)}
        </form>
      ) : null}
    </div>
  );
}

function OverviewItem({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-2">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right text-sm break-words",
          attention && "font-medium text-[var(--brand-orange)]"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
