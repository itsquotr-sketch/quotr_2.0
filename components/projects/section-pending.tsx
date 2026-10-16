"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type PendingNavigation = { label: string; from: string };
type Listener = () => void;

let currentPath = "";
let pending: PendingNavigation | null = null;
const listeners = new Set<Listener>();

function publish() {
  for (const listener of listeners) listener();
}

export function beginSectionNavigation(label: string) {
  if (!currentPath) return;
  pending = { label, from: currentPath };
  publish();
}

function useSectionPending(): string | null {
  const pathname = usePathname();
  currentPath = pathname;
  if (pending && pending.from !== pathname) pending = null;
  const [, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((version) => version + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return pending && pending.from === pathname ? pending.label : null;
}

export function SectionPendingContent({ children }: { children: ReactNode }) {
  const label = useSectionPending();
  return (
    <div
      className="min-w-0"
      aria-busy={label ? true : undefined}
      data-section-content-pending={label ? "true" : "false"}
    >
      {label ? (
        <p
          className="rounded-md border border-border bg-muted/70 px-3 py-2 text-sm text-foreground"
          role="status"
          data-section-pending="true"
        >
          Loading {label}…
        </p>
      ) : (
        children
      )}
    </div>
  );
}
