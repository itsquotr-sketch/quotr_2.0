"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { WorkAreaPicker } from "@/components/subcontractors/WorkAreaPicker";
import { saveSubcontractor } from "@/lib/subcontractors/actions";
import type { SubcontractorCountryCode } from "@/lib/subcontractors/types";
import { SUBCONTRACTOR_COUNTRY_CODES, SUBCONTRACTOR_COUNTRY_LABELS } from "@/lib/subcontractors/types";

const fieldClass = "min-h-11";
const selectClass =
  "h-11 min-h-11 w-full min-w-0 rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

type SubcontractorCreateDialogProps = {
  organisationCountry: SubcontractorCountryCode | null;
  triggerLabel?: string;
};

export function SubcontractorCreateDialog({
  organisationCountry,
  triggerLabel = "New subcontractor",
}: SubcontractorCreateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradingName, setTradingName] = useState("");
  const [country, setCountry] = useState<SubcontractorCountryCode | "">(
    organisationCountry ?? ""
  );
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [workAreas, setWorkAreas] = useState<string[]>([]);
  const [services, setServices] = useState("");

  function reset() {
    setTradingName("");
    setCountry(organisationCountry ?? "");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setWorkAreas([]);
    setServices("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const name = contactName.trim();
    const email = contactEmail.trim();
    const phone = contactPhone.trim();
    if ((email || phone) && !name) {
      setError("Enter a name for the primary contact, or leave the contact blank.");
      return;
    }
    if (!country) {
      setError("Choose a country.");
      return;
    }
    setPending(true);
    const result = await saveSubcontractor({
      trading_name: tradingName,
      country_code: country,
      work_area_types: workAreas,
      service_regions: [],
      service_region_other_labels: [],
      specialties: services,
      contacts:
        name.length > 0
          ? [{ name, email, phone, is_primary: true, preferred_contact: email ? "email" : phone ? "phone" : "either" }]
          : [],
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
    if (!result.id) {
      setError("Could not open the new subcontractor. Please try again.");
      return;
    }
    setOpen(false);
    reset();
    router.push(`/app/contacts/subcontractors/${result.id}`);
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="touch" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain sm:max-w-lg" data-subcontractor-create-dialog>
          <DialogHeader>
            <DialogTitle>New subcontractor</DialogTitle>
            <DialogDescription>
              Start with the business name. People, address, documents, and commercial details can be added on the profile.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="new-subcontractor-name">Trading name</Label>
              <Input
                id="new-subcontractor-name"
                value={tradingName}
                onChange={(event) => setTradingName(event.target.value)}
                className={fieldClass}
                maxLength={160}
                required
                autoComplete="organization"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-subcontractor-country">Country</Label>
              <select
                id="new-subcontractor-country"
                value={country}
                onChange={(event) => setCountry(event.target.value as SubcontractorCountryCode | "")}
                className={selectClass}
                required
              >
                <option value="">Select a country</option>
                {SUBCONTRACTOR_COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {SUBCONTRACTOR_COUNTRY_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Primary contact (optional)</legend>
              <p className="text-sm text-muted-foreground">
                More than one person can share an email or phone. Add them on the profile.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="new-subcontractor-contact-name">Name</Label>
                <Input
                  id="new-subcontractor-contact-name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  className={fieldClass}
                  maxLength={160}
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-subcontractor-contact-email">Email</Label>
                  <Input
                    id="new-subcontractor-contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    className={fieldClass}
                    maxLength={254}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-subcontractor-contact-phone">Phone</Label>
                  <Input
                    id="new-subcontractor-contact-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    className={fieldClass}
                    maxLength={40}
                    autoComplete="tel"
                  />
                </div>
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Work areas (optional)</legend>
              <p className="text-sm text-muted-foreground">
                Broad tags help you find this business later. They are not prices.
              </p>
              <WorkAreaPicker selected={workAreas} onChange={setWorkAreas} />
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="new-subcontractor-services">Services offered (optional)</Label>
              <Input
                id="new-subcontractor-services"
                value={services}
                onChange={(event) => setServices(event.target.value)}
                className={fieldClass}
                maxLength={500}
                placeholder="Other work, including work Quotr does not calculate"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="touch"
                className="w-full sm:w-auto"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" size="touch" className="w-full sm:w-auto" disabled={pending || !tradingName.trim()}>
                {pending ? "Saving…" : "Save subcontractor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
