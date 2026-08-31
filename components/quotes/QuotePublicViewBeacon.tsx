"use client";

import { useEffect, useRef } from "react";
import { QUOTE_PUBLIC_VIEW_BEACON_DELAY_MS } from "@/lib/quotes/delivery-bots";

export function QuotePublicViewBeacon({ token }: { token: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    if (typeof document === "undefined") return;

    const send = () => {
      if (sent.current) return;
      if (document.visibilityState !== "visible") return;
      sent.current = true;
      void fetch(`/api/q/${encodeURIComponent(token)}/view`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        keepalive: true,
      });
    };

    const timer = window.setTimeout(send, QUOTE_PUBLIC_VIEW_BEACON_DELAY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.setTimeout(send, QUOTE_PUBLIC_VIEW_BEACON_DELAY_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  return null;
}
