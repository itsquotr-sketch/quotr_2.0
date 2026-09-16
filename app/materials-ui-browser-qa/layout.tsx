import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MaterialsUiBrowserQaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.MATERIALS_UI_BROWSER_QA !== "1") {
    notFound();
  }
  return children;
}
