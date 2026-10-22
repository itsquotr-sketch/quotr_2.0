import type { Metadata } from "next";
import { headers } from "next/headers";
import { HelpFrame } from "@/components/help/help-frame";

export const metadata: Metadata = {
  title: "Help | Quotr",
  description: "Guides for setting up Quotr, estimating, and sending a quote.",
};

export const dynamic = "force-dynamic";

export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const signedIn = headerStore.get("x-quotr-help-return") === "1";
  return <HelpFrame signedIn={signedIn}>{children}</HelpFrame>;
}
