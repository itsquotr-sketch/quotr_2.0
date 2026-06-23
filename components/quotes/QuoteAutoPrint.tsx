"use client";

import { useEffect } from "react";

export function QuoteAutoPrint() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 400);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
