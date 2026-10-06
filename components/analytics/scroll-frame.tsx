"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * On a phone the shell reserves 5.75rem for the navigation and the raised
 * New control. Analytics scrolls inside that reserved edge so a section
 * cannot rest underneath the control. The bar itself is unchanged.
 */
export function AnalyticsScrollFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const apply = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        node.style.height = "";
        node.style.maxHeight = "";
        return;
      }
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const clearanceTop = window.innerHeight - 5.75 * rem;
      const button = document.querySelector("[data-mobile-new-project]");
      const nav = document.querySelector("[data-mobile-nav]");
      const buttonTop = button?.getBoundingClientRect().top;
      const navTop = nav?.getBoundingClientRect().top;
      const limit = Math.min(
        clearanceTop,
        buttonTop ?? clearanceTop,
        navTop ?? clearanceTop
      );
      const top = node.getBoundingClientRect().top;
      const parent = node.parentElement?.getBoundingClientRect();
      const parentRoom = parent ? parent.bottom - top : limit - top;
      const height = Math.max(160, Math.min(limit - top, parentRoom));
      const next = `${Math.round(height)}px`;
      if (node.style.height !== next) {
        node.style.height = next;
        node.style.maxHeight = next;
      }
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(document.body);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30"
      data-analytics-frame
    >
      {children}
    </div>
  );
}
