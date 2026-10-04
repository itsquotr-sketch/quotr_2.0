"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";

/**
 * Opens the new-project dialog only after Dashboard has replaced setup.
 * The query is removed immediately so a refresh does not open it again.
 */
export function DashboardOnboardingHandoff({
  openNewProject,
  consentUnsaved,
}: {
  openNewProject: boolean;
  consentUnsaved: boolean;
}) {
  const [open, setOpen] = useState(openNewProject);
  const [showConsentNote] = useState(consentUnsaved);
  const [checkedQuery, setCheckedQuery] = useState(false);

  if (!checkedQuery && typeof window !== "undefined") {
    const requested = new URL(window.location.href).searchParams.get("newProject") === "1";
    setCheckedQuery(true);
    if (!requested) setOpen(false);
  }

  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("newProject") && !url.searchParams.has("consent")) return;
    url.searchParams.delete("newProject");
    url.searchParams.delete("consent");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, []);

  return (
    <>
      {showConsentNote && typeof document !== "undefined"
        ? createPortal(
            <p
              role="status"
              className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm"
            >
              Product updates were not saved. You can update this later.
            </p>,
            document.body
          )
        : null}
      <NewProjectDialog
        intent="first-job"
        hideTrigger
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
