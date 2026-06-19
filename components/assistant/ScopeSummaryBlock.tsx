import type { ScopeReview } from "@/lib/assistant/types";

type ScopeSummaryBlockProps = {
  scopeReview: ScopeReview;
};

function FactRow({
  label,
  value,
  sourceLabel,
}: {
  label: string;
  value: string;
  sourceLabel: string;
}) {
  return (
    <div className="text-sm leading-relaxed">
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="text-foreground">{value}</span>{" "}
      <span className="text-muted-foreground">({sourceLabel})</span>
    </div>
  );
}

function GlobalList({
  title,
  items,
  variant = "default",
}: {
  title: string;
  items: string[];
  variant?: "default" | "warning";
}) {
  if (!items.length) return null;

  return (
    <div>
      <h4
        className={
          variant === "warning"
            ? "text-xs font-medium text-amber-700 dark:text-amber-400"
            : "text-xs font-medium text-muted-foreground uppercase tracking-wide"
        }
      >
        {title}
      </h4>
      <ul
        className={
          variant === "warning"
            ? "mt-1.5 list-inside list-disc space-y-1 text-sm text-amber-800 dark:text-amber-300"
            : "mt-1.5 space-y-1.5 text-sm"
        }
      >
        {items.map((item) => (
          <li key={item} className="leading-relaxed break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScopeSummaryBlock({ scopeReview }: ScopeSummaryBlockProps) {
  return (
    <div className="space-y-4">
      {scopeReview.workAreas.map((workArea) => (
        <article
          key={workArea.workAreaId}
          className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3 sm:px-4 sm:py-3.5"
        >
          <h4 className="text-sm font-semibold text-foreground">
            {workArea.workAreaName}
          </h4>
          {workArea.summary ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground break-words">
              {workArea.summary}
            </p>
          ) : null}

          {workArea.facts.length > 0 ? (
            <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {workArea.facts.map((fact) => (
                <FactRow
                  key={`${workArea.workAreaId}-${fact.key}`}
                  label={fact.label}
                  value={fact.value}
                  sourceLabel={fact.sourceLabel}
                />
              ))}
            </div>
          ) : null}

          {workArea.missingItems.length > 0 ? (
            <div className="mt-3 border-t border-border/50 pt-3">
              <GlobalList
                title="Missing"
                items={workArea.missingItems}
                variant="warning"
              />
            </div>
          ) : null}
        </article>
      ))}

      <div className="space-y-4 border-t border-border/60 pt-4">
        <GlobalList
          title="General assumptions"
          items={scopeReview.generalAssumptions}
        />
        <GlobalList
          title="Not priced / excluded"
          items={scopeReview.generalExclusions}
        />
      </div>
    </div>
  );
}
