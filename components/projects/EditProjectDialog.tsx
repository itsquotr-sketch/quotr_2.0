"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateProject } from "@/lib/projects/actions";
import type { Project, ProjectPriority } from "@/lib/projects/types";
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

type EditProjectDialogProps = {
  project: Project;
};

function projectToFormState(project: Project) {
  return {
    title: project.title,
    clientName: project.client_name ?? "",
    siteAddress: project.site_address ?? "",
    briefText: project.brief_text ?? "",
    priority: project.priority,
    dueDate: project.due_date ?? "",
    notes: project.notes ?? "",
  };
}

export function EditProjectDialog({ project }: EditProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [clientName, setClientName] = useState(project.client_name ?? "");
  const [siteAddress, setSiteAddress] = useState(project.site_address ?? "");
  const [briefText, setBriefText] = useState(project.brief_text ?? "");
  const [priority, setPriority] = useState<ProjectPriority>(project.priority);
  const [dueDate, setDueDate] = useState(project.due_date ?? "");
  const [notes, setNotes] = useState(project.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  function resetFormFromProject() {
    const form = projectToFormState(project);
    setTitle(form.title);
    setClientName(form.clientName);
    setSiteAddress(form.siteAddress);
    setBriefText(form.briefText);
    setPriority(form.priority);
    setDueDate(form.dueDate);
    setNotes(form.notes);
    setError(null);
    setFieldErrors({});
  }

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

    const result = await updateProject(project.id, {
      title,
      client_name: clientName || undefined,
      site_address: siteAddress || undefined,
      brief_text: briefText || undefined,
      priority,
      due_date: dueDate || undefined,
      notes: notes || undefined,
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
        size="sm"
        onClick={() => handleOpenChange(true)}
      >
        Edit project
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit project details</DialogTitle>
            <DialogDescription>
              Update project information. This does not change assistant
              progress.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="edit-project-title">Project title</Label>
              <Input
                id="edit-project-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
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
                <Label htmlFor="edit-client-name">Client name</Label>
                <Input
                  id="edit-client-name"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  maxLength={160}
                />
                {fieldErrors.client_name?.[0] ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors.client_name[0]}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-site-address">Site address</Label>
                <Input
                  id="edit-site-address"
                  value={siteAddress}
                  onChange={(event) => setSiteAddress(event.target.value)}
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
              <Label htmlFor="edit-project-brief">Brief / description</Label>
              <Textarea
                id="edit-project-brief"
                value={briefText}
                onChange={(event) => setBriefText(event.target.value)}
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
                  <Label htmlFor="edit-priority">Priority</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="edit-due-date">Due date</Label>
                  <Input
                    id="edit-due-date"
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
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
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
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !title.trim()}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
