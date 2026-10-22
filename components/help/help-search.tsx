"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { helpLinkClass } from "@/components/help/help-frame";
import { HELP_SUPPORT_EMAIL } from "@/lib/help/content";
import { searchHelp } from "@/lib/help/search";

export function HelpSearch() {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const hits = useMemo(() => searchHelp(trimmed), [trimmed]);
  const showResults = trimmed.length > 0;

  return (
    <div className="mt-6 min-w-0">
      <label htmlFor="help-search" className="sr-only">
        Search help
      </label>
      <input
        id="help-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search help"
        autoComplete="off"
        className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
      />
      {showResults ? (
        <div className="mt-4" aria-live="polite">
          {hits.length > 0 ? (
            <ul className="space-y-3">
              {hits.map((hit) => (
                <li key={hit.slug} className="min-w-0">
                  <Link
                    href={`/help/${hit.slug}`}
                    className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
                  >
                    <span className="block text-sm font-medium sm:text-base">{hit.title}</span>
                    <span className="mt-0.5 block text-sm leading-5 break-words text-muted-foreground">
                      {hit.excerpt}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6">
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
