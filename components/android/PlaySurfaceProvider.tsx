"use client";

import { createContext, useContext, useEffect } from "react";

const PlaySurfaceContext = createContext(false);

export function PlaySurfaceProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, [enabled]);

  return (
    <PlaySurfaceContext.Provider value={enabled}>
      {children}
    </PlaySurfaceContext.Provider>
  );
}

export function usePlaySurface(): boolean {
  return useContext(PlaySurfaceContext);
}
