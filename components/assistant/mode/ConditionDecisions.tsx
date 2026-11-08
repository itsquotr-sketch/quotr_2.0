"use client";

import { useState } from "react";
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
          ? "This estimate is out of date. Regenerate it to apply the current labour and disclosure basis, then preview the pricing change before applying it. Saved revisions and issued quotes stay as they are."
          : "A priced line does not close these decisions. Answer the condition here. Regeneration appears after an answer that changes the labour or disclosure basis, without another unrelated edit."}
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
              ) : decision.key === "hazardous_materials_risk" ? (
                <p className="text-sm text-foreground/75">
                  There is no hazardous-materials allowance to accept.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const CONDITION_LABEL: Record<string, string> = {
  site_access: "Site access",
  material_carry_distance: "Carry",
  occupied_site: "Occupied site",
  working_hours: "Working restrictions",
  floor_level: "Floor",
  hazardous_materials_risk: "Hazardous materials",
  protection_dust_control: "Protection",
};

function conditionLabel(decision: ConditionDecision): string {
  return CONDITION_LABEL[decision.key] ?? decision.question;
}

export function ConditionBasisSummary({
  decisions,
  placement,
  stale,
  savingKey = null,
  error = null,
  onAnswer,
}: ConditionDecisionsProps & { placement: "labour" | "checks" }) {
  const [editing, setEditing] = useState(false);
  if (decisions.length === 0) return null;
  const resolved = decisions.filter((decision) => decision.state === "resolved");
  const uncertain = decisions.filter((decision) => decision.state === "uncertain");
  const unanswered = decisions.filter((decision) => decision.state === "unanswered");
  const compact = resolved
    .map((decision) => `${conditionLabel(decision)}: ${decision.storedValue}`)
    .join(" · ");

  return (
    <section
      className="space-y-3 rounded-xl border border-border/70 bg-card px-4 py-3"
      data-condition-basis={placement}
    >
      {stale ? (
        <p className="text-sm leading-5" data-condition-basis-stale="true">
          These are the current job answers. The saved estimate still uses its previous condition basis. Regenerate the estimate to apply them.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold leading-5">Condition basis</h2>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          data-edit-conditions="true"
          onClick={() => setEditing((open) => !open)}
        >
          {editing ? "Close conditions" : "Edit conditions"}
        </Button>
      </div>
      {placement === "checks" ? (
        <details data-condition-resolved="true">
          <summary className="min-h-11 cursor-pointer text-sm">
            {resolved.length} answered
          </summary>
          <ul className="space-y-1 pt-2">
            {resolved.map((decision) => (
              <li key={decision.key} className="text-sm" data-condition-summary={decision.key}>
                {conditionLabel(decision)}: {decision.storedValue}
              </li>
            ))}
          </ul>
        </details>
      ) : compact ? (
        <p className="text-sm leading-5" data-condition-resolved="true">
          {compact}
        </p>
      ) : null}
      {uncertain.length > 0 ? (
        <ul className="space-y-1" data-condition-uncertain="true">
          {uncertain.map((decision) => (
            <li key={decision.key} className="text-sm" data-condition-summary={decision.key}>
              {conditionLabel(decision)}: Not sure
            </li>
          ))}
        </ul>
      ) : null}
      {unanswered.length > 0 ? (
        <ul className="space-y-1" data-condition-unanswered="true">
          {unanswered.map((decision) => (
            <li key={decision.key} className="text-sm" data-condition-summary={decision.key}>
              {conditionLabel(decision)}: unanswered
            </li>
          ))}
        </ul>
      ) : null}
      {editing ? (
        <ConditionDecisions
          decisions={decisions}
          stale={stale}
          savingKey={savingKey}
          error={error}
          onAnswer={onAnswer}
        />
      ) : null}
    </section>
  );
}
