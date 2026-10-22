import { HelpTopics } from "@/components/help/help-article";
import { HelpSupport } from "@/components/help/help-frame";
import { HelpSearch } from "@/components/help/help-search";

export default function HelpPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">How can we help?</h1>
      <HelpSearch />
      <HelpTopics />
      <HelpSupport />
    </>
  );
}
