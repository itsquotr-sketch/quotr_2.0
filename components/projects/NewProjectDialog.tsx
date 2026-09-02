"use client";

import { cloneElement, isValidElement, useState } from "react";
import { BillingAccessDenied } from "@/components/billing/BillingAccessDenied";
import { createProject } from "@/lib/projects/actions";
import type { ProjectPriority } from "@/lib/projects/types";
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
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS: { value: ProjectPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const selectClassName = cn(
  "h-8 w-full rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
);

type NewProjectDialogProps = {
  trigger?: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
  /** Conversational first-job CTA. Project remains the entity. */
  intent?: "default" | "first-job";
};

export function NewProjectDialog({
  trigger,
  intent = "default",
}: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [briefText, setBriefText] = useState("");
  const [priority, setPriority] = useState<ProjectPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denial, setDenial] = useState<{
    reasonCode?: string;
    upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  function resetForm() {
    setTitle("");
    setClientName("");
    setClientEmail("");
    setSiteAddress("");
    setBriefText("");
    setPriority("normal");
    setDueDate("");
    setNotes("");
    setMoreOpen(false);
    setError(null);
    setDenial(null);
    setFieldErrors({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDenial(null);
    setFieldErrors({});
    setPending(true);

    const result = await createProject({
      title,
      client_name: clientName || undefined,
      client_email: clientEmail || undefined,
      site_address: siteAddress || undefined,
      brief_text: briefText || undefined,
      priority,
      due_date: dueDate || undefined,
      notes: notes || undefined,
    });

    setPending(false);

    if (result?.error) {
      setError(result.error);
      if (result.reasonCode) {
        setDenial({
          reasonCode: result.reasonCode,
          upgradeTarget: result.upgradeTarget,
        });
      }
      return;
    }

    if (result?.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return;
    }
  }

  return (
    <>
      {trigger && isValidElement(trigger) ? (
        cloneElement(trigger, {
          onClick: (event: React.MouseEvent) => {
            trigger.props.onClick?.(event);
            setOpen(true);
          },
        } as React.Attributes)
      ) : (
        <Button type="button" size="touch" onClick={() => setOpen(true)} className="w-full sm:w-auto">
          {intent === "first-job" ? "Start your first job" : "New project"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {intent === "first-job" ? "Start a job" : "Create project"}
            </DialogTitle>
            <DialogDescription>
              Plans, photos and full details aren&apos;t required. Add what you
              know now.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              denial ? (
                <BillingAccessDenied
                  error={error}
                  reasonCode={denial.reasonCode}
                  upgradeTarget={denial.upgradeTarget}
                />
              ) : (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="project-title">Job name</Label>
              <Input
                id="project-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Smith deck & pergola"
                required
                maxLength={120}
              />
              {fieldErrors.title?.[0] ? (
                <p className="text-sm text-destructive">{fieldErrors.title[0]}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Client and site (optional)</p>
              <div className="space-y-2">
                <Label htmlFor="client-name">Client</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="e.g. Jane Smith"
                  maxLength={160}
                />
                {fieldErrors.client_name?.[0] ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors.client_name[0]}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={clientEmail}
                  onChange={(event) => setClientEmail(event.target.value)}
                  placeholder="e.g. jane@example.com"
                  maxLength={254}
                />
                {fieldErrors.client_email?.[0] ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors.client_email[0]}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-address">Site</Label>
                <Input
                  id="site-address"
                  value={siteAddress}
                  onChange={(event) => setSiteAddress(event.target.value)}
                  placeholder="e.g. 12 Example Rd, Auckland"
                  maxLength={300}
                />
                {fieldErrors.site_address?.[0] ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors.site_address[0]}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-brief">
                What do you know about the job?{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="project-brief"
                value={briefText}
                onChange={(event) => setBriefText(event.target.value)}
                placeholder="e.g. Spoke to Jane about a 6×3 timber deck, no plans yet."
                rows={3}
                maxLength={5000}
              />
              {fieldErrors.brief_text?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.brief_text[0]}
                </p>
              ) : null}
            </div>

            <div>
              {!moreOpen ? (
                <button
                  type="button"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setMoreOpen(true)}
                >
                  + Priority, due date, or notes
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">More details (optional)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <select
                        id="priority"
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
                    <div className="space-y-2">
                      <Label htmlFor="due-date">Due date</Label>
                      <Input
                        id="due-date"
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2" data-create-project-notes>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Internal notes…"
                      rows={2}
                      maxLength={5000}
                      data-create-notes-composer
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !title.trim()}>
                {pending
                  ? "Creating…"
                  : intent === "first-job"
                    ? "Start job"
                    : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
