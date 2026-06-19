import { notFound } from "next/navigation";
import { AiTestPanel } from "@/components/dev/AiTestPanel";

export default function AiTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <AiTestPanel />;
}
