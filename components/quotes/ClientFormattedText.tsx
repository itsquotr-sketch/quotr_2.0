import { cn } from "@/lib/utils";

const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function ClientFormattedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const nonempty = lines.filter((line) => line.trim().length > 0);
  const mostlyBullets =
    nonempty.length >= 2 &&
    nonempty.filter((line) => BULLET_RE.test(line)).length >=
      Math.ceil(nonempty.length * 0.6);

  if (mostlyBullets) {
    return (
      <ul className={cn("list-inside list-disc space-y-1", className)}>
        {nonempty.map((line, index) => (
          <li key={`${index}-${line.slice(0, 24)}`} className="break-words">
            {line.replace(BULLET_RE, "")}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className={cn("break-words whitespace-pre-wrap", className)}>{text}</p>
  );
}
