/**
 * Small inline marks inside help copy: **bold labels** and [guide](/help/slug).
 * Presentation renders them. Search and plain text use the visible words only.
 * A section can later carry an optional screenshot or video; that stays on the
 * section, not inside these strings.
 */

export type HelpInlinePart =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; text: string; href: string };

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

const ALLOWED_HREF =
  /^(?:\/help(?:\/[a-z0-9-]+)?|\/login|\/forgot-password|mailto:hello@get-quotr\.com)$/;

export function helpVisibleText(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export function helpInlineParts(value: string): HelpInlinePart[] {
  const parts: HelpInlinePart[] = [];
  let last = 0;
  for (const match of value.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ kind: "text", text: value.slice(last, index) });
    }
    if (match[1] != null) {
      parts.push({ kind: "strong", text: match[1] });
    } else {
      const label = match[2] ?? "";
      const href = match[3] ?? "";
      if (ALLOWED_HREF.test(href)) {
        parts.push({ kind: "link", text: label, href });
      } else {
        parts.push({ kind: "text", text: label });
      }
    }
    last = index + match[0].length;
  }
  if (last < value.length) {
    parts.push({ kind: "text", text: value.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ kind: "text", text: value });
  }
  return parts;
}
