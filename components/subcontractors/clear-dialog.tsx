"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Layout shared by profile dialogs. Mobile position is applied inline so it wins. */
export function revealFocusedField(event: { target: EventTarget | null }) {
  const field = event.target;
  if (!(field instanceof HTMLElement)) return;
  if (field.closest("[data-dialog-actions]")) return;
  window.requestAnimationFrame(() => {
    const actions = field.closest("[data-slot='dialog-content']")?.querySelector("[data-dialog-actions]");
    if (!actions) {
      field.scrollIntoView({ block: "nearest" });
      return;
    }
    if (field.getBoundingClientRect().bottom > actions.getBoundingClientRect().top) {
      field.scrollIntoView({ block: "center" });
    }
  });
}

export const clearDialogClassName = cn(
  "flex h-auto flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-contain p-0 sm:max-w-lg",
);

/**
 * On a phone, the dialog starts under the top edge and its height stops above
 * the navigation bar and the raised New control. A software keyboard shortens it.
 */
export function useClearDialogStyle(): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);
  useEffect(() => {
    const viewport = window.visualViewport;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      if (!media.matches) {
        setStyle(undefined);
        return;
      }
      const covered = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      setStyle({
        top: "0.75rem",
        transform: "translateX(-50%)",
        maxHeight: `calc(100dvh - 5.75rem - env(safe-area-inset-bottom) - 0.75rem - ${Math.round(covered)}px)`,
      });
    };
    update();
    media.addEventListener("change", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener("change", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return style;
}
