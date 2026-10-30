/**
 * Explicit material-waste percent stated in a brief.
 * A percent stays on the assembly the sentence names.
 * An unnamed percent applies only when the brief has one of these assemblies.
 * It is not copied onto both.
 */

export type MaterialWasteSubject = "floor_covering" | "deck_boards";

type WasteMention = {
  readonly percent: number;
  readonly subject: MaterialWasteSubject | "unspecified";
};

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

function sentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(SENTENCE_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function percentFromSentence(sentence: string): number | null {
  if (/\b(waste removal|demolition waste|waste carted|carting waste|skip bin)\b/i.test(sentence)) {
    return null;
  }
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)\s+(?:material\s+|additional\s+|extra\s+)?waste\b/i,
    /\bwaste(?:\s+allowance)?\s+of\s+(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)\b/i,
    /\bwaste\s+(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)\b/i,
    /\bwaste\s+is\s+(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)\b/i,
    /\ballow\s+(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)\s+(?:material\s+)?waste\b/i,
  ];
  for (const pattern of patterns) {
    const match = sentence.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0 && value <= 100) return value;
  }
  return null;
}

function briefHasDeck(brief: string): boolean {
  return /\b(deck(?:ing)?|platforms?)\b/i.test(brief);
}

function briefHasFloorCovering(brief: string): boolean {
  return /\b(floor(?:ing)?|laminate|vinyl|carpet|coverings?)\b/i.test(brief);
}

function subjectOf(sentence: string, brief: string): MaterialWasteSubject | "unspecified" {
  const namesFloor = /\b(floor(?:ing)?|coverings?|laminate|vinyl|carpet|underlay)\b/i.test(
    sentence
  );
  const namesDeck = /\b(deck(?:ing)?|platforms?)\b/i.test(sentence);
  const namesBoards = /\bboards?\b/i.test(sentence);
  if (namesFloor && !namesDeck && !(namesBoards && briefHasDeck(brief) && !namesFloor)) {
    return "floor_covering";
  }
  if (namesDeck || (namesBoards && briefHasDeck(brief) && !namesFloor)) {
    return "deck_boards";
  }
  if (namesBoards && briefHasFloorCovering(brief) && !briefHasDeck(brief)) {
    return "floor_covering";
  }
  return "unspecified";
}

function mentions(text: string): WasteMention[] {
  const brief = text;
  const found: WasteMention[] = [];
  for (const sentence of sentences(text)) {
    const percent = percentFromSentence(sentence);
    if (percent == null) continue;
    found.push({ percent, subject: subjectOf(sentence, brief) });
  }
  return found;
}

export function explicitMaterialWastePercent(
  text: string,
  subject: MaterialWasteSubject
): number | null {
  const found = mentions(text);
  const exact = found.filter((row) => row.subject === subject);
  const exactPercents = [...new Set(exact.map((row) => row.percent))];
  if (exactPercents.length === 1) return exactPercents[0]!;
  if (exactPercents.length > 1) return null;

  const unspecified = found.filter((row) => row.subject === "unspecified");
  const unspecifiedPercents = [...new Set(unspecified.map((row) => row.percent))];
  if (unspecifiedPercents.length !== 1) return null;
  const otherPresent =
    subject === "floor_covering" ? briefHasDeck(text) : briefHasFloorCovering(text);
  if (otherPresent) return null;
  return unspecifiedPercents[0]!;
}

export function ambiguousMaterialWasteWarning(text: string): string | null {
  const found = mentions(text);
  if (found.length === 0) return null;
  if (
    explicitMaterialWastePercent(text, "floor_covering") != null ||
    explicitMaterialWastePercent(text, "deck_boards") != null
  ) {
    return null;
  }
  return "A waste percent is stated, but the brief does not say which assembly it belongs to. It was not copied onto either.";
}
