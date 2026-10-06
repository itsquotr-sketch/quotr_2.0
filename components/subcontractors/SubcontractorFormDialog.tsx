"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SCOPE_CATALOGUE, SCOPE_CATEGORIES } from "@/lib/scopes/catalogue";
import {
  archiveSubcontractor,
  restoreSubcontractor,
  saveSubcontractor,
} from "@/lib/subcontractors/actions";
import { parseServiceRegions } from "@/lib/subcontractors/schema";
import type {
  PreferredContactMethod,
  Subcontractor,
  SubcontractorDocumentKind,
} from "@/lib/subcontractors/types";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_KINDS,
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

type DocumentDraft = {
  key: string;
  id?: string;
  document_kind: SubcontractorDocumentKind;
  title: string;
  reference: string;
  expires_on: string;
  notes: string;
};

function draftKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}-${Math.random()}`;
}

function emptyContact(): ContactDraft {
  return {
    key: draftKey(),
    name: "",
    role: "",
    email: "",
    phone: "",
    is_primary: false,
    preferred_contact: "",
  };
}

function emptyDocument(): DocumentDraft {
  return {
    key: draftKey(),
    document_kind: "licence",
    title: "",
    reference: "",
    expires_on: "",
    notes: "",
  };
}

function contactsFromRecord(subcontractor?: Subcontractor): ContactDraft[] {
  if (!subcontractor || subcontractor.contacts.length === 0) return [];
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

function documentsFromRecord(subcontractor?: Subcontractor): DocumentDraft[] {
  if (!subcontractor) return [];
  return subcontractor.documents.map((document) => ({
    key: document.id,
    id: document.id,
    document_kind: document.document_kind,
    title: document.title,
    reference: document.reference ?? "",
    expires_on: document.expires_on ?? "",
    notes: document.notes ?? "",
  }));
}

function formatStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function expiryPassed(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return value < iso;
}

type SubcontractorFormDialogProps = {
  mode: "create" | "edit";
  subcontractor?: Subcontractor;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
};

export function SubcontractorFormDialog({
  mode,
  subcontractor,
  triggerLabel,
  triggerVariant = mode === "create" ? "default" : "outline",
}: SubcontractorFormDialogProps) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [tradingName, setTradingName] = useState(subcontractor?.trading_name ?? "");
  const [legalName, setLegalName] = useState(subcontractor?.legal_name ?? "");
  const [website, setWebsite] = useState(subcontractor?.website ?? "");
  const [country, setCountry] = useState(subcontractor?.country ?? "");
  const [regions, setRegions] = useState(subcontractor?.service_regions.join(", ") ?? "");
  const [workAreas, setWorkAreas] = useState<string[]>(subcontractor?.work_area_types ?? []);
  const [specialties, setSpecialties] = useState(subcontractor?.specialties ?? "");
  const [notes, setNotes] = useState(subcontractor?.internal_notes ?? "");
  const [pricingMethod, setPricingMethod] = useState(subcontractor?.preferred_pricing_method ?? "");
  const [currency, setCurrency] = useState(subcontractor?.currency ?? "");
  const [abn, setAbn] = useState(subcontractor?.abn ?? "");
  const [gstNumber, setGstNumber] = useState(subcontractor?.gst_number ?? "");
  const [gstNotes, setGstNotes] = useState(subcontractor?.gst_notes ?? "");
  const [minimumCharge, setMinimumCharge] = useState(subcontractor?.minimum_charge_notes ?? "");
  const [travelNotes, setTravelNotes] = useState(subcontractor?.travel_notes ?? "");
  const [contacts, setContacts] = useState<ContactDraft[]>(() => contactsFromRecord(subcontractor));
  const [documents, setDocuments] = useState<DocumentDraft[]>(() => documentsFromRecord(subcontractor));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  function resetFromRecord() {
    setTradingName(subcontractor?.trading_name ?? "");
    setLegalName(subcontractor?.legal_name ?? "");
    setWebsite(subcontractor?.website ?? "");
    setCountry(subcontractor?.country ?? "");
    setRegions(subcontractor?.service_regions.join(", ") ?? "");
    setWorkAreas(subcontractor?.work_area_types ?? []);
    setSpecialties(subcontractor?.specialties ?? "");
    setNotes(subcontractor?.internal_notes ?? "");
    setPricingMethod(subcontractor?.preferred_pricing_method ?? "");
    setCurrency(subcontractor?.currency ?? "");
    setAbn(subcontractor?.abn ?? "");
    setGstNumber(subcontractor?.gst_number ?? "");
    setGstNotes(subcontractor?.gst_notes ?? "");
    setMinimumCharge(subcontractor?.minimum_charge_notes ?? "");
    setTravelNotes(subcontractor?.travel_notes ?? "");
    setContacts(contactsFromRecord(subcontractor));
    setDocuments(documentsFromRecord(subcontractor));
    setError(null);
    setFieldErrors({});
  }

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (next) resetFromRecord();
    setOpen(next);
  }

  function toggleWorkArea(type: string) {
    setWorkAreas((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
  }

  function updateContact(key: string, patch: Partial<ContactDraft>) {
    setContacts((current) =>
      current.map((contact) => (contact.key === key ? { ...contact, ...patch } : contact))
    );
  }

  function setPrimary(key: string) {
    setContacts((current) =>
      current.map((contact) => ({
        ...contact,
        is_primary: contact.key === key ? !contact.is_primary : false,
      }))
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const preparedContacts = contacts.filter((contact) => {
      const filled = [contact.name, contact.role, contact.email, contact.phone, contact.preferred_contact]
        .some((value) => value.trim().length > 0);
      return filled || contact.is_primary;
    });
    const incomplete = preparedContacts.find((contact) => contact.name.trim().length === 0);
    if (incomplete) {
      setError("Each contact needs a name. Email and phone can be shared or left blank.");
      return;
    }
    const incompleteDocument = documents.find((document) => document.title.trim().length === 0);
    if (incompleteDocument) {
      setError("Each document needs a title. You can leave the file itself for later.");
      return;
    }

    setPending(true);
    const result = await saveSubcontractor({
      id: subcontractor?.id,
      trading_name: tradingName,
      legal_name: legalName,
      website,
      country,
      service_regions: parseServiceRegions(regions),
      work_area_types: workAreas,
      specialties,
      internal_notes: notes,
      preferred_pricing_method: pricingMethod || undefined,
      currency,
      abn,
      gst_number: gstNumber,
      gst_notes: gstNotes,
      minimum_charge_notes: minimumCharge,
      travel_notes: travelNotes,
      contacts: preparedContacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        is_primary: contact.is_primary,
        preferred_contact: contact.preferred_contact || undefined,
      })),
      documents: documents.map((document) => ({
        id: document.id,
        document_kind: document.document_kind,
        title: document.title,
        reference: document.reference,
        expires_on: document.expires_on,
        notes: document.notes,
      })),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const title = mode === "create" ? "New subcontractor" : "Edit subcontractor";
  const created = subcontractor ? formatStamp(subcontractor.created_at) : "";
  const updated = subcontractor ? formatStamp(subcontractor.updated_at) : "";
  const errorList = Object.entries(fieldErrors).flatMap(([key, messages]) =>
    (messages ?? []).map((message) => `${key}: ${message}`)
  );

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size="touch"
        onClick={() => handleOpenChange(true)}
      >
        {triggerLabel ?? title}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Trading name is required. Contacts can share an email or phone. Commercial details and document dates are saved as supplied and are not verified.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
            {error ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {errorList.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {errorList.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}

            {mode === "edit" && created ? (
              <p className="text-sm text-muted-foreground">
                Added {created}
                {updated ? ` · Updated ${updated}` : ""}
              </p>
            ) : null}

            <section className="space-y-4">
              <h3 className="text-sm font-medium">Business</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs" htmlFor={`${formId}-trading`}>Trading name</Label>
                  <Input
                    id={`${formId}-trading`}
                    value={tradingName}
                    onChange={(event) => setTradingName(event.target.value)}
                    className={fieldClass}
                    required
                    maxLength={160}
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-legal`}>Legal name</Label>
                  <Input id={`${formId}-legal`} value={legalName} onChange={(event) => setLegalName(event.target.value)} className={fieldClass} maxLength={160} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-website`}>Website</Label>
                  <Input id={`${formId}-website`} value={website} onChange={(event) => setWebsite(event.target.value)} className={fieldClass} maxLength={300} inputMode="url" autoComplete="url" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-country`}>Country</Label>
                  <Input id={`${formId}-country`} value={country} onChange={(event) => setCountry(event.target.value)} className={fieldClass} maxLength={80} autoComplete="country-name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-regions`}>Service regions</Label>
                  <Input id={`${formId}-regions`} value={regions} onChange={(event) => setRegions(event.target.value)} className={fieldClass} placeholder="Separate regions with commas" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs" htmlFor={`${formId}-specialties`}>Specialties</Label>
                  <Input id={`${formId}-specialties`} value={specialties} onChange={(event) => setSpecialties(event.target.value)} className={fieldClass} maxLength={500} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs" htmlFor={`${formId}-notes`}>Internal notes</Label>
                  <Textarea id={`${formId}-notes`} value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24" maxLength={5000} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Work areas</h3>
                <p className="text-sm text-muted-foreground">
                  Used later to suggest this business for a job. A work area is not a rate or a quotation.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {SCOPE_CATEGORIES.map((category) => (
                  <fieldset key={category} className="min-w-0">
                    <legend className="px-0.5 text-xs font-medium text-muted-foreground">{category}</legend>
                    <div className="mt-1">
                      {SCOPE_CATALOGUE.filter((item) => item.category === category).map((item) => (
                        <label key={item.type} className="flex min-h-11 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={workAreas.includes(item.type)}
                            onChange={() => toggleWorkArea(item.type)}
                            className="size-4 accent-[var(--brand-orange)]"
                          />
                          <span className="min-w-0 break-words">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">People</h3>
                <Button type="button" variant="outline" size="touch" onClick={() => setContacts((current) => [...current, emptyContact()])}>
                  Add contact
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Several people can share one office email or phone. Neither has to be unique.
              </p>
              {contacts.length === 0 ? (
                <p className="rounded-xl border border-border/60 bg-card px-4 py-6 text-sm text-muted-foreground">
                  No contacts yet. You can save the business and add people later.
                </p>
              ) : null}
              {contacts.map((contact, index) => (
                <div key={contact.key} className="min-w-0 space-y-3 rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Contact {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="touch"
                      onClick={() => setContacts((current) => current.filter((item) => item.key !== contact.key))}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor={`${formId}-contact-name-${contact.key}`}>Name</Label>
                      <Input id={`${formId}-contact-name-${contact.key}`} value={contact.name} onChange={(event) => updateContact(contact.key, { name: event.target.value })} className={fieldClass} maxLength={160} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor={`${formId}-contact-role-${contact.key}`}>Role</Label>
                      <Input id={`${formId}-contact-role-${contact.key}`} value={contact.role} onChange={(event) => updateContact(contact.key, { role: event.target.value })} className={fieldClass} maxLength={80} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor={`${formId}-contact-email-${contact.key}`}>Email</Label>
                      <Input id={`${formId}-contact-email-${contact.key}`} value={contact.email} onChange={(event) => updateContact(contact.key, { email: event.target.value })} className={fieldClass} maxLength={254} inputMode="email" autoComplete="off" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor={`${formId}-contact-phone-${contact.key}`}>Phone</Label>
                      <Input id={`${formId}-contact-phone-${contact.key}`} value={contact.phone} onChange={(event) => updateContact(contact.key, { phone: event.target.value })} className={fieldClass} maxLength={40} inputMode="tel" autoComplete="off" />
                    </div>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={contact.is_primary}
                        onChange={() => setPrimary(contact.key)}
                        className="size-4 accent-[var(--brand-orange)]"
                      />
                      Primary contact
                    </label>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor={`${formId}-contact-preferred-${contact.key}`}>Preferred contact</Label>
                      <select
                        id={`${formId}-contact-preferred-${contact.key}`}
                        value={contact.preferred_contact}
                        onChange={(event) => updateContact(contact.key, { preferred_contact: event.target.value as ContactDraft["preferred_contact"] })}
                        className={selectClass}
                      >
                        <option value="">No preference</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="either">Either</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">Commercial details</h3>
                <Badge variant="outline">Not verified</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Optional notes for your team. Quotr does not check ABN or GST details and does not use them as rates.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-pricing`}>Preferred pricing method</Label>
                  <select id={`${formId}-pricing`} value={pricingMethod} onChange={(event) => setPricingMethod(event.target.value as typeof pricingMethod)} className={selectClass}>
                    <option value="">Not supplied</option>
                    {SUBCONTRACTOR_PRICING_METHODS.map((method) => (
                      <option key={method} value={method}>{SUBCONTRACTOR_PRICING_LABELS[method]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-currency`}>Currency</Label>
                  <Input id={`${formId}-currency`} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className={fieldClass} maxLength={3} placeholder="AUD" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-abn`}>ABN</Label>
                  <Input id={`${formId}-abn`} value={abn} onChange={(event) => setAbn(event.target.value)} className={fieldClass} maxLength={20} autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-gst`}>GST number</Label>
                  <Input id={`${formId}-gst`} value={gstNumber} onChange={(event) => setGstNumber(event.target.value)} className={fieldClass} maxLength={20} autoComplete="off" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs" htmlFor={`${formId}-gst-notes`}>GST notes</Label>
                  <Textarea id={`${formId}-gst-notes`} value={gstNotes} onChange={(event) => setGstNotes(event.target.value)} className="min-h-20" maxLength={2000} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-minimum`}>Minimum charge notes</Label>
                  <Textarea id={`${formId}-minimum`} value={minimumCharge} onChange={(event) => setMinimumCharge(event.target.value)} className="min-h-20" maxLength={2000} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${formId}-travel`}>Travel notes</Label>
                  <Textarea id={`${formId}-travel`} value={travelNotes} onChange={(event) => setTravelNotes(event.target.value)} className="min-h-20" maxLength={2000} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Licences and insurance</h3>
                <Button type="button" variant="outline" size="touch" onClick={() => setDocuments((current) => [...current, emptyDocument()])}>
                  Add document
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Record the name and expiry only. Uploading the file is not part of this directory.
              </p>
              {documents.length === 0 ? (
                <p className="rounded-xl border border-border/60 bg-card px-4 py-6 text-sm text-muted-foreground">
                  No document details yet.
                </p>
              ) : null}
              {documents.map((document, index) => (
                <div key={document.key} className="min-w-0 space-y-3 rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Document {index + 1}</p>
                    <div className="flex items-center gap-2">
                      {expiryPassed(document.expires_on) ? <Badge variant="secondary">Expiry passed</Badge> : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="touch"
                        onClick={() => setDocuments((current) => current.filter((item) => item.key !== document.key))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor={`${formId}-doc-kind-${document.key}`}>Type</Label>
                      <select
                        id={`${formId}-doc-kind-${document.key}`}
                        value={document.document_kind}
                        onChange={(event) => setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, document_kind: event.target.value as SubcontractorDocumentKind } : item))}
                        className={selectClass}
                      >
                        {DOCUMENT_KINDS.map((kind) => (
                          <option key={kind} value={kind}>{DOCUMENT_KIND_LABELS[kind]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor={`${formId}-doc-title-${document.key}`}>Title</Label>
                      <Input id={`${formId}-doc-title-${document.key}`} value={document.title} onChange={(event) => setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, title: event.target.value } : item))} className={fieldClass} maxLength={160} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor={`${formId}-doc-ref-${document.key}`}>Reference</Label>
                      <Input id={`${formId}-doc-ref-${document.key}`} value={document.reference} onChange={(event) => setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, reference: event.target.value } : item))} className={fieldClass} maxLength={80} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor={`${formId}-doc-expiry-${document.key}`}>Expiry date</Label>
                      <Input id={`${formId}-doc-expiry-${document.key}`} type="date" value={document.expires_on} onChange={(event) => setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, expires_on: event.target.value } : item))} className={fieldClass} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs" htmlFor={`${formId}-doc-notes-${document.key}`}>Notes</Label>
                      <Textarea id={`${formId}-doc-notes-${document.key}`} value={document.notes} onChange={(event) => setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, notes: event.target.value } : item))} className="min-h-20" maxLength={2000} />
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" size="touch" className="w-full sm:w-auto" onClick={() => handleOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" size="touch" className="w-full sm:w-auto" disabled={pending || !tradingName.trim()}>
                {pending ? "Saving…" : mode === "create" ? "Save subcontractor" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ArchiveSubcontractorButton({
  subcontractor,
}: {
  subcontractor: Subcontractor;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmArchive() {
    setPending(true);
    setError(null);
    const result = await archiveSubcontractor(subcontractor.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" size="touch" onClick={() => setOpen(true)}>
        Archive
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="break-words">Archive {subcontractor.trading_name}?</DialogTitle>
            <DialogDescription>
              The business and its contacts stay on record. Archive only hides them from the active directory. Nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" className="w-full sm:w-auto" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="touch" className="w-full sm:w-auto" onClick={() => void confirmArchive()} disabled={pending}>
              {pending ? "Archiving…" : "Archive subcontractor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RestoreSubcontractorButton({ subcontractorId }: { subcontractorId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setPending(true);
    setError(null);
    const result = await restoreSubcontractor(subcontractorId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="touch" onClick={() => void restore()} disabled={pending}>
        {pending ? "Restoring…" : "Restore"}
      </Button>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
