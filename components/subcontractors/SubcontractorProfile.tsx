"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BusinessLocationFields } from "@/components/subcontractors/BusinessLocationFields";
import { ServiceRegionPicker } from "@/components/subcontractors/ServiceRegionPicker";
import {
  ArchiveSubcontractorButton,
  RestoreSubcontractorButton,
} from "@/components/subcontractors/SubcontractorFormDialog";
import { SubcontractorDocuments } from "@/components/subcontractors/SubcontractorDocuments";
import { WorkAreaPicker } from "@/components/subcontractors/WorkAreaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveSubcontractor } from "@/lib/subcontractors/actions";
import { retainRegionsForCountry } from "@/lib/subcontractors/regions";
import type {
  GstRegistration,
  PreferredContactMethod,
  Subcontractor,
  SubcontractorCountryCode,
  SubcontractorPricingMethod,
} from "@/lib/subcontractors/types";
import {
  GST_REGISTRATIONS,
  PREFERRED_CONTACT_METHODS,
  SUBCONTRACTOR_COUNTRY_CODES,
  SUBCONTRACTOR_COUNTRY_LABELS,
  SUBCONTRACTOR_PRICING_LABELS,
  SUBCONTRACTOR_PRICING_METHODS,
} from "@/lib/subcontractors/types";

const fieldClass = "min-h-11";
const selectClass =
  "h-11 min-h-11 w-full min-w-0 rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

type ContactDraft = {
  key: string;
  id?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  is_primary: boolean;
  preferred_contact: "" | PreferredContactMethod;
};

function draftKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `contact-${Date.now()}-${Math.random()}`;
}

