"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { updateProject } from "@/lib/projects/actions";
import { getCustomerOption, listSelectableCustomers } from "@/lib/customers/actions";
import type { CustomerOption } from "@/lib/customers/types";
import { CustomerPicker } from "@/components/customers/CustomerPicker";
import type { Project, ProjectPriority } from "@/lib/projects/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const PRIORITY_OPTIONS: { value: ProjectPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const selectClassName = cn(
  "h-11 min-h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
);

type EditProjectDialogProps = {
  project: Project;
  triggerLabel?: string;
  triggerClassName?: string;
};

function projectToFormState(project: Project) {
  return {
    title: project.title,
    clientName: project.client_name ?? "",
    clientEmail: project.client_email ?? "",
    siteAddress: project.site_address ?? "",
    briefText: project.brief_text ?? "",
    priority: project.priority,
    dueDate: project.due_date ?? "",
    notes: project.notes ?? "",
    customerId: project.customer_id ?? null,
    linkMode: project.customer_id ? "existing" : "none",
  } as const;
}

export function EditProjectDialog({
  project,
  triggerLabel = "Edit project",
  triggerClassName,
}: EditProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [clientName, setClientName] = useState(project.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(project.client_email ?? "");
  const [siteAddress, setSiteAddress] = useState(project.site_address ?? "");
  const [briefText, setBriefText] = useState(project.brief_text ?? "");
  const [priority, setPriority] = useState<ProjectPriority>(project.priority);
  const [dueDate, setDueDate] = useState(project.due_date ?? "");
  const [notes, setNotes] = useState(project.notes ?? "");
  const [linkMode, setLinkMode] = useState<"existing" | "none">(
    project.customer_id ? "existing" : "none"
  );
  const [customerId, setCustomerId] = useState<string | null>(project.customer_id ?? null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [linkedCustomer, setLinkedCustomer] = useState<CustomerOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  function resetFormFromProject() {
    const form = projectToFormState(project);
    setTitle(form.title);
    setClientName(form.clientName);
    setClientEmail(form.clientEmail);
    setSiteAddress(form.siteAddress);
    setBriefText(form.briefText);
    setPriority(form.priority);
    setDueDate(form.dueDate);
    setNotes(form.notes);
    setLinkMode(form.linkMode);
    setCustomerId(form.customerId);
    setLinkedCustomer(null);
    setError(null);
    setFieldErrors({});
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listSelectableCustomers().then((rows) => {
      if (!cancelled) setCustomers(rows);
    });
    const currentId = project.customer_id;
    if (!currentId) {
      return () => {
        cancelled = true;
      };
    }
    void getCustomerOption(currentId).then((customer) => {
      if (!cancelled) setLinkedCustomer(customer);
    });
    return () => {
      cancelled = true;
    };
  }, [open, project.customer_id]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      resetFormFromProject();
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);
    if (linkMode === "existing" && !customerId) {
      setError("Choose a customer, or select no linked customer.");
      setPending(false);
      return;
    }

    const result = await updateProject(project.id, {
      title,
      client_name: clientName || undefined,
      client_email: clientEmail || undefined,
      site_address: siteAddress || undefined,
      brief_text: briefText || undefined,
      priority,
      due_date: dueDate || undefined,
      notes: notes || undefined,
      customer_id: linkMode === "existing" ? customerId : null,
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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="touch"
        className={cn("min-h-11", triggerClassName)}
        onClick={() => handleOpenChange(true)}
      >
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] overflow-y-auto overscroll-contain sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit project details</DialogTitle>
            <DialogDescription>
              Update project information. This does not change assistant
              progress.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <p
                className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="edit-project-title">Project title</Label>
              <Input
                id="edit-project-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={120}
                className="min-h-11"
              />
              {fieldErrors.title?.[0] ? (
                <p className="text-sm text-destructive" role="alert">{fieldErrors.title[0]}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Client / site details</p>
              <p className="text-sm text-muted-foreground">
                Changes here apply to this project only.
              </p>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Linked customer</legend>
                {linkedCustomer ? (
                  <p className="text-sm" data-linked-customer>
                    Linked to {linkedCustomer.name}
                    {linkedCustomer.archived_at ? " (archived)" : ""}
                    {linkedCustomer.email ? ` · ${linkedCustomer.email}` : ""}
                  </p>
                ) : null}
                <div className="grid gap-2">
                  <label className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-orange)] has-[:focus-visible]:ring-offset-2",
                    linkMode === "existing"
                      ? "border-[var(--brand-orange)] bg-[var(--brand-orange-muted)]"
                      : "border-border bg-background"
                  )}>
                    <input
                      type="radio"
                      name="edit-customer-link"
                      checked={linkMode === "existing"}
                      onChange={() => setLinkMode("existing")}
                      className="size-4 accent-[var(--brand-orange)]"
                    />
                    <span className={linkMode === "existing" ? "font-semibold" : "font-medium"}>Existing customer</span>
                  </label>
                  <label className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-orange)] has-[:focus-visible]:ring-offset-2",
                    linkMode === "none"
                      ? "border-[var(--brand-orange)] bg-[var(--brand-orange-muted)]"
                      : "border-border bg-background"
                  )}>
                    <input
                      type="radio"
                      name="edit-customer-link"
                      checked={linkMode === "none"}
                      onChange={() => {
                        setLinkMode("none");
                        setCustomerId(null);
                      }}
                      className="size-4 accent-[var(--brand-orange)]"
                    />
                    <span className={linkMode === "none" ? "font-semibold" : "font-medium"}>No linked customer</span>
                  </label>
                </div>
                {linkMode === "existing" ? (
                  <CustomerPicker
                    customers={customers}
                    selectedId={customerId}
                    onSelect={(customer) => {
                      setCustomerId(customer.id);
                      setClientName(customer.name);
                      setClientEmail(customer.email ?? "");
                      setLinkedCustomer(customer);
                    }}
                  />
                ) : null}
              </fieldset>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="edit-client-name">Client name</Label>
                <Input
                  id="edit-client-name"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                maxLength={160}
                className="min-h-11"
              />
                {fieldErrors.client_name?.[0] ? (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.client_name[0]}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="edit-client-email">
                  Client email{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="edit-client-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={clientEmail}
                  onChange={(event) => setClientEmail(event.target.value)}
                  maxLength={254}
                  className="min-h-11"
                />
                {fieldErrors.client_email?.[0] ? (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.client_email[0]}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="edit-site-address">Site address</Label>
                <Input
                  id="edit-site-address"
                  value={siteAddress}
                  onChange={(event) => setSiteAddress(event.target.value)}
                  maxLength={300}
                  className="min-h-11"
                />
                {fieldErrors.site_address?.[0] ? (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.site_address[0]}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="edit-project-brief">Brief / description</Label>
              <Textarea
                id="edit-project-brief"
                value={briefText}
                onChange={(event) => setBriefText(event.target.value)}
                rows={3}
                maxLength={5000}
              />
              {fieldErrors.brief_text?.[0] ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.brief_text[0]}
                </p>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Internal details</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="edit-priority">Priority</Label>
                  <select
                    id="edit-priority"
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as ProjectPriority)
                    }
                    className={selectClassName}
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="edit-due-date">Due date</Label>
                  <Input
                    id="edit-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="min-h-11"
                  />
                  {fieldErrors.due_date?.[0] ? (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors.due_date[0]}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  maxLength={5000}
                />
                {fieldErrors.notes?.[0] ? (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.notes[0]}
                  </p>
                ) : null}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="touch"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" size="touch" disabled={pending || !title.trim()}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
