import type { Metadata } from "next";
import { connection } from "next/server";
import { RfqPublicExperience } from "@/components/rfqs/RfqPublicExperience";
import { lookupPublicRfq } from "@/lib/rfqs/load";

export const runtime = "nodejs";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Request for price", robots: { index: false, follow: false } };
}

export default async function PublicRfqPage({ params }: PageProps) {
  await connection();
  const { token } = await params;
  const view = await lookupPublicRfq(token);
  return <RfqPublicExperience view={view} />;
}
