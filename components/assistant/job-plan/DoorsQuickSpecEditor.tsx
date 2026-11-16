import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QuickSpecFactWrite } from "@/components/assistant/job-plan/DeckQuickSpecEditor";
import { resolveDoorsPortions } from "@/lib/estimate/doors-portions";
import type { EstimateFact } from "@/lib/estimate/types";

/**
 * The existing Work confirmation Edit control. One quantity per door.
 * Other door fields stay on the stored portion.
 */
export function DoorsQuickSpecEditor({
  workAreaId,
  facts,
  onSpecFact,
}: {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: QuickSpecFactWrite;
}) {
  const portions = resolveDoorsPortions({ facts, workAreaId }).portions;

  return (
    <div className="space-y-3" data-doors-quick-spec>
      {portions.map((portion, index) => {
        const inputId = `door-quantity-${workAreaId}-${portion.id}`;
        const title = portion.label?.trim() || `Door ${index + 1}`;
        return (
          <div key={portion.id} className="space-y-1.5" data-door-spec={portion.id}>
            <Label className="text-xs" htmlFor={inputId}>
              {title} quantity
            </Label>
            <Input
              className="h-11 md:h-9"
              id={inputId}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              defaultValue={portion.quantity ?? ""}
              data-door-quantity={portion.id}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isInteger(next) || next < 1) return;
                onSpecFact?.({
                  workAreaId,
                  key: "doors.portion.quantity",
                  label: `${title} quantity`,
                  value: next,
                  valueType: "number",
                  nestedItemId: portion.id,
                });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
