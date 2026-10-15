/**
 * Both held Deck productivity lines are one decision.
 * Nothing is written until every line has a choice and the estimate
 * still matches the calibration that opened the review.
 */

export type DeckProductivityChoice =
  | { readonly kind: "calibration" }
  | { readonly kind: "benchmark" }
  | { readonly kind: "job"; readonly hours: number };

export type DeckProductivityApplyLine = {
  readonly id: string;
  readonly factKey: string;
  readonly jobFactKey: string;
  readonly expectedToken: string;
  readonly itemKey: string;
  readonly choice: DeckProductivityChoice | null;
  readonly lineHeld: boolean;
  readonly currentHours: number | null;
};

export type DeckProductivityFactWrite = {
  readonly key: string;
  readonly value: string;
  readonly label: string;
};

export type DeckProductivityApplyPlan =
  | {
      readonly ok: true;
      readonly writes: readonly DeckProductivityFactWrite[];
    }
  | {
      readonly ok: false;
      readonly conflict: boolean;
      readonly message: string;
    };

const CONFLICT =
  "This estimate or the company calibration changed. Review the lines again before applying a choice. The organisation rate was not changed.";

function tokenHours(token: string): number | null {
  const match = /^confirmed:(\d+(?:\.\d+)?)$/.exec(token.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function hoursMatch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.0001;
}

export function planDeckProductivityApply(input: {
  readonly estimateStale: boolean;
  readonly decisions: readonly DeckProductivityApplyLine[];
}): DeckProductivityApplyPlan {
  if (input.decisions.length === 0) {
    return {
      ok: false,
      conflict: false,
      message: "There are no productivity lines to review.",
    };
  }
  if (input.decisions.some((line) => line.choice == null)) {
    return {
      ok: false,
      conflict: false,
      message: "Choose one option for every held line before updating the estimate.",
    };
  }
  if (input.estimateStale || input.decisions.some((line) => !line.lineHeld)) {
    return { ok: false, conflict: true, message: CONFLICT };
  }
  const writes: DeckProductivityFactWrite[] = [];
  for (const line of input.decisions) {
    const expected = tokenHours(line.expectedToken);
    if (
      expected == null ||
      line.currentHours == null ||
      !hoursMatch(expected, line.currentHours)
    ) {
      return { ok: false, conflict: true, message: CONFLICT };
    }
    const choice = line.choice;
    if (choice == null) continue;
    if (choice.kind === "job") {
      if (!Number.isFinite(choice.hours) || choice.hours <= 0) {
        return {
          ok: false,
          conflict: false,
          message: "Enter a productivity greater than zero for the revised rate.",
        };
      }
      writes.push(
        {
          key: line.factKey,
          value: "job",
          label: "Productivity scope",
        },
        {
          key: line.jobFactKey,
          value: String(choice.hours),
          label: "Revised productivity",
        }
      );
      continue;
    }
    writes.push({
      key: line.factKey,
      value: choice.kind === "benchmark" ? "quotr-benchmark" : line.expectedToken,
      label: "Productivity scope",
    });
  }
  return { ok: true, writes };
}
