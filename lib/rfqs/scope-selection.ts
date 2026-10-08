import type { DraftFact } from "@/lib/rfqs/draft-compose";
import { parseScheduleMeasure, type ScheduleUnit } from "@/lib/rfqs/schedule";

export const NO_RELIABLE_SCOPE =
  "No reliable scope detail for this Work Area was found; write or confirm the requested scope";

export type ScheduleSuggestion = {
  id: string;
  title: string;
  specification: string;
  quantity: string;
  unit: ScheduleUnit;
  source: string;
  confidence: "recorded" | "check";
};

export type ScopeSelectionInput = {
  areaType: string;
  areaName: string;
  areaConfirmed: boolean;
  brief: string;
  summary: string;
  description: string;
  items: Array<{ id: string; title: string; description: string }>;
  facts: Array<{
    id: string;
    label: string;
    text: string;
    uncertain: boolean;
    measurement: boolean;
  }>;
  notes: Array<{ id: string; noteType: string; text: string }>;
};

export type ScopeSelection = {
  facts: DraftFact[];
  suggestions: ScheduleSuggestion[];
  withheld: Array<{ source: string; reason: string }>;
  fallback: string | null;
};

const TRADE_KEYS = ["doors", "flooring", "internal_walls", "ceilings", "cladding"] as const;
type TradeKey = (typeof TRADE_KEYS)[number];

const TRADE_SPECIFIC: Record<TradeKey, RegExp> = {
  doors: /\bdoors?\b(?!\s+opening)/i,
  flooring: /\b(?:flooring|floor finish|carpet|vinyl(?:\s+planks?)?|lvt)\b/i,
  internal_walls: /\b(?:internal walls?|wall lining|line and stop)\b/i,
  ceilings: /\bceilings?\b/i,
  cladding: /\bcladding\b/i,
};

const LABEL =
  /^(doors?|flooring|walls|internal walls|ceilings?|cladding)\s*[:\-–—]\s*(.+)$/i;

const GENERIC_TITLE = /^(materials?|labour|labor|work|scope|notes?|explicit)$/i;

