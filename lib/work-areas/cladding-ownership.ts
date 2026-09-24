/**
 * CLADDING-01B — brief ownership for a future Cladding Work Area.
 *
 * Decides whether Cladding exists. Does not extract portions, facts, or money.
 * Joinery Install is an ISD catalogue id only. This module does not create a
 * Joinery calculator and does not route windows into Doors.
 */

export const CLADDING_JOINERY_INSTALL_BOUNDARY =
  "Joinery Install remains an ISD catalogue id. Windows stay an unsupported Work Area. Cladding ownership does not create a Joinery calculator and does not route windows into Doors." as const;

export type CladdingRecognisedFamily =
  | "timber"
  | "fibre_cement"
  | "brick_veneer"
  | "masonry"
  | "other";

export type CladdingOwnershipDecision = {
  readonly claddingPresent: boolean;
  readonly suppressed: boolean;
  readonly removalOnly: boolean;
  readonly connectedRemoval: boolean;
  readonly widerDemolitionOwnsPackage: boolean;
  readonly paintingCoexists: boolean;
  readonly recommendedScopeIntent:
    | "install"
    | "replace"
    | "removal_only"
    | "suppressed"
    | null;
  readonly recognisedFamily: CladdingRecognisedFamily | null;
  readonly routeWindowsToDoors: false;
  readonly createsJoineryCalculator: false;
  readonly mutatesInternalWalls: false;
  readonly mutatesDoors: false;
  readonly unrelatedWorkAreas: readonly [];
  readonly portions: readonly [];
  readonly evidence: string;
};

