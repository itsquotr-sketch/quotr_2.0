"use client";

import { cloneElement, isValidElement, useRef, useState } from "react";
import { BillingAccessDenied } from "@/components/billing/BillingAccessDenied";
import { createProject } from "@/lib/projects/actions";
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

type NewProjectDialogProps = {
  trigger?: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
  /** Conversational first-job CTA. Project remains the entity. */
  intent?: "default" | "first-job";
  /** Return false to keep the dialog closed. */
  beforeOpen?: () => Promise<boolean>;
  /** Controlled open state for the post-setup handoff. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Render no trigger. The dialog opens only through controlled state. */
  hideTrigger?: boolean;
};

export function NewProjectDialog({
  trigger,
  intent = "default",
  beforeOpen,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: NewProjectDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [denial, setDenial] = useState<{
    reasonCode?: string;
    upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const submitLock = useRef(false);

  function resetForm() {
    setTitle("");
    setClientName("");
    setSiteAddress("");
    setError(null);
    setDenial(null);
    setFieldErrors({});
    setPending(false);
    submitLock.current = false;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending || submitLock.current) return;
    if (openProp === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setError(null);
    setDenial(null);
    setFieldErrors({});
    setPending(true);

    const client = clientName.trim();
    const site = siteAddress.trim();

    const result = await createProject({
      title,
      ...(client ? { client_name: client } : {}),
      ...(site ? { site_address: site } : {}),
    });

    if (result?.error) {
      setError(result.error);
      if (result.reasonCode) {
        setDenial({
          reasonCode: result.reasonCode,
          upgradeTarget: result.upgradeTarget,
        });
      }
      setPending(false);
      submitLock.current = false;
      return;
    }

    if (result?.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      setPending(false);
      submitLock.current = false;
    }
  }

  return (
    <>
      {hideTrigger ? null : trigger && isValidElement(trigger) ? (
        cloneElement(trigger, {
          onClick: (event: React.MouseEvent) => {
            trigger.props.onClick?.(event);
            void (async () => {
              if (beforeOpen && !(await beforeOpen())) return;
              handleOpenChange(true);
            })();
          },
        } as React.Attributes)
      ) : (
        <Button
          type="button"
          size="touch"
          onClick={() => {
            void (async () => {
              if (beforeOpen && !(await beforeOpen())) return;
              handleOpenChange(true);
            })();
          }}
          className="w-full sm:w-auto"
        >
          {intent === "first-job" ? "Start your first job" : "New project"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start a job</DialogTitle>
            <DialogDescription>
              Name the job. Add the client and site if you already know them.
              Details come next.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5" data-create-job="true">
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
                placeholder="e.g. Smith deck and pergola"
                required
                maxLength={120}
                autoComplete="off"
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
                  autoComplete="name"
                />
                {fieldErrors.client_name?.[0] ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors.client_name[0]}
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
                  autoComplete="street-address"
                />
                {fieldErrors.site_address?.[0] ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors.site_address[0]}
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
                {pending ? "Creating…" : "Create job"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
