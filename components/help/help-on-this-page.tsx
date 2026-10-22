"use client";

import { useEffect } from "react";
import { helpLinkClass } from "@/components/help/help-frame";

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}

/** Hash links scroll the help frame, which is its own scroll container. */
export function HelpHashScroll() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    scrollToSection(id);
  }, []);
  return null;
}

export function HelpOnThisPage({
  items,
}: {
  items: readonly { id: string; heading: string }[];
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="On this page" className="mt-8">
      <h2 className="text-sm font-semibold tracking-tight">On this page</h2>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`inline-flex min-h-11 items-center break-words text-base leading-6 ${helpLinkClass()}`}
              onClick={(event) => {
                const target = document.getElementById(item.id);
                if (!target) return;
                event.preventDefault();
                target.scrollIntoView({ block: "start" });
                window.history.replaceState(null, "", `#${item.id}`);
              }}
            >
              {item.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
