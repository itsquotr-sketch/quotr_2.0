/**
 * DECK-2B — Compact Assistant understanding summary (presentation only).
 * Facts SoT; never invent measurements or scope.
 */

export type AssistantUnderstandingSummary = {
  readonly workAreaLabel: string;
  readonly lines: readonly string[];
  readonly compactLine: string;
};

type FactRow = {
  readonly key: string;
  readonly value: unknown;
};

function factValue(facts: readonly FactRow[], key: string): unknown {
  return facts.find((row) => row.key === key)?.value;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDeckUnderstanding(facts: readonly FactRow[]): string[] {
  const lines: string[] = [];
  const area = asNumber(factValue(facts, "deck.area_m2"));
  const material = factValue(facts, "deck.board_material");
  const height = asNumber(factValue(facts, "deck.height_m"));
  const level = factValue(facts, "deck.level");
  const width = asNumber(factValue(facts, "deck.board_width_mm"));
  const removal = factValue(facts, "deck.existing_deck_removal");
  const substructure = factValue(facts, "deck.substructure_included");

  if (area != null && material != null && String(material).trim()) {
    lines.push(`${area}m² ${String(material)} deck`);
  } else if (area != null) {
    lines.push(`${area}m² deck`);
  } else if (material != null && String(material).trim()) {
    lines.push(`${String(material)} deck`);
  }

  if (height != null) {
    if (height <= 0.3) {
      lines.push(`Low level (~${height}m)`);
    } else if (level != null && String(level).trim()) {
      lines.push(`${String(level)} (~${height}m)`);
    } else {
      lines.push(`~${height}m high`);
    }
  } else if (level != null && String(level).trim()) {
    lines.push(String(level));
  }

  if (width != null) {
    lines.push(`${width}mm boards`);
  }

  if (removal === true || removal === "Yes" || removal === "yes") {
    lines.push("Existing deck removal");
  }

  if (substructure === true || substructure === "Yes" || substructure === "yes") {
    lines.push("New substructure");
  } else if (substructure === false || substructure === "No" || substructure === "no") {
    lines.push("Existing substructure");
  }

  return lines.slice(0, 5);
}

export function buildAssistantUnderstandingSummary(params: {
  readonly workAreaType: string;
  readonly workAreaName: string;
  readonly facts: readonly FactRow[];
}): AssistantUnderstandingSummary {
  const lines =
    params.workAreaType === "deck"
      ? formatDeckUnderstanding(params.facts)
      : params.facts
          .slice(0, 4)
          .map((fact) => `${fact.key}: ${String(fact.value ?? "")}`)
          .filter((line) => !line.endsWith(": "));

  const compactLine =
    lines.length > 0 ? lines.join(" · ") : params.workAreaName;

  return {
    workAreaLabel: params.workAreaName,
    lines,
    compactLine,
  };
}

export function buildProjectUnderstandingSummaries(params: {
  readonly workAreas: readonly {
    readonly id: string;
    readonly type: string;
    readonly name: string;
  }[];
  readonly facts: readonly {
    readonly key: string;
    readonly work_area_id: string | null;
    readonly value: unknown;
  }[];
}): readonly AssistantUnderstandingSummary[] {
  return params.workAreas.map((workArea) =>
    buildAssistantUnderstandingSummary({
      workAreaType: workArea.type,
      workAreaName: workArea.name,
      facts: params.facts
        .filter((fact) => fact.work_area_id === workArea.id)
        .map((fact) => ({ key: fact.key, value: fact.value })),
    })
  );
}
