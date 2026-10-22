import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticleBody } from "@/components/help/help-article";
import { HelpSupport } from "@/components/help/help-frame";
import { getHelpArticle, HELP_ARTICLES } from "@/lib/help/content";

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) return { title: "Help | Quotr" };
  return {
    title: `${article.title} | Quotr Help`,
    description: article.summary,
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();

  return (
    <>
      <HelpArticleBody article={article} />
      <HelpSupport />
    </>
  );
}
