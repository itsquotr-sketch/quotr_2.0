/**
 * Deterministic brief → Work Area Instance proposals.
 *
 * Repeated same-type instances are created when the brief names distinct
 * locations / rooms / packages. Nested construction variants stay inside
 * one instance (see Internal Walls wall_types).
 */

import { COORDINATION_ORIGINAL_BRIEF } from "@/lib/estimate/internal-walls-brief";
import { briefHasExplicitInternalWalls } from "@/lib/work-areas/ownership";

export type DiscoveredWorkAreaInstance = {
  readonly type: string;
  readonly name: string;
  readonly evidence: string;
};

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function uniqueByName(
  rows: readonly DiscoveredWorkAreaInstance[]
): DiscoveredWorkAreaInstance[] {
  const seen = new Set<string>();
  const out: DiscoveredWorkAreaInstance[] = [];
  for (const row of rows) {
    const key = `${row.type}::${row.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function discoverBathrooms(brief: string): DiscoveredWorkAreaInstance[] {
  const found: DiscoveredWorkAreaInstance[] = [];
  const labelled: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\bmaster ensuite\b/, name: "Master Ensuite" },
    { pattern: /\bmain family bathroom\b/, name: "Main Family Bathroom" },
    { pattern: /\bdownstairs bathroom\b/, name: "Downstairs Bathroom" },
    { pattern: /\bupstairs bathroom\b/, name: "Upstairs Bathroom" },
    { pattern: /\bguest bathroom\b/, name: "Guest Bathroom" },
    { pattern: /\bmain bathroom\b/, name: "Main Bathroom" },
    { pattern: /\bfamily bathroom\b/, name: "Family Bathroom" },
  ];
  for (const row of labelled) {
    if (!row.pattern.test(brief)) continue;
    const overlapping = found.some((existing) => {
      const a = existing.name.toLowerCase();
      const b = row.name.toLowerCase();
      return a.includes(b) || b.includes(a);
    });
    if (overlapping) continue;
    found.push({
      type: "bathroom",
      name: row.name,
      evidence: row.name,
    });
  }
  if (found.length === 0 && /\bbathroom/.test(brief)) {
    found.push({
      type: "bathroom",
      name: "Bathroom",
      evidence: "Bathroom mentioned",
    });
  }
  return uniqueByName(found);
}

function discoverDecks(brief: string): DiscoveredWorkAreaInstance[] {
  const found: DiscoveredWorkAreaInstance[] = [];
  if (/\brear deck\b|\bback deck\b/.test(brief)) {
    found.push({
      type: "deck",
      name: "Rear Deck",
      evidence: "Rear / back deck",
    });
  }
  if (
    /\bfront entrance deck\b|\bfront entry deck\b|\bdeck at the front entrance\b|\bfront entrance\b/.test(
      brief
    ) &&
    /\bdeck\b/.test(brief)
  ) {
    found.push({
      type: "deck",
      name: "Front Entrance Deck",
      evidence: "Front entrance deck",
    });
  } else if (/\bfront deck\b/.test(brief)) {
    found.push({
      type: "deck",
      name: "Front Deck",
      evidence: "Front deck",
    });
  }
  if (found.length === 0 && /\bdeck\b/.test(brief)) {
    found.push({
      type: "deck",
      name: "Deck",
      evidence: "Deck mentioned",
    });
  }
  return uniqueByName(found);
}

const SINGLE_INTERNAL_WALLS_INSTANCE: DiscoveredWorkAreaInstance = {
  type: "internal_walls",
  name: "Internal walls",
  evidence: "Internal walls / partitions",
};

type InternalWallLocation = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly partitionsName: string;
  readonly wallsName: string;
};

/**
 * Distinct logical LOCATION / commercial PACKAGE identities.
 * Physical wall specification (lining, timber size, steel vs timber)
 * is not a location and must not create another Work Area.
 */
const INTERNAL_WALL_LOCATIONS: readonly InternalWallLocation[] = [
  {
    id: "ground_floor",
    pattern: /\bground[-\s]?floor\b|\bdownstairs\b/,
    partitionsName: "Ground Floor Partitions",
    wallsName: "Ground Floor Internal Walls",
  },
  {
    id: "upstairs",
    pattern: /\bupstairs\b/,
    partitionsName: "Upstairs Partitions",
    wallsName: "Upstairs Internal Walls",
  },
  {
    id: "level_1",
    pattern: /\bfirst[-\s]?floor\b|\blevel\s*1\b|\b1st[-\s]?floor\b/,
    partitionsName: "Level 1 Partitions",
    wallsName: "Level 1 Internal Walls",
  },
  {
    id: "second_floor",
    pattern: /\bsecond[-\s]?floor\b|\blevel\s*2\b|\b2nd[-\s]?floor\b/,
    partitionsName: "Second Floor Partitions",
    wallsName: "Second Floor Internal Walls",
  },
];

function hasExplicitMultiPackageLanguage(brief: string): boolean {
  return (
    /\b(?:two|2)\s+separate\b/.test(brief) ||
    /\bseparate(?:ly)?\s+(?:packages?|internal[-\s]walls?|partitions?)\b/.test(
      brief
    ) ||
    /\bseparate packages?\b/.test(brief) ||
    (/\bsplit into\b/.test(brief) && /\bpackages?\b/.test(brief)) ||
    /\bseparate internal walls\b/.test(brief)
  );
}

function locationBoundToWallScope(
  brief: string,
  location: InternalWallLocation
): boolean {
  const compound =
    new RegExp(
      `${location.pattern.source}\\s+(?:office\\s+)?(?:partitions?|internal[-\s]walls?)`,
      "i"
    ).test(brief) ||
    new RegExp(
      `(?:partitions?|internal[-\s]walls?)\\s+(?:to(?:\\s+the)?\\s+|on(?:\\s+the)?\\s+)?${location.pattern.source}`,
      "i"
    ).test(brief);
  return compound;
}

function usesPartitionNoun(brief: string): boolean {
  return /\bpartitions?\b/.test(brief);
}

function namedPackageHits(brief: string): DiscoveredWorkAreaInstance[] {
  const found: DiscoveredWorkAreaInstance[] = [];
  const labelled: Array<{ pattern: RegExp; name: string; evidence: string }> = [
    {
      pattern: /\bground[-\s]?floor office\b/,
      name: "Ground Floor Office",
      evidence: "Ground-floor office partitions",
    },
    {
      pattern: /\bupstairs tenancy\b/,
      name: "Upstairs Tenancy",
      evidence: "Upstairs tenancy partitions",
    },
    {
      pattern: /\bground[-\s]?floor partitions?\b/,
      name: "Ground Floor Partitions",
      evidence: "Ground floor partitions",
    },
    {
      pattern: /\bupstairs partitions?\b/,
      name: "Upstairs Partitions",
      evidence: "Upstairs partitions",
    },
    {
      pattern: /\bground[-\s]?floor internal[-\s]walls?\b|\binternal[-\s]walls? (?:to(?: the)? |on(?: the)? )?ground[-\s]?floor\b/,
      name: "Ground Floor Internal Walls",
      evidence: "Ground floor internal walls",
    },
    {
      pattern: /\bupstairs internal[-\s]walls?\b|\binternal[-\s]walls? upstairs\b/,
      name: "Upstairs Internal Walls",
      evidence: "Upstairs internal walls",
    },
    {
      pattern: /\b(?:first[-\s]?floor|level\s*1|1st[-\s]?floor) partitions?\b/,
      name: "Level 1 Partitions",
      evidence: "Level 1 partitions",
    },
  ];
  for (const row of labelled) {
    if (!row.pattern.test(brief)) continue;
    found.push({
      type: "internal_walls",
      name: row.name,
      evidence: row.evidence,
    });
  }
  return uniqueByName(found);
}

function locationPackageHits(brief: string): DiscoveredWorkAreaInstance[] {
  const noun = usesPartitionNoun(brief) ? "partitions" : "walls";
  const hits: DiscoveredWorkAreaInstance[] = [];
  for (const location of INTERNAL_WALL_LOCATIONS) {
    if (!location.pattern.test(brief)) continue;
    hits.push({
      type: "internal_walls",
      name: noun === "partitions" ? location.partitionsName : location.wallsName,
      evidence: location.id.replace(/_/g, " "),
    });
  }
  return uniqueByName(hits);
}

function discoverInternalWallGroups(brief: string): DiscoveredWorkAreaInstance[] {
  if (!briefHasExplicitInternalWalls(brief) && !/\bpartition/.test(brief)) {
    return [];
  }
  const original = normalise(COORDINATION_ORIGINAL_BRIEF);
  if (brief === original || brief.includes("removing 3 internal walls")) {
    return [
      {
        type: "internal_walls",
        name: "Internal walls",
        evidence: "Single rebuild package with nested Wall Types",
      },
    ];
  }

  const groundOffice =
    /\bground[-\s]?floor office\b/.test(brief) ||
    (/\bground[-\s]?floor\b/.test(brief) && /\boffice\b/.test(brief));
  const upstairsTenancy = /\bupstairs tenancy\b/.test(brief);
  const separately = /\bseparately\b/.test(brief);
  if (groundOffice && (upstairsTenancy || separately)) {
    const groups: DiscoveredWorkAreaInstance[] = [
      {
        type: "internal_walls",
        name: "Ground Floor Office",
        evidence: "Ground-floor office partitions",
      },
    ];
    if (upstairsTenancy) {
      groups.push({
        type: "internal_walls",
        name: "Upstairs Tenancy",
        evidence: "Upstairs tenancy partitions",
      });
    } else {
      groups.push({
        type: "internal_walls",
        name: usesPartitionNoun(brief)
          ? "Upstairs Partitions"
          : "Upstairs Internal Walls",
        evidence: "Separate upstairs partitions",
      });
    }
    return uniqueByName(groups);
  }

  const named = namedPackageHits(brief);
  if (named.length >= 2) return named;

  const boundLocations = INTERNAL_WALL_LOCATIONS.filter((location) =>
    locationBoundToWallScope(brief, location)
  );
  if (boundLocations.length >= 2) {
    const noun = usesPartitionNoun(brief) ? "partitions" : "walls";
    return uniqueByName(
      boundLocations.map((location) => ({
        type: "internal_walls" as const,
        name:
          noun === "partitions" ? location.partitionsName : location.wallsName,
        evidence: location.id.replace(/_/g, " "),
      }))
    );
  }

  const packageHits = locationPackageHits(brief);
  if (packageHits.length >= 2 && hasExplicitMultiPackageLanguage(brief)) {
    return packageHits;
  }

  if (named.length === 1 && packageHits.length >= 2 && hasExplicitMultiPackageLanguage(brief)) {
    return packageHits;
  }

  return named.length === 1 ? named : [SINGLE_INTERNAL_WALLS_INSTANCE];
}

/**
 * Slice of the brief that belongs to one discovered Internal Walls instance.
 * Used so instance-specific facts do not bind to ofType[0].
 *
 * Concatenates every span that starts with this instance's name until the
 * next sibling name, so a later measured sentence is not lost to an
 * earlier heading mention.
 */
export function snippetForDiscoveredInstance(
  briefText: string,
  instance: DiscoveredWorkAreaInstance,
  siblings: readonly DiscoveredWorkAreaInstance[]
): string {
  const hay = normalise(briefText);
  const names = [instance, ...siblings]
    .map((row) => row.name.toLowerCase())
    .filter((name, index, all) => all.indexOf(name) === index);
  type Hit = { name: string; index: number };
  const hits: Hit[] = [];
  for (const name of names) {
    let from = 0;
    while (from < hay.length) {
      const index = hay.indexOf(name, from);
      if (index < 0) break;
      hits.push({ name, index });
      from = index + Math.max(name.length, 1);
    }
  }
  hits.sort((a, b) => a.index - b.index);
  const own = instance.name.toLowerCase();
  const parts: string[] = [];
  for (let i = 0; i < hits.length; i += 1) {
    const hit = hits[i]!;
    if (hit.name !== own) continue;
    const end = hits[i + 1]?.index ?? hay.length;
    parts.push(hay.slice(hit.index, end).trim());
  }
  if (parts.length > 0) return parts.join(" ");
  return hay;
}

export function discoverWorkAreaInstances(
  briefText: string
): DiscoveredWorkAreaInstance[] {
  const brief = normalise(briefText);
  return [
    ...discoverBathrooms(brief),
    ...discoverDecks(brief),
    ...discoverInternalWallGroups(brief),
  ];
}

export function titleCaseInstanceName(value: string): string {
  return titleCase(value);
}

/**
 * New Work Area Instance when scope is separable by location, room,
 * client grouping, commercial package, or independent job context.
 *
 * Nested item when several physical variants belong to one logical area.
 */
export function shouldSplitWorkAreaInstances(params: {
  readonly type: string;
  readonly discovered: readonly DiscoveredWorkAreaInstance[];
}): boolean {
  return params.discovered.filter((row) => row.type === params.type).length > 1;
}
