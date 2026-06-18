import type { WorkArea } from "@/components/assistant/types";

type ScopeSummaryBlockProps = {
  includedWorkAreas: WorkArea[];
  scopeAssumptions: string[];
  scopeExclusions?: string[];
};

function ScopeList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) return null;

  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      <ul className="mt-1.5 space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item} className="leading-relaxed text-foreground break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScopeSummaryBlock({
  includedWorkAreas,
  scopeAssumptions,
  scopeExclusions = [],
}: ScopeSummaryBlockProps) {
  const includedScope = includedWorkAreas.flatMap(
    (wa) => wa.includedScopeItems?.map((item) => item.label) ?? []
  );

  const missingInfo = [
    ...new Set(
      includedWorkAreas.flatMap((wa) => wa.missingInfo ?? [])
    ),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Included work areas
        </h4>
        <ul className="mt-2 space-y-3">
          {includedWorkAreas.map((wa) => (
            <li
              key={wa.id}
              className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"
            >
              <p className="text-sm font-medium">{wa.name}</p>
              {wa.summary ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground break-words">
                  {wa.summary}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <ScopeList title="Included scope" items={includedScope.slice(0, 6)} />

      <ScopeList title="Assumptions" items={scopeAssumptions.slice(0, 4)} />

      <ScopeList title="Missing info" items={missingInfo} />

      {scopeExclusions.length > 0 ? (
        <ScopeList
          title="Not priced / excluded"
          items={scopeExclusions.slice(0, 3)}
        />
      ) : null}
    </div>
  );
}
