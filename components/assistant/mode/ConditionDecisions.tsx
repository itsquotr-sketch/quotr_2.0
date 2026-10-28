"use client";

import { explicitAssumptionFor } from "@/lib/estimate/condition-basis";
import type { ConditionDecision } from "@/lib/estimate/condition-basis";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConditionDecisionsProps = {
  decisions: readonly ConditionDecision[];
  stale: boolean;
  savingKey?: string | null;
  error?: string | null;
  onAnswer: (input: {
    key: string;
    label: string;
    value: string;
    acceptance?: "answer" | "assumption";
  }) => void;
};

export function ConditionDecisions({
  decisions,
  stale,
  savingKey = null,
  error = null,
  onAnswer,
}: ConditionDecisionsProps) {
  if (decisions.length === 0) return null;
  return (
    <section
      className="space-y-3 rounded-xl border border-border/70 bg-card px-4 py-4"
      data-condition-decisions="true"
    >
      <h2 className="text-lg font-semibold leading-6">Conditions that affect this estimate</h2>
      <p className="text-sm leading-5 text-foreground/80">
        {stale
          ? "This estimate is out of date. Regenerate it to apply the labour basis, then preview the pricing change before applying it. Saved revisions and issued quotes stay as they are."
          : "A priced line does not close these decisions. Answer the condition here. Regeneration appears after a price-affecting answer, without another unrelated edit."}
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="space-y-4">
        {decisions.map((decision) => {
          const assumption = explicitAssumptionFor(decision.key);
          return (
            <li
              key={decision.key}
              className="space-y-2 border-t border-border/60 pt-3"
              data-condition-decision={decision.key}
              data-condition-state={decision.state}
              data-condition-blocks={decision.blocksCommercial ? "true" : "false"}
            >
              <p className="text-sm font-medium">{decision.question}</p>
              <p className="text-sm leading-5 text-foreground/80">{decision.detail}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {decision.options.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={decision.storedValue === option ? "default" : "outline"}
                    className="h-11 min-h-11 justify-start"
                    data-condition-option={option}
                    disabled={savingKey === decision.key}
                    onClick={() =>
                      onAnswer({
                        key: decision.key,
                        label: decision.question,
                        value: option,
                        acceptance: "answer",
                      })
                    }
                  >
                    {option}
                  </Button>
                ))}
              </div>
              {assumption ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-11 min-h-11 w-full sm:w-auto")}
                  data-condition-assumption={decision.key}
                  disabled={savingKey === decision.key}
                  onClick={() =>
                    onAnswer({
                      key: decision.key,
                      label: decision.question,
                      value: assumption.value,
                      acceptance: "assumption",
                    })
                  }
                >
                  Use assumption — {assumption.statement}. {assumption.effect}
                </Button>
              ) : (
                <p className="text-sm text-foreground/75">
                  There is no hazardous-materials allowance to accept.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
