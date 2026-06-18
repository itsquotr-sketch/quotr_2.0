"use client";

import { cloneElement, isValidElement, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
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
};

export function NewProjectDialog({ trigger }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [briefText, setBriefText] = useState("");
  const [priority, setPriority] = useState<ProjectPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  function resetForm() {
    setTitle("");
    setClientName("");
    setSiteAddress("");
    setBriefText("");
    setPriority("normal");
    setDueDate("");
    setNotes("");
    setError(null);
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
    setFieldErrors({});
    setPending(true);

    const result = await createProject({
      title,
      client_name: clientName || undefined,
      site_address: siteAddress || undefined,
      brief_text: briefText || undefined,
      priority,
      due_date: dueDate || undefined,
      notes: notes || undefined,
    });

    setPending(false);

    if (result?.error) {
      setError(result.error);
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
        <Button type="button" onClick={() => setOpen(true)}>
          New project
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              Add the essentials now. You can refine the brief in the project
              assistant.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="project-title">Project title</Label>
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
              <p className="text-sm font-medium">Client / site details</p>
              <div className="space-y-2">
                <Label htmlFor="client-name">
                  Client name{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
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
                <Label htmlFor="site-address">
                  Site address{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
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
                Brief / description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="project-brief"
                value={briefText}
                onChange={(event) => setBriefText(event.target.value)}
                placeholder="Describe the job scope or anything helpful for the estimate…"
                rows={3}
                maxLength={5000}
              />
              {fieldErrors.brief_text?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.brief_text[0]}
                </p>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Internal details</p>
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
                  {fieldErrors.priority?.[0] ? (
                    <p className="text-sm text-destructive">
                      {fieldErrors.priority[0]}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due-date">
                    Due date{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                  {fieldErrors.due_date?.[0] ? (
                    <p className="text-sm text-destructive">
                      {fieldErrors.due_date[0]}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Notes{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Internal notes for your team…"
                  rows={2}
                  maxLength={5000}
                />
                {fieldErrors.notes?.[0] ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors.notes[0]}
                  </p>
                ) : null}
              </div>
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
                {pending ? "Creating…" : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
