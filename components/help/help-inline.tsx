import Link from "next/link";
import { helpLinkClass } from "@/components/help/help-frame";
import { helpInlineParts } from "@/lib/help/inline";

export function HelpInline({ text }: { text: string }) {
  const parts = helpInlineParts(text);
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "strong") {
          return (
            <strong key={index} className="font-semibold">
              {part.text}
            </strong>
          );
        }
        if (part.kind === "link") {
          if (part.href.startsWith("/")) {
            return (
              <Link key={index} href={part.href} className={helpLinkClass()}>
                {part.text}
              </Link>
            );
          }
          return (
            <a key={index} href={part.href} className={helpLinkClass()}>
              {part.text}
            </a>
          );
        }
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}
