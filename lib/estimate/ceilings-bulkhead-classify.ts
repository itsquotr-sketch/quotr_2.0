/**
 * Deterministic bulkhead topology classification from brief text.
 * Shared by extraction and stale-state heal. No persistence.
 */

export type ClassifiedCeilingBulkheadForm =
  | "conventional_two_face_downstand"
  | "island"
  | "boxed"
  | "complex";

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

const BULKHEAD_ISLAND_SIGNALS = [
  "island bulkhead",
  "island bulkheads",
] as const;

const BULKHEAD_BOXED_SIGNALS = [
  "boxed bulkhead",
  "box bulkhead",
  "four-sided bulkhead",
  "four sided bulkhead",
  "4 sided bulkhead",
] as const;

const BULKHEAD_COMPLEX_SIGNALS = [
  "complex bulkhead",
  "feature bulkhead",
  "feature ceiling bulkhead",
  "curved bulkhead",
  "curved bulkheads",
  "curved feature bulkhead",
  "floating bulkhead",
  "floating bulkheads",
  "structural transfer bulkhead",
  "transfer bulkhead",
  "services bulkhead",
  "service bulkhead",
  "oversized bulkhead",
  "oversize bulkhead",
] as const;

const BULKHEAD_NON_WALL_ADJACENT_SIGNALS = [
  "in the middle of the room",
  "in the middle of a room",
  "middle of the room",
  "centre of the room",
  "center of the room",
  "exposed on all sides",
  "exposed all sides",
  "not against a wall",
  "not against the wall",
  "not wall-adjacent",
  "not wall adjacent",
] as const;

const BULKHEAD_ORDINARY_SIGNALS = [
  "wall-adjacent",
  "wall adjacent",
  "against the wall",
  "against a wall",
  "standard downstand",
  "ordinary downstand",
  "conventional downstand",
  "standard bulkhead",
  "ordinary bulkhead",
  "conventional bulkhead",
] as const;

/**
 * Neutral ceiling-brief tokens. Leftover tokens after stripping these are
 * treated as bulkhead qualifiers. Keep this as an allowlist of non-topology
 * words, not a construction ontology.
 */
const BULKHEAD_BRIEF_NEUTRAL_TOKENS = new Set([
  "a",
  "an",
  "the",
  "with",
  "and",
  "add",
  "added",
  "plus",
  "including",
  "include",
  "also",
  "of",
  "for",
  "to",
  "or",
  "one",
  "some",
  "another",
  "in",
  "on",
  "at",
  "from",
  "by",
  "is",
  "are",
  "has",
  "have",
  "needs",
  "need",
  "please",
  "replace",
  "replaced",
  "reline",
  "relining",
  "new",
  "existing",
  "ceiling",
  "ceilings",
  "room",
  "lounge",
  "hallway",
  "hall",
  "bedroom",
  "kitchen",
  "garage",
  "office",
  "living",
  "main",
  "plasterboard",
  "plaster",
  "board",
  "gib",
  "standard",
  "fyreline",
  "aqualine",
  "timber",
  "steel",
  "framing",
  "lining",
  "sheets",
  "sheet",
  "layers",
  "layer",
  "mm",
  "m",
  "metres",
  "meters",
  "metre",
  "meter",
  "high",
  "height",
  "x",
  "by",
  "complete",
  "replacement",
  "job",
  "area",
  "sqm",
  "square",
  "direct",
  "fix",
  "direct-fix",
  "battens",
  "batten",
  "joists",
  "joist",
  "structure",
  "suitable",
  "over",
  "insulation",
  "stopping",
  "painting",
  "demolition",
  "drop",
  "dropped",
  "suspended",
  "dropper",
  "rondo",
  "furring",
  "channel",
  "grid",
  "tile",
  "tiles",
  "t-bar",
  "tbar",
  "t",
  "bar",
  "plywood",
  "ply",
  "lined",
  "two",
  "three",
  "bulkhead",
  "bulkheads",
  "downstand",
  "long",
  "length",
  "deep",
  "depth",
  "wide",
  "width",
  "projection",
  "framed",
  "insulated",
  "thermal",
  "plastered",
  "painted",
  "paint",
  "line",
  "millimetres",
  "millimeters",
  "millimetre",
  "millimeter",
]);

function hasRecognisedBulkheadMention(raw: string): boolean {
  return /\bbulkheads?\b/.test(raw) || /\bdownstand\b/.test(raw);
}

function hasPositiveBulkheadMention(raw: string): boolean {
  const stripped = raw
    .replace(/\bno bulkheads?\b/g, " ")
    .replace(/\bwithout (?:a |any )?bulkheads?\b/g, " ");
  return hasRecognisedBulkheadMention(stripped);
}

function leftoverBulkheadQualifierTokens(raw: string): string[] {
  const withoutDims = raw
    .replace(/\d+(?:\.\d+)?/g, " ")
    .replace(/[^\p{L}\s-]+/gu, " ")
    .replace(/-/g, " ");
  return withoutDims
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(
      (token) => token.length > 0 && !BULKHEAD_BRIEF_NEUTRAL_TOKENS.has(token)
    );
}

export function bulkheadMentionWindows(raw: string): string {
  const windows: string[] = [];
  const re = /\bbulkheads?\b|\bdownstand\b/gi;
  for (const match of raw.matchAll(re)) {
    const index = match.index ?? 0;
    windows.push(
      raw.slice(Math.max(0, index - 80), index + match[0].length + 80)
    );
  }
  return windows.join(" ");
}

/**
 * WA-08-R5/R6 — conservative, deterministic bulkhead classification.
 * Specialist / contradictory topology signals win. Ordinary material,
 * framing, finish and dimension descriptors do not make a bulkhead
 * specialist. Bare "bulkhead" may keep the disclosed ordinary assumption.
 */
export function classifyCeilingBulkheadFormFromText(
  text: string
): ClassifiedCeilingBulkheadForm | null {
  const raw = normalise(text);
  if (!hasRecognisedBulkheadMention(raw)) return null;
  if (!hasPositiveBulkheadMention(raw)) return null;

  if (includesAny(raw, BULKHEAD_ISLAND_SIGNALS)) return "island";
  if (includesAny(raw, BULKHEAD_BOXED_SIGNALS)) return "boxed";
  if (
    includesAny(raw, BULKHEAD_COMPLEX_SIGNALS) ||
    includesAny(raw, BULKHEAD_NON_WALL_ADJACENT_SIGNALS)
  ) {
    return "complex";
  }

  if (includesAny(raw, BULKHEAD_ORDINARY_SIGNALS)) {
    return "conventional_two_face_downstand";
  }

  if (!/\bbulkheads?\b/.test(raw)) return null;
  const qualifierSource = bulkheadMentionWindows(raw) || raw;
  if (leftoverBulkheadQualifierTokens(qualifierSource).length === 0) {
    return "conventional_two_face_downstand";
  }
  return "complex";
}