export function selectWorkAreaScope(input: ScopeSelectionInput): ScopeSelection {
  const area = { type: input.areaType.trim(), name: input.areaName.trim() };
  const owned = ownedTrades(area);
  const facts: DraftFact[] = [];
  const suggestions: ScheduleSuggestion[] = [];
  const withheld: Array<{ source: string; reason: string }> = [];
  const brief = input.brief.trim();
  const passages = brief ? passagesForArea(brief, owned) : [];

  if (brief && passages.length === 0) {
    withheld.push({
      source: "Project description",
      reason: "The project description covers more than this Work Area, so it was not copied.",
    });
  }
  for (const passage of passages) {
    facts.push({
      id: `brief-${facts.length}`,
      field: "scope",
      source: "Project description",
      text: passage,
      uncertain: false,
    });
    const quantity = parseScheduleMeasure(passage);
    if (quantity && quantity.unit !== "lump_sum") {
      facts.push({
        id: `brief-measure-${facts.length}`,
        field: "measurements",
        source: "Project description",
        text: quantity.label,
        uncertain: true,
      });
    }
  }

  if (input.areaConfirmed) {
    pushAreaText(facts, "summary", "Work area details", input.summary, brief, owned);
    pushAreaText(facts, "description", "Work area description", input.description, brief, owned);
    for (const item of input.items) {
      const title = item.title.trim();
      const description = item.description.trim();
      if (!title && !description) continue;
      if (isGenericTitle(title) || isExplicitMarker(title) || isExplicitMarker(description)) {
        withheld.push({
          source: title || "Captured specification",
          reason: "A generic label or internal marker is not a requested item.",
        });
        continue;
      }
      const combined = [title, description].filter(Boolean).join(": ");
      if (mentionsOtherTrade(combined, owned) || mixedWallsAndCeilings(combined)) {
        withheld.push({
          source: title || "Captured specification",
          reason: "This item mentions work outside the selected Work Area.",
        });
        continue;
      }
      if (brief.trim() && combined.length > 240 && combined.length > brief.trim().length * 0.7) {
        withheld.push({
          source: title || "Captured specification",
          reason: "This item repeats more than the selected Work Area.",
        });
        continue;
      }
      facts.push({
        id: `scope-${item.id}`,
        field: "scope",
        source: "Captured specification",
        text: combined,
        uncertain: false,
      });
      const suggestion = suggestionFromItem(item.id, title, description);
      if (suggestion) suggestions.push(suggestion);
    }
    for (const fact of input.facts) {
      if (!fact.text.trim()) continue;
      if (isExplicitMarker(fact.text) || isExplicitMarker(fact.label)) {
        withheld.push({ source: fact.label || "Work area fact", reason: "A generic label or internal marker is not a requested item." });
        continue;
      }
      facts.push({
        id: `fact-${fact.id}`,
        field: fact.measurement ? "measurements" : "scope",
        source: fact.measurement ? "Measured quantity" : "Work area fact",
        text: fact.measurement && fact.uncertain ? fact.text : fact.text,
        uncertain: fact.uncertain,
      });
    }
  }

  for (const note of input.notes) {
    const content = note.text.trim();
    if (!content || isExplicitMarker(content)) continue;
    if (!reliableText(content, brief, owned)) {
      withheld.push({
        source: note.noteType === "measurement" ? "Measurement note" : "Site note",
        reason: "This note is not tied to the selected Work Area.",
      });
      continue;
    }
    const field = note.noteType === "measurement" ? "measurements" : "scope";
    facts.push({
      id: `note-${note.id}`,
      field,
      source: note.noteType === "measurement" ? "Measurement note" : "Site note",
      text: content,
      uncertain: field === "measurements",
    });
  }

  const seen = new Set<string>();
  const uniqueFacts = facts.filter((fact) => {
    const key = `${fact.field}:${fact.text.trim().toLowerCase()}`;
    if (!fact.text.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const scopeFacts = uniqueFacts.filter((fact) => fact.field === "scope" && fact.text.trim().length >= 12);
  const measuredSuggestions = areaMeasureSuggestions(uniqueFacts, input.areaName.trim() || "This Work Area");
  const suggestionKeys = new Set(suggestions.map((item) => `${item.unit}:${item.quantity}:${item.title.toLowerCase()}`));
  for (const suggestion of measuredSuggestions) {
    const key = `${suggestion.unit}:${suggestion.quantity}:${suggestion.title.toLowerCase()}`;
    if (suggestionKeys.has(key)) continue;
    suggestionKeys.add(key);
    suggestions.push(suggestion);
  }
  return {
    facts: uniqueFacts,
    suggestions,
    withheld,
    fallback: scopeFacts.length === 0 ? NO_RELIABLE_SCOPE : null,
  };
}

function areaMeasureSuggestions(facts: DraftFact[], areaName: string): ScheduleSuggestion[] {
  const suggestions: ScheduleSuggestion[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    if (fact.field !== "measurements") continue;
    const measured = parseScheduleMeasure(fact.text);
    if (!measured || (measured.unit !== "m2" && measured.unit !== "m")) continue;
    const key = `${measured.unit}:${measured.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = measured.unit === "m2" ? "area" : "length";
    suggestions.push({
      id: `measure-${fact.id}`,
      title: `${areaName} ${kind}`,
      specification: measured.unit === "m2"
        ? "Priced by the recorded area. This is not a count of boards or other items."
        : "Priced by the recorded length. This is not a count of individual items.",
      quantity: measured.value,
      unit: measured.unit,
      source: "Work area measurement",
      confidence: "check",
    });
  }
  return suggestions;
}

function pushAreaText(
  facts: DraftFact[],
  id: string,
  source: string,
  value: string,
  brief: string,
  owned: ReadonlySet<TradeKey>
) {
  const text = value.trim();
  if (!text || isExplicitMarker(text) || isGenericTitle(text)) return;
  const pieces = reliableText(text, brief, owned) ? [text] : passagesForArea(text, owned);
  for (const [index, piece] of pieces.entries()) {
    facts.push({
      id: `${id}-${index}`,
      field: "scope",
      source,
      text: piece,
      uncertain: false,
    });
  }
}

function ownedTrades(area: { type: string; name: string }): Set<TradeKey> {
  const owned = new Set<TradeKey>();
  const type = area.type.toLowerCase().replace(/[\s-]+/g, "_");
  const name = area.name.toLowerCase();
  const add = (key: string | null) => {
    if (key && (TRADE_KEYS as readonly string[]).includes(key)) owned.add(key as TradeKey);
  };
  add(type === "walls" ? "internal_walls" : type);
  add(labelKey(name));
  return owned;
}

function labelKey(label: string): TradeKey | null {
  const name = label.trim().toLowerCase();
  if (name === "door" || name === "doors") return "doors";
  if (name === "flooring") return "flooring";
  if (name === "walls" || name === "internal walls" || name === "internal_walls") return "internal_walls";
  if (name === "ceiling" || name === "ceilings") return "ceilings";
  if (name === "cladding") return "cladding";
  return null;
}

function passagesForArea(text: string, owned: ReadonlySet<TradeKey>): string[] {
  if (owned.size === 0) return [];
  const labelled: string[] = [];
  const loose: string[] = [];
  for (const line of text.split(/\n+/)) {
    const match = line.trim().match(LABEL);
    if (!match) {
      loose.push(line.trim());
      continue;
    }
    const key = labelKey(match[1]);
    const body = match[2].trim();
    if (key && owned.has(key) && body && !mentionsOtherTrade(body, owned)) labelled.push(body);
  }
  if (labelled.length > 0) return unique(labelled);
  const sentences = loose
    .join(" ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12 && reliableText(sentence, text, owned));
  return unique(sentences);
}

function reliableText(text: string, container: string, owned: ReadonlySet<TradeKey>): boolean {
  const trimmed = text.trim();
  if (!trimmed || owned.size === 0) return false;
  if (isExplicitMarker(trimmed) || isGenericTitle(trimmed)) return false;
  if (mixedWallsAndCeilings(trimmed)) return false;
  if (!mentionsOwnedTrade(trimmed, owned)) return false;
  if (mentionsOtherTrade(trimmed, owned)) return false;
  if (container.trim() && trimmed.length > 240 && trimmed.length > container.trim().length * 0.7) return false;
  return true;
}

function mentionsOwnedTrade(text: string, owned: ReadonlySet<TradeKey>): boolean {
  for (const key of owned) {
    if (TRADE_SPECIFIC[key].test(text)) return true;
  }
  return false;
}

function mentionsOtherTrade(text: string, owned: ReadonlySet<TradeKey>): boolean {
  for (const key of TRADE_KEYS) {
    if (owned.has(key)) continue;
    if (TRADE_SPECIFIC[key].test(text)) return true;
  }
  return false;
}

function mixedWallsAndCeilings(text: string): boolean {
  return /\bwalls?\b/i.test(text) && /\bceilings?\b/i.test(text);
}

function suggestionFromItem(id: string, title: string, description: string): ScheduleSuggestion | null {
  if (title.length < 3 || title.length > 80 || title.split(/\s+/).length > 12) return null;
  if (description.length > 180) return null;
  const measured = parseScheduleMeasure(`${title} ${description}`);
  const unit: ScheduleUnit = measured?.unit ?? "item";
  return {
    id: `suggestion-${id}`,
    title,
    specification: description && description !== title ? description : "",
    quantity: measured && measured.unit !== "lump_sum" ? measured.value : "",
    unit,
    source: "Captured specification",
    confidence: measured && measured.unit !== "lump_sum" ? "check" : "recorded",
  };
}

function isGenericTitle(title: string): boolean {
  return GENERIC_TITLE.test(title.trim());
}

function isExplicitMarker(text: string): boolean {
  return /\bEXPLICIT\b\s*:/.test(text);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(value);
  }
  return next;
}
