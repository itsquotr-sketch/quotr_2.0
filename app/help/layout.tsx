import type { Metadata } from "next";
import { HelpFrame } from "@/components/help/help-frame";

export const metadata: Metadata = {
  title: "Help | Quotr",
  description: "Guides for setting up Quotr, estimating, and sending a quote.",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <HelpFrame>{children}</HelpFrame>;
}
