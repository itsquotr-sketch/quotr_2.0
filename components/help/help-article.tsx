import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { HelpInline } from "@/components/help/help-inline";
import { helpLinkClass } from "@/components/help/help-frame";
import { HelpHashScroll, HelpOnThisPage } from "@/components/help/help-on-this-page";
import {
  HELP_GROUPS,
  HELP_ON_THIS_PAGE_MIN_SECTIONS,
  getHelpArticle,
  helpArticlesInGroup,
  helpSectionId,
  type HelpArticle,
  type HelpBlock,
  type HelpMedia,
} from "@/lib/help/content";

const rowClass =
  "flex min-h-11 min-w-0 items-center gap-3 rounded-md px-3 py-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2";

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p>
          <HelpInline text={block.text} />
        </p>
      );
    case "steps":
      return (
        <ol className="list-decimal space-y-2.5 pl-5">
          {block.items.map((item) => (
            <li key={item}>
              <HelpInline text={item} />
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="list-disc space-y-2.5 pl-5">
          {block.items.map((item) => (
            <li key={item}>
              <HelpInline text={item} />
            </li>
          ))}
        </ul>
      );
    case "links":
      return (
        <ul className="space-y-2.5">
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
          <summary className="min-h-11 cursor-pointer py-2 font-medium">
            <HelpInline text={block.summary} />
          </summary>
          <div className="space-y-3 pb-2">
            {block.paragraphs.map((paragraph) => (
              <p key={paragraph}>
                <HelpInline text={paragraph} />
              </p>
            ))}
          </div>
        </details>
      );
  }
}

function SectionMedia({ media }: { media: HelpMedia }) {
  const caption = media.caption ? (
    <figcaption className="mt-2 text-sm leading-6 text-foreground/75">{media.caption}</figcaption>
  ) : null;

  if (media.kind === "video") {
    return (
      <figure className="mt-3 max-w-full">
        <video
          controls
          preload="metadata"
          src={media.src}
          className="h-auto max-w-full rounded-md"
        >
          {media.alt}
        </video>
        {caption}
      </figure>
    );
  }

  return (
    <figure className="mt-3 max-w-full">
      {/* A real file is supplied with the section. There is no placeholder. */}
      <img src={media.src} alt={media.alt} className="h-auto max-w-full rounded-md" />
      {caption}
    </figure>
  );
}

export function HelpArticleBody({ article }: { article: HelpArticle }) {
  const related = article.related
    .map((slug) => getHelpArticle(slug))
    .filter((item): item is HelpArticle => item != null);
  const pageNav =
    article.sections.length >= HELP_ON_THIS_PAGE_MIN_SECTIONS
      ? article.sections.map((section) => ({
          id: helpSectionId(section),
          heading: section.heading,
        }))
      : [];

  return (
    <article className="min-w-0 text-base leading-[1.6]">
      <HelpHashScroll />
      <p>
        <Link href="/help" className={helpLinkClass()}>
          All help
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
        {article.title}
      </h1>
      <p className="mt-3 break-words text-foreground/75">{article.summary}</p>
      <HelpOnThisPage items={pageNav} />
      {article.sections.map((section) => {
        const id = helpSectionId(section);
        return (
          <section key={id} id={id} className="mt-8 scroll-mt-6">
            <h2 className="break-words text-xl font-semibold tracking-tight">{section.heading}</h2>
            <div className="mt-3 space-y-3">
              {section.blocks.map((block, index) => (
                <Block key={`${id}-${index}`} block={block} />
              ))}
              {section.media ? <SectionMedia media={section.media} /> : null}
            </div>
          </section>
        );
      })}
      {related.length > 0 ? (
        <section className="mt-8" aria-labelledby="related-help-heading">
          <h2 id="related-help-heading" className="text-xl font-semibold tracking-tight">
            Related guides
          </h2>
          <ul className="mt-3 space-y-2.5">
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
          <ul className="mt-3 space-y-2">
            {helpArticlesInGroup(group.id).map((article) => (
              <li key={article.slug}>
                <Link href={`/help/${article.slug}`} className={rowClass}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{article.title}</span>
                    <span className="mt-1 block break-words text-foreground/75">
                      {article.summary}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-foreground/45" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
