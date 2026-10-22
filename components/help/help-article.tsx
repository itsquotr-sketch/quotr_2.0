import Link from "next/link";
import { helpLinkClass } from "@/components/help/help-frame";
import {
  HELP_GROUPS,
  getHelpArticle,
  helpArticlesInGroup,
  type HelpArticle,
  type HelpBlock,
} from "@/lib/help/content";

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case "p":
      return <p>{block.text}</p>;
    case "steps":
      return (
        <ol className="list-decimal space-y-2 pl-5">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="list-disc space-y-2 pl-5">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "links":
      return (
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item.href}>
              {item.href.startsWith("/") ? (
                <Link href={item.href} className={helpLinkClass()}>
                  {item.label}
                </Link>
              ) : (
                <a href={item.href} className={helpLinkClass()}>
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      );
    case "details":
      return (
        <details className="rounded-lg border border-border px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            {block.summary}
          </summary>
          <div className="space-y-3 pb-2">
            {block.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </details>
      );
  }
}

export function HelpArticleBody({ article }: { article: HelpArticle }) {
  const related = article.related
    .map((slug) => getHelpArticle(slug))
    .filter((item): item is HelpArticle => item != null);

  return (
    <article className="min-w-0">
      <p className="text-sm">
        <Link href="/help" className={helpLinkClass()}>
          All help
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
        {article.title}
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">{article.summary}</p>
      <div className="mt-8 space-y-8 text-sm leading-6 sm:text-base sm:leading-7">
        {article.sections.map((section) => (
          <section key={section.heading} className="scroll-mt-6 space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            {section.blocks.map((block, index) => (
              <Block key={`${section.heading}-${index}`} block={block} />
            ))}
          </section>
        ))}
      </div>
      {related.length > 0 ? (
        <section className="mt-10" aria-labelledby="related-help-heading">
          <h2 id="related-help-heading" className="text-base font-semibold tracking-tight">
            Related guides
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 sm:text-base">
            {related.map((item) => (
              <li key={item.slug}>
                <Link href={`/help/${item.slug}`} className={helpLinkClass()}>
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export function HelpTopics() {
  return (
    <div className="mt-8 space-y-8">
      {HELP_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`help-group-${group.id}`}>
          <h2 id={`help-group-${group.id}`} className="text-base font-semibold tracking-tight">
            {group.label}
          </h2>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {helpArticlesInGroup(group.id).map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/help/${article.slug}`}
                  className="block min-h-11 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
                >
                  <span className="block text-sm font-medium sm:text-base">{article.title}</span>
                  <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                    {article.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