const SUPPRESSED_PHRASES = [
  "cladding by others",
  "existing cladding retained",
  "no cladding work",
  "exclude cladding",
  "cladding not included",
] as const;

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function clausesOf(brief: string): string[] {
  const parts = normalise(brief)
    .split(/[.;\n]+/)
    .map((row) => row.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [normalise(brief)];
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function clauseSuppressed(clause: string): boolean {
  return includesAny(clause, SUPPRESSED_PHRASES);
}

function clauseIsWiderDemolition(clause: string): boolean {
  return (
    /\bstrip[-\s]?out\b/.test(clause) ||
    /\bsoft strip\b/.test(clause) ||
    /\bdemolish\b/.test(clause) ||
    /\bdemolition\b/.test(clause) ||
    /\brip out\b/.test(clause)
  );
}

function clauseMentionsCladding(clause: string): boolean {
  return (
    /\bcladding\b/.test(clause) ||
    /\bweatherboards?\b/.test(clause) ||
    /\breclad/.test(clause) ||
    /\blinea\b/.test(clause) ||
    /\bbrick veneer\b/.test(clause) ||
    /\bmasonry veneer\b/.test(clause)
  );
}

function clauseIsIndependentNewCladding(clause: string): boolean {
  if (clauseSuppressed(clause)) return false;
  if (clauseIsRemovalOnly(clause)) return false;
  return (
    /\binstall\b/.test(clause) ||
    /\breplace\b/.test(clause) ||
    /\breclad/.test(clause) ||
    /\bnew weatherboards?\b/.test(clause) ||
    /\bnew cladding\b/.test(clause)
  );
}

function clauseIsRemovalOnly(clause: string): boolean {
  if (clauseIsIndependentNewCladdingUnsafe(clause)) return false;
  return (
    /\bremove existing cladding only\b/.test(clause) ||
    /\bcladding removal only\b/.test(clause) ||
    /\bremove cladding only\b/.test(clause) ||
    (/\bremove existing cladding\b/.test(clause) &&
      !/\binstall\b|\breplace\b|\breclad/.test(clause))
  );
}

function clauseIsIndependentNewCladdingUnsafe(clause: string): boolean {
  return (
    /\binstall\b/.test(clause) ||
    /\breplace\b/.test(clause) ||
    /\breclad/.test(clause) ||
    /\bnew weatherboards?\b/.test(clause) ||
    /\bnew cladding\b/.test(clause)
  );
}

function clauseIsPositive(clause: string): boolean {
  if (clauseSuppressed(clause)) return false;
  if (clauseIsWiderDemolition(clause) && !clauseIsIndependentNewCladding(clause)) {
    return false;
  }
  if (clauseIsRemovalOnly(clause)) return true;
  if (!clauseMentionsCladding(clause) && !/\bfeature cladding\b/.test(clause)) {
    return false;
  }
  return (
    /\binstall timber cladding\b/.test(clause) ||
    /\breplace weatherboards?\b/.test(clause) ||
    /\breclad/.test(clause) ||
    /\binstall fibre-cement weatherboards?\b/.test(clause) ||
    /\binstall fibre cement weatherboards?\b/.test(clause) ||
    /\binstall fiber-cement weatherboards?\b/.test(clause) ||
    /\binstall linea weatherboards?\b/.test(clause) ||
    /\bbrick veneer cladding\b/.test(clause) ||
    /\bmasonry veneer\b/.test(clause) ||
    /\bexterior timber feature cladding\b/.test(clause) ||
    /\binstall cladding\b/.test(clause) ||
    /\bnew cladding\b/.test(clause) ||
    /\bnew weatherboards?\b/.test(clause) ||
    (/\binstall\b/.test(clause) && /\bweatherboards?\b/.test(clause)) ||
    clauseIsRemovalOnly(clause)
  );
}

function recognisedFamily(clause: string): CladdingRecognisedFamily | null {
  if (/\bbrick veneer\b/.test(clause)) return "brick_veneer";
  if (/\bmasonry veneer\b/.test(clause)) return "masonry";
  if (/\bfibre-cement\b|\bfibre cement\b|\bfiber-cement\b|\blinea\b/.test(clause)) {
    return "fibre_cement";
  }
  if (/\btimber\b|\bweatherboards?\b/.test(clause)) return "timber";
  if (/\bcladding\b/.test(clause)) return null;
  return null;
}

function emptyDecision(evidence: string): CladdingOwnershipDecision {
  return {
    claddingPresent: false,
    suppressed: false,
    removalOnly: false,
    connectedRemoval: false,
    widerDemolitionOwnsPackage: false,
    paintingCoexists: false,
    recommendedScopeIntent: null,
    recognisedFamily: null,
    routeWindowsToDoors: false,
    createsJoineryCalculator: false,
    mutatesInternalWalls: false,
    mutatesDoors: false,
    unrelatedWorkAreas: [],
    portions: [],
    evidence,
  };
}

/**
 * Pure brief classification. Returns no portions and no fact patches.
 */
export function classifyCladdingOwnership(
  briefText: string
): CladdingOwnershipDecision {
  const brief = normalise(briefText);
  if (!brief) return emptyDecision("Empty brief");
  const clauses = clausesOf(brief);
  const suppressed = clauses.some(clauseSuppressed);
  const positiveClauses = clauses.filter(clauseIsPositive);
  const removalOnly = positiveClauses.some(clauseIsRemovalOnly);
  const replaceLike = positiveClauses.some(
    (clause) =>
      /\breplace weatherboards?\b|\breclad\b|\breplace\b/.test(clause) &&
      clauseMentionsCladding(clause)
  );
  const wider = clauses.some(
    (clause) =>
      clauseIsWiderDemolition(clause) &&
      clauseMentionsCladding(clause) &&
      !clauseIsIndependentNewCladding(clause)
  );
  const independentNew = clauses.some(clauseIsIndependentNewCladding);
  const present =
    positiveClauses.length > 0 && !(suppressed && positiveClauses.length === 0);
  const suppressedWins = suppressed && !present;
  const paintingCoexists =
    present &&
    (/\bpaint\b/.test(brief) || /\bpainting\b/.test(brief));
  const familyClause = positiveClauses.find((clause) => recognisedFamily(clause));
  let intent: CladdingOwnershipDecision["recommendedScopeIntent"] = null;
  if (suppressedWins) intent = "suppressed";
  else if (removalOnly && !replaceLike) intent = "removal_only";
  else if (replaceLike) intent = "replace";
  else if (present) intent = "install";

  return {
    claddingPresent: present && !suppressedWins,
    suppressed: suppressedWins || (suppressed && !present),
    removalOnly: present && removalOnly && !replaceLike,
    connectedRemoval: present && replaceLike,
    widerDemolitionOwnsPackage: wider && !independentNew,
    paintingCoexists,
    recommendedScopeIntent: intent,
    recognisedFamily: familyClause ? recognisedFamily(familyClause) : null,
    routeWindowsToDoors: false,
    createsJoineryCalculator: false,
    mutatesInternalWalls: false,
    mutatesDoors: false,
    unrelatedWorkAreas: [],
    portions: [],
    evidence: present
      ? "Cladding scope is explicit"
      : suppressed
        ? "Cladding is explicitly excluded"
        : wider
          ? "Wider demolition owns the package"
          : "No cladding scope",
  };
}
