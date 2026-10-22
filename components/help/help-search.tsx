"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { helpLinkClass } from "@/components/help/help-frame";
import { HELP_SUPPORT_EMAIL } from "@/lib/help/content";
import { searchHelp } from "@/lib/help/search";

const rowClass =
  "flex min-h-11 min-w-0 items-center gap-3 rounded-md px-3 py-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2";

export function HelpSearch() {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const hits = useMemo(() => searchHelp(trimmed), [trimmed]);
  const showResults = trimmed.length > 0;

  return (
    <div className="mt-8 min-w-0">
      <label htmlFor="help-search" className="mb-2 block text-sm font-medium">
        Search help
      </label>
      <input
        id="help-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search help, e.g. rates or sending a quote"
        autoComplete="off"
        className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
      />
      {showResults ? (
        <div className="mt-3" aria-live="polite">
          {hits.length > 0 ? (
            <ul className="space-y-2">
              {hits.map((hit) => (
                <li key={hit.slug} className="min-w-0">
                  <Link href={`/help/${hit.slug}`} className={rowClass}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{hit.title}</span>
                      <span className="mt-1 block break-words text-foreground/75">{hit.excerpt}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-foreground/45" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base leading-[1.6]">
              No guides match that search. Try a topic below, or email{" "}
              <a className={helpLinkClass()} href={`mailto:${HELP_SUPPORT_EMAIL}`}>
                {HELP_SUPPORT_EMAIL}
              </a>
              .
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
