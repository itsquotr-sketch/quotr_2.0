import type { Metadata } from "next";

export const metadata: Metadata = { referrer: "no-referrer" };

export default function PublicRfqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-neutral-100" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {children}
    </div>
  );
}
