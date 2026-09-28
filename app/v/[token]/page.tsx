import type { Metadata } from "next";
import { connection } from "next/server";
import { VariationPublicExperience } from "@/components/variations/VariationPublicExperience";
import { lookupPublicVariationByToken } from "@/lib/variations/public-lookup";

export const runtime = "nodejs";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Variation", robots: { index: false, follow: false } };
}

export default async function PublicVariationPage({ params }: PageProps) {
  await connection();
  const { token } = await params;
  const view = await lookupPublicVariationByToken(token);
  return <VariationPublicExperience view={view} />;
}
