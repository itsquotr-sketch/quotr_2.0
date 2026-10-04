"use client";

import { cloneElement, isValidElement, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BillingAccessDenied } from "@/components/billing/BillingAccessDenied";
import { CustomerPicker } from "@/components/customers/CustomerPicker";
import { createProject } from "@/lib/projects/actions";
import { listSelectableCustomers } from "@/lib/customers/actions";
import type { CustomerOption } from "@/lib/customers/types";
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

type CustomerMode = "none" | "existing" | "new";

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

const MODES: { value: CustomerMode; label: string }[] = [
  { value: "existing", label: "Existing customer" },
  { value: "new", label: "New customer" },
  { value: "none", label: "No customer yet" },
];

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
  const [siteAddress, setSiteAddress] = useState("");
  const [customerMode, setCustomerMode] = useState<CustomerMode>("none");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [denial, setDenial] = useState<{
    reasonCode?: string;
    upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const [closedAfterCreate, setClosedAfterCreate] = useState(false);
  const submitLock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const restoreFocusRef = useRef(true);
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listSelectableCustomers().then((rows) => {
      if (!cancelled) setCustomers(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function forgetNewProjectTrigger() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("newProject")) return;
    url.searchParams.delete("newProject");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }

  const arrived = pendingDestination !== null && pathname === pendingDestination;
  if (arrived) {
    setPendingDestination(null);
    setClosedAfterCreate(true);
    setTitle("");
    setSiteAddress("");
    setCustomerMode("none");
    setSelectedCustomerId(null);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setError(null);
    setDenial(null);
    setFieldErrors({});
    setPending(false);
    if (openProp === undefined) setUncontrolledOpen(false);
  }

  const dialogOpen = !closedAfterCreate && !arrived && (openProp ?? uncontrolledOpen);

  useEffect(() => {
    if (!closedAfterCreate) return;
    submitLock.current = false;
    requestId.current = crypto.randomUUID();
  }, [closedAfterCreate]);

  function openDialog() {
    if (pending || pendingDestination) return;
    setClosedAfterCreate(false);
    if (openProp === undefined) setUncontrolledOpen(true);
    onOpenChange?.(true);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending || pendingDestination) return;
    if (!nextOpen) restoreFocusRef.current = true;
    if (nextOpen) openDialog();
    else {
      if (openProp === undefined) setUncontrolledOpen(false);
      onOpenChange?.(false);
    }
  }

  const canSubmit =
    title.trim().length > 0 &&
    (customerMode !== "existing" || Boolean(selectedCustomerId)) &&
    (customerMode !== "new" || newName.trim().length > 0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current || pendingDestination) return;
    submitLock.current = true;
    let handedOff = false;
    setError(null);
    setDenial(null);
    setFieldErrors({});
    setPending(true);
    const site = siteAddress.trim();

    try {
      const result = await createProject({
        title,
        customer_mode: customerMode,
        creation_request_id: requestId.current,
        ...(site ? { site_address: site } : {}),
        ...(customerMode === "existing" && selectedCustomerId
          ? { customer_id: selectedCustomerId }
          : {}),
        ...(customerMode === "new"
          ? {
              client_name: newName.trim(),
              ...(newEmail.trim() ? { client_email: newEmail.trim() } : {}),
              ...(newPhone.trim() ? { customer_phone: newPhone.trim() } : {}),
            }
          : {}),
      });

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

      if (!result?.projectId) {
        setError("Could not create the job. Please try again.");
        return;
      }

      const destination = `/app/projects/${result.projectId}`;
      restoreFocusRef.current = false;
      forgetNewProjectTrigger();
      handedOff = true;
      setPendingDestination(destination);
      startTransition(() => {
        router.push(destination);
      });
    } catch {
      setError("Could not create the job. Please try again.");
    } finally {
      if (!handedOff) {
        setPending(false);
        submitLock.current = false;
      }
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
              openDialog();
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
              openDialog();
            })();
          }}
          className="w-full sm:w-auto"
        >
          {intent === "first-job" ? "Start your first job" : "New project"}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          finalFocus={() => restoreFocusRef.current}
          className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Start a job</DialogTitle>
            <DialogDescription>
              Name the job. Details come next. Add a customer if you already
              know who it is for.
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
                className="min-h-11"
              />
              {fieldErrors.title?.[0] ? (
                <p className="text-sm text-destructive">{fieldErrors.title[0]}</p>
              ) : null}
            </div>

            <fieldset className="space-y-2" data-customer-choice>
              <legend className="text-sm font-medium">Customer</legend>
              <div className="grid gap-2">
                {MODES.map((mode) => {
                  const selected = customerMode === mode.value;
                  return (
                    <label
                      key={mode.value}
                      data-customer-mode={mode.value}
                      data-selected={selected ? "true" : "false"}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-orange)] has-[:focus-visible]:ring-offset-2",
                        selected
                          ? "border-[var(--brand-orange)] bg-[var(--brand-orange-muted)]"
                          : "border-border bg-background"
                      )}
                    >
                      <input
                        type="radio"
                        name="customer-mode"
                        value={mode.value}
                        checked={selected}
                        onChange={() => setCustomerMode(mode.value)}
                        className="size-4 accent-[var(--brand-orange)]"
                      />
                      <span className={selected ? "font-semibold" : "font-medium"}>{mode.label}</span>
                    </label>
                  );
                })}
              </div>

              {customerMode === "existing" ? (
                customers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No saved customers yet. Add a new customer instead.
                  </p>
                ) : (
                  <CustomerPicker
                    customers={customers}
                    selectedId={selectedCustomerId}
                    onSelect={(customer) => setSelectedCustomerId(customer.id)}
                  />
                )
              ) : null}

              {customerMode === "new" ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-customer-name">Customer name</Label>
                    <Input
                      id="new-customer-name"
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      required
                      maxLength={160}
                      autoComplete="name"
                      className="min-h-11"
                    />
                    {fieldErrors.client_name?.[0] ? (
                      <p className="text-sm text-destructive">{fieldErrors.client_name[0]}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-customer-email">
                      Email <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="new-customer-email"
                      type="email"
                      inputMode="email"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      maxLength={254}
                      autoComplete="email"
                      className="min-h-11"
                    />
                    {fieldErrors.client_email?.[0] ? (
                      <p className="text-sm text-destructive">{fieldErrors.client_email[0]}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-customer-phone">
                      Phone <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="new-customer-phone"
                      type="tel"
                      inputMode="tel"
                      value={newPhone}
                      onChange={(event) => setNewPhone(event.target.value)}
                      maxLength={40}
                      autoComplete="tel"
                      className="min-h-11"
                    />
                  </div>
                </div>
              ) : null}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="site-address">Site</Label>
              <Input
                id="site-address"
                value={siteAddress}
                onChange={(event) => setSiteAddress(event.target.value)}
                placeholder="e.g. 12 Example Rd, Auckland"
                maxLength={300}
                autoComplete="street-address"
                className="min-h-11"
              />
              {fieldErrors.site_address?.[0] ? (
                <p className="text-sm text-destructive">{fieldErrors.site_address[0]}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="touch"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" size="touch" disabled={pending || !canSubmit}>
                {pending ? "Creating…" : "Create job"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
