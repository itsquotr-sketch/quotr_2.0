"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  archiveCustomer,
  createCustomer,
  restoreCustomer,
  updateCustomer,
} from "@/lib/customers/actions";
import type { Customer } from "@/lib/customers/types";
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

const fieldClass = "min-h-11";

type CustomerFormDialogProps = {
  mode: "create" | "edit";
  customer?: Customer;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerClassName?: string;
};

export function CustomerFormDialog({
  mode,
  customer,
  triggerLabel,
  triggerVariant = mode === "create" ? "default" : "outline",
  triggerClassName,
}: CustomerFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  function resetFromCustomer() {
    setName(customer?.name ?? "");
    setEmail(customer?.email ?? "");
    setPhone(customer?.phone ?? "");
    setNotes(customer?.notes ?? "");
    setError(null);
    setFieldErrors({});
  }

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (next) resetFromCustomer();
    setOpen(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);
    const payload = { name, email, phone, notes };
    const result =
      mode === "create"
        ? await createCustomer(payload)
        : await updateCustomer(customer?.id ?? "", payload);
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

  const title = mode === "create" ? "New customer" : "Edit customer";

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size="touch"
        className={triggerClassName}
        onClick={() => handleOpenChange(true)}
      >
        {triggerLabel ?? title}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Customer details help fill new projects. Existing projects and issued documents keep their saved details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
            {error ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor={`${mode}-customer-name`}>Customer name</Label>
              <Input
                id={`${mode}-customer-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={160}
                autoComplete="name"
                className={fieldClass}
              />
              {fieldErrors.name?.[0] ? (
                <p className="text-sm text-destructive" role="alert">{fieldErrors.name[0]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor={`${mode}-customer-email`}>
                Email <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${mode}-customer-email`}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                className={fieldClass}
              />
              {fieldErrors.email?.[0] ? (
                <p className="text-sm text-destructive" role="alert">{fieldErrors.email[0]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor={`${mode}-customer-phone`}>
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${mode}-customer-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={40}
                className={fieldClass}
              />
              {fieldErrors.phone?.[0] ? (
                <p className="text-sm text-destructive" role="alert">{fieldErrors.phone[0]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor={`${mode}-customer-notes`}>Internal notes</Label>
              <Textarea
                id={`${mode}-customer-notes`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={5000}
                rows={3}
              />
              {fieldErrors.notes?.[0] ? (
                <p className="text-sm text-destructive" role="alert">{fieldErrors.notes[0]}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="touch" className="w-full sm:w-auto" onClick={() => handleOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" size="touch" className="w-full sm:w-auto" disabled={pending || !name.trim()}>
                {pending ? "Saving…" : mode === "create" ? "Save customer" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ArchiveCustomerButton({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmArchive() {
    setPending(true);
    setError(null);
    const result = await archiveCustomer(customer.id);
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
            <DialogTitle>Archive {customer.name}?</DialogTitle>
            <DialogDescription>
              Existing projects stay linked and keep their saved details. This
              customer will not be offered when you start a new job.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" className="w-full sm:w-auto" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="touch" className="w-full sm:w-auto" onClick={() => void confirmArchive()} disabled={pending}>
              {pending ? "Archiving…" : "Archive customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RestoreCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setPending(true);
    setError(null);
    const result = await restoreCustomer(customerId);
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
