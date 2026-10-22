import { HELP_ARTICLES, type HelpArticle, type HelpBlock } from "@/lib/help/content";
import { helpVisibleText } from "@/lib/help/inline";

export type HelpSearchHit = {
  slug: string;
  title: string;
  excerpt: string;
};

type SearchField = {
  text: string;
  excerpt: string;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9$%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function blockExcerpt(block: HelpBlock): string {
  switch (block.type) {
    case "p":
      return helpVisibleText(block.text);
    case "steps":
    case "list":
      return block.items.map(helpVisibleText).join(" ");
    case "links":
      return block.items.map((item) => item.label).join(" ");
    case "details":
      return block.paragraphs.map(helpVisibleText).join(" ");
  }
}

function fieldsFor(article: HelpArticle): SearchField[] {
  const fields: SearchField[] = [
    { text: article.title, excerpt: article.summary },
    { text: article.summary, excerpt: article.summary },
  ];
  for (const section of article.sections) {
    const following = section.blocks.map(blockExcerpt).find((text) => text.trim()) ?? section.heading;
    fields.push({
      text: section.heading,
      excerpt: `${section.heading}. ${following}`,
    });
    for (const block of section.blocks) {
      const text = blockExcerpt(block);
      fields.push({ text, excerpt: text });
      if (block.type === "details") {
        fields.push({
          text: helpVisibleText(block.summary),
          excerpt: helpVisibleText(block.paragraphs.join(" ")),
        });
      }
    }
  }
  return fields;
}

function corpusFor(article: HelpArticle, fields: readonly SearchField[]): string {
  return normalize(
    [...fields.map((field) => field.text), ...article.keywords].join(" ")
  );
}

function excerptFor(fields: readonly SearchField[], tokens: readonly string[]): string {
  let best: SearchField | null = null;
  let bestScore = 0;
  for (const field of fields) {
    const hay = ` ${normalize(field.text)} `;
    const score = tokens.reduce(
      (sum, token) => sum + (hay.includes(` ${token} `) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      best = field;
      bestScore = score;
    }
  }
  const source = collapse(best?.excerpt ?? fields[0]?.excerpt ?? "");
  if (source.length <= 220) return source;
  return `${source.slice(0, 217).trimEnd()}…`;
}

export function searchHelp(
  query: string,
  articles: readonly HelpArticle[] = HELP_ARTICLES
): HelpSearchHit[] {
  const tokens = normalize(query)
    .split(" ")
    .filter((token) => token.length >= 2);
  if (tokens.length === 0) return [];

  const hits: HelpSearchHit[] = [];
  for (const article of articles) {
    const fields = fieldsFor(article);
    const corpus = corpusFor(article, fields);
    const padded = ` ${corpus} `;
    if (!tokens.every((token) => padded.includes(` ${token} `))) continue;
    hits.push({
      slug: article.slug,
      title: article.title,
      excerpt: excerptFor(fields, tokens),
    });
  }
  return hits;
}
