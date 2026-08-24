/**
 * RETAINING-WALL-MATURITY-1C — shared brief → Project Condition contract.
 *
 * Extraction and Clarify suppression use the same matchers so a captured
 * access/carry fact is a consumed Project Condition, not a hidden question.
 */

export const OWNER_RW_PREVIEW_BRIEF =
  "1.6m high on one end, dropping to 0.6m high at the other end timber retaining wall, 15m long. Moderate access, around 30m distance, requires excavation.";

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function briefHasExplicitPileSpacing(briefText: string): boolean {
  return /pile\s+(?:centres|centers|spacing)|post\s+(?:centres|centers|spacing)|spacing\s+of\s+\d|(?:centres|centers)\s+\d/i.test(
    briefText
  );
}

export function briefHasSpoilCartingLanguage(briefText: string): boolean {
  return /carting|spoil|skip bin|waste cart|haul(?:age)?/i.test(briefText);
}

export function matchCarryDistanceMetresFromBrief(
  briefText: string
): number | null {
  const text = normalise(briefText);
  const patterns: RegExp[] = [
    /(?:around|about|approximately|approx\.?)\s+(\d+(?:\.\d+)?)\s*m\s+distance/,
    /(\d+(?:\.\d+)?)\s*m\s+distance(?!\s*(?:long|length|high|height|wide))/,
    /(?:around|about|approximately|approx\.?)\s+(\d+(?:\.\d+)?)\s*m\s+(?:carry|carting|from\s+drop-?off)/,
    /(\d+(?:\.\d+)?)\s*m\s+(?:material\s+)?(?:carry|carting)/,
    /(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*m\s*(?:manual\s+)?(?:carry|carting)/,
    /(?:carry|carting)\s+(?:distance\s+)?(?:of\s+)?(?:around|about|approximately|approx\.?)?\s*(\d+(?:\.\d+)?)\s*m/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const upper = match[2] != null ? Number(match[2]) : Number(match[1]);
    const metres = Number.isFinite(upper) ? upper : Number(match[1]);
    if (Number.isFinite(metres) && metres > 0) return metres;
  }
  return null;
}

export function mapCarryMetresToProjectBand(metres: number): string {
  if (metres < 10) return "< 10m";
  if (metres <= 30) return "10–30m";
  return "> 30m";
}

export function briefSuppliesCarryDistance(briefText: string): boolean {
  if (matchCarryDistanceMetresFromBrief(briefText) != null) return true;
  // Existing Deck/Clarify language: "carry" is enough to suppress a duplicate ask.
  // Do not treat a bare metre figure as carry.
  return /carry|carting/i.test(briefText);
}

export function briefSuppliesSiteAccess(briefText: string): boolean {
  return /restricted(?:\s+\w+)?\s+access|difficult access|easy access|rear access|site access|limited access|moderate access|poor access/i.test(
    briefText
  );
}

export function matchRetainingWallLengthM(briefText: string): number | null {
  const text = normalise(briefText);
  const long = text.match(/(\d+(?:\.\d+)?)\s*m\s+long/);
  if (long) {
    const n = Number(long[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const named = text.match(
    /(\d+(?:\.\d+)?)\s*m\s+(?:timber\s+|concrete\s+|sleeper\s+|masonry\s+)?retaining\s+wall/
  );
  if (named) {
    const n = Number(named[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export function matchRetainingWallRakingHeightsM(
  briefText: string
): { highM: number; lowM: number } | null {
  const text = normalise(briefText);
  const pair = text.match(
    /(\d+(?:\.\d+)?)\s*m\s+high\s+on\s+one\s+end[\s\S]{0,80}?(\d+(?:\.\d+)?)\s*m\s+high/
  );
  if (!pair) return null;
  const a = Number(pair[1]);
  const b = Number(pair[2]);
  if (!(Number.isFinite(a) && a > 0 && Number.isFinite(b) && b > 0)) {
    return null;
  }
  return { highM: Math.max(a, b), lowM: Math.min(a, b) };
}

export function briefRequiresExcavation(briefText: string): boolean {
  return /requires excavation|excavation required|include excavation/i.test(
    briefText
  );
}
