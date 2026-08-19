"use client";

import type { ReactNode } from "react";

type PlanningSurfaceProps = {
  children: ReactNode;
};

export function PlanningSurface({ children }: PlanningSurfaceProps) {
  return (
    <div
      className="space-y-3 overflow-x-hidden lg:space-y-2.5"
      data-assistant-surface="planning"
    >
      {children}
    </div>
  );
}