function contactsFromRecord(subcontractor: Subcontractor): ContactDraft[] {
  return subcontractor.contacts.map((contact) => ({
    key: contact.id,
    id: contact.id,
    name: contact.name,
    role: contact.role ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    is_primary: contact.is_primary,
    preferred_contact: contact.preferred_contact ?? "",
  }));
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4">
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SubcontractorProfile({
  subcontractor,
  canEdit,
}: {
  subcontractor: Subcontractor;
  canEdit: boolean;
}) {
  const router = useRouter();
  const archived = Boolean(subcontractor.archived_at);
  const locked = !canEdit || archived;
  const [tradingName, setTradingName] = useState(subcontractor.trading_name);
  const [legalName, setLegalName] = useState(subcontractor.legal_name ?? "");
  const [website, setWebsite] = useState(subcontractor.website ?? "");
  const [country, setCountry] = useState<SubcontractorCountryCode | "">(
    subcontractor.country_code ?? ""
  );
  const [address, setAddress] = useState({
    address_line_1: subcontractor.address_line_1 ?? "",
    address_line_2: subcontractor.address_line_2 ?? "",
    address_city: subcontractor.address_city ?? "",
    address_region: subcontractor.address_region ?? "",
    address_postcode: subcontractor.address_postcode ?? "",
  });
  const [regions, setRegions] = useState(subcontractor.service_regions);
  const [otherLabels, setOtherLabels] = useState(subcontractor.service_region_other_labels);
  const [workAreas, setWorkAreas] = useState(subcontractor.work_area_types);
  const [services, setServices] = useState(subcontractor.specialties ?? "");
  const [notes, setNotes] = useState(subcontractor.internal_notes ?? "");
  const [contacts, setContacts] = useState<ContactDraft[]>(() => contactsFromRecord(subcontractor));
  const [pricing, setPricing] = useState<SubcontractorPricingMethod | "">(
    subcontractor.preferred_pricing_method ?? ""
  );
  const [currency, setCurrency] = useState(subcontractor.currency ?? "");
  const [abn, setAbn] = useState(subcontractor.abn ?? "");
  const [nzbn, setNzbn] = useState(subcontractor.nzbn ?? "");
  const [gstRegistration, setGstRegistration] = useState<GstRegistration>(
    subcontractor.gst_registration ?? "unknown"
  );
  const [gstNumber, setGstNumber] = useState(subcontractor.gst_number ?? "");
  const [minimum, setMinimum] = useState(subcontractor.minimum_charge_notes ?? "");
  const [travel, setTravel] = useState(subcontractor.travel_notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeCountry(next: SubcontractorCountryCode | "") {
    setCountry(next);
    if (!next) return;
    const retained = retainRegionsForCountry(next, regions, otherLabels);
    setRegions(retained.selected);
    setOtherLabels(retained.otherLabels);
  }

  function updateContact(key: string, patch: Partial<ContactDraft>) {
    setContacts((current) =>
      current.map((contact) => (contact.key === key ? { ...contact, ...patch } : contact))
    );
  }

  function makePrimary(key: string) {
    setContacts((current) =>
      current.map((contact) => ({ ...contact, is_primary: contact.key === key }))
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (locked) return;
    setError(null);
    setPending(true);
    const result = await saveSubcontractor({
      id: subcontractor.id,
      trading_name: tradingName,
      legal_name: legalName,
      website,
      country_code: country || undefined,
      ...address,
      service_regions: regions,
      service_region_other_labels: otherLabels,
      work_area_types: workAreas,
      specialties: services,
      internal_notes: notes,
      preferred_pricing_method: pricing || undefined,
      currency,
      abn,
      nzbn,
      gst_registration: gstRegistration,
      gst_number: gstNumber,
      minimum_charge_notes: minimum,
      travel_notes: travel,
      contacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        is_primary: contact.is_primary,
        preferred_contact: contact.preferred_contact || undefined,
      })),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.fieldErrors) {
      setError(Object.values(result.fieldErrors).flat()[0] ?? "Check the form and try again.");
      return;
    }
    router.refresh();
  }

  return (
    <form className="flex min-w-0 flex-col gap-4" data-subcontractor-profile onSubmit={(event) => void save(event)}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={archived ? "/app/contacts/subcontractors?archived=1" : "/app/contacts/subcontractors"}
            className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-2 hover:underline"
          >
            Back to subcontractors
          </Link>
          <h2 className="break-words text-xl font-semibold">{tradingName || subcontractor.trading_name}</h2>
          {archived ? (
            <p className="mt-1 text-sm text-muted-foreground">
              This business is archived. Restore it before editing.
            </p>
          ) : null}
        </div>
        {canEdit ? (
          archived ? (
            <RestoreSubcontractorButton subcontractorId={subcontractor.id} />
          ) : (
            <ArchiveSubcontractorButton subcontractor={subcontractor} />
          )
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Section
        title="Business and address"
        description="The address is where the business is based. Service regions are chosen separately."
      >
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="profile-trading-name">Trading name</Label>
            <Input
              id="profile-trading-name"
              value={tradingName}
              onChange={(event) => setTradingName(event.target.value)}
              className={fieldClass}
              maxLength={160}
              required
              disabled={locked}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-legal-name">Legal name (optional)</Label>
              <Input
                id="profile-legal-name"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                className={fieldClass}
                maxLength={160}
                disabled={locked}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-website">Website (optional)</Label>
              <Input
                id="profile-website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                className={fieldClass}
                maxLength={300}
                disabled={locked}
              />
            </div>
          </div>
          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor="profile-country">Country</Label>
            <select
              id="profile-country"
              value={country}
              onChange={(event) => changeCountry(event.target.value as SubcontractorCountryCode | "")}
              className={selectClass}
              disabled={locked}
            >
              <option value="">Select a country</option>
              {SUBCONTRACTOR_COUNTRY_CODES.map((code) => (
                <option key={code} value={code}>
                  {SUBCONTRACTOR_COUNTRY_LABELS[code]}
                </option>
              ))}
            </select>
          </div>
          <BusinessLocationFields
            country={country || null}
            value={address}
            onChange={setAddress}
            disabled={locked}
          />
        </div>
      </Section>

      <Section
        title="People"
        description="Add the people you contact. Email and phone do not have to be unique."
      >
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {contacts.map((contact, index) => (
              <div key={contact.key} className="min-w-0 rounded-xl border border-border/70 p-3" data-subcontractor-contact>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Contact {index + 1}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="touch"
                    disabled={locked}
                    onClick={() => setContacts((current) => current.filter((item) => item.key !== contact.key))}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`contact-name-${contact.key}`}>Name</Label>
                    <Input
                      id={`contact-name-${contact.key}`}
                      value={contact.name}
                      onChange={(event) => updateContact(contact.key, { name: event.target.value })}
                      className={fieldClass}
                      maxLength={160}
                      disabled={locked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-role-${contact.key}`}>Role</Label>
                    <Input
                      id={`contact-role-${contact.key}`}
                      value={contact.role}
                      onChange={(event) => updateContact(contact.key, { role: event.target.value })}
                      className={fieldClass}
                      maxLength={80}
                      disabled={locked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-preferred-${contact.key}`}>Preferred contact</Label>
                    <select
                      id={`contact-preferred-${contact.key}`}
                      value={contact.preferred_contact}
                      onChange={(event) =>
                        updateContact(contact.key, {
                          preferred_contact: event.target.value as ContactDraft["preferred_contact"],
                        })
                      }
                      className={selectClass}
                      disabled={locked}
                    >
                      <option value="">No preference</option>
                      {PREFERRED_CONTACT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method === "either" ? "Either" : method === "email" ? "Email" : "Phone"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-email-${contact.key}`}>Email</Label>
                    <Input
                      id={`contact-email-${contact.key}`}
                      type="email"
                      value={contact.email}
                      onChange={(event) => updateContact(contact.key, { email: event.target.value })}
                      className={fieldClass}
                      maxLength={254}
                      disabled={locked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-phone-${contact.key}`}>Phone</Label>
                    <Input
                      id={`contact-phone-${contact.key}`}
                      type="tel"
                      value={contact.phone}
                      onChange={(event) => updateContact(contact.key, { phone: event.target.value })}
                      className={fieldClass}
                      maxLength={40}
                      disabled={locked}
                    />
                  </div>
                </div>
                <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="primary-contact"
                    checked={contact.is_primary}
                    onChange={() => makePrimary(contact.key)}
                    disabled={locked}
                    className="size-4 accent-[var(--brand-orange)]"
                  />
                  Primary contact
                </label>
              </div>
            ))}
          </div>
        )}
        {canEdit && !archived ? (
          <Button
            type="button"
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() =>
              setContacts((current) => [
                ...current,
                {
                  key: draftKey(),
                  name: "",
                  role: "",
                  email: "",
                  phone: "",
                  is_primary: current.length === 0,
                  preferred_contact: "",
                },
              ])
            }
          >
            Add contact
          </Button>
        ) : null}
      </Section>

      <Section
        title="Capabilities and service regions"
        description="Work areas suggest this business for a later request. Services offered describe the work and are never prices."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Work areas</p>
            <WorkAreaPicker selected={workAreas} onChange={setWorkAreas} disabled={locked} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-services">Services offered</Label>
            <Textarea
              id="profile-services"
              value={services}
              onChange={(event) => setServices(event.target.value)}
              className="min-h-24"
              maxLength={500}
              disabled={locked}
              placeholder="Describe the work, including work Quotr does not calculate"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Service regions</p>
            <p className="text-sm text-muted-foreground">
              {country === "AU"
                ? "States and territories this business will travel to."
                : country === "NZ"
                  ? "Regions this business will travel to."
                  : "Choose a country to pick service regions."}
            </p>
            <ServiceRegionPicker
              country={country || null}
              selected={regions}
              otherLabels={otherLabels}
              onChange={(next) => {
                setRegions(next.selected);
                setOtherLabels(next.otherLabels);
              }}
              disabled={locked}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Documents"
        description="Licences, insurance, capability statements, and rate schedules stay private to your organisation."
      >
        <SubcontractorDocuments
          subcontractorId={subcontractor.id}
          documents={subcontractor.documents}
          canEdit={canEdit && !archived}
        />
      </Section>

      <Section
        title="Commercial preferences"
        description="Optional notes about how this business prefers to price work. They do not change Quote GST or supplier rates."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-pricing">Preferred pricing method</Label>
            <select
              id="profile-pricing"
              value={pricing}
              onChange={(event) => setPricing(event.target.value as SubcontractorPricingMethod | "")}
              className={selectClass}
              disabled={locked}
            >
              <option value="">No preference</option>
              {SUBCONTRACTOR_PRICING_METHODS.map((method) => (
                <option key={method} value={method}>
                  {SUBCONTRACTOR_PRICING_LABELS[method]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-currency">Currency</Label>
            <Input
              id="profile-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              className={fieldClass}
              maxLength={3}
              placeholder="NZD"
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-gst">GST registration</Label>
            <select
              id="profile-gst"
              value={gstRegistration}
              onChange={(event) => setGstRegistration(event.target.value as GstRegistration)}
              className={selectClass}
              disabled={locked}
            >
              {GST_REGISTRATIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "yes" ? "Yes" : value === "no" ? "No" : "Unknown"}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">
              Choose yes, no, or unknown. This is not taken from the NZBN or ABN.
            </p>
          </div>
          {gstRegistration === "yes" ? (
            <div className="space-y-1.5">
              <Label htmlFor="profile-gst-number">GST number (optional)</Label>
              <Input
                id="profile-gst-number"
                value={gstNumber}
                onChange={(event) => setGstNumber(event.target.value)}
                className={fieldClass}
                maxLength={20}
                disabled={locked}
              />
            </div>
          ) : null}
          {country === "NZ" ? (
            <div className="space-y-1.5">
              <Label htmlFor="profile-nzbn">NZBN (optional)</Label>
              <Input
                id="profile-nzbn"
                value={nzbn}
                onChange={(event) => setNzbn(event.target.value)}
                className={fieldClass}
                maxLength={20}
                disabled={locked}
              />
            </div>
          ) : null}
          {country === "AU" ? (
            <div className="space-y-1.5">
              <Label htmlFor="profile-abn">ABN (optional)</Label>
              <Input
                id="profile-abn"
                value={abn}
                onChange={(event) => setAbn(event.target.value)}
                className={fieldClass}
                maxLength={20}
                disabled={locked}
              />
            </div>
          ) : null}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="profile-minimum">Minimum charge notes</Label>
            <Textarea
              id="profile-minimum"
              value={minimum}
              onChange={(event) => setMinimum(event.target.value)}
              className="min-h-20"
              maxLength={2000}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="profile-travel">Travel notes</Label>
            <Textarea
              id="profile-travel"
              value={travel}
              onChange={(event) => setTravel(event.target.value)}
              className="min-h-20"
              maxLength={2000}
              disabled={locked}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Internal notes"
        description="Only people in your organisation can see these notes."
      >
        <Textarea
          id="profile-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-28"
          maxLength={5000}
          disabled={locked}
          aria-label="Internal notes"
        />
      </Section>

      {canEdit && !archived ? (
        <div className="flex justify-end">
          <Button type="submit" size="touch" disabled={pending || !tradingName.trim()}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
