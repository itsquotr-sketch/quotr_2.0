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
  const groups: DiscoveredWorkAreaInstance[] = [];
  const groundOffice =
    /\bground[-\s]?floor office\b/.test(brief) ||
    /\bground[-\s]?floor\b/.test(brief) && /\boffice\b/.test(brief);
  const upstairsTenancy = /\bupstairs tenancy\b/.test(brief);
  const separately = /\bseparately\b/.test(brief);
  if (groundOffice && (upstairsTenancy || separately)) {
    groups.push({
      type: "internal_walls",
      name: "Ground Floor Office",
      evidence: "Ground-floor office partitions",
    });
  }
  if (upstairsTenancy) {
    groups.push({
      type: "internal_walls",
      name: "Upstairs Tenancy",
      evidence: "Upstairs tenancy partitions",
    });
  }
  if (groups.length >= 2) return uniqueByName(groups);
  const groundPartitions =
    /\bground[-\s]?floor partitions?\b/.test(brief) ||
    (/\bground[-\s]?floor\b/.test(brief) &&
      /\bpartitions?\b/.test(brief) &&
      !groundOffice);
  const upstairsPartitions = /\bupstairs partitions?\b/.test(brief);
  if (groundPartitions && upstairsPartitions) {
    return uniqueByName([
      {
        type: "internal_walls",
        name: "Ground Floor Partitions",
        evidence: "Ground floor partitions",
      },
      {
        type: "internal_walls",
        name: "Upstairs Partitions",
        evidence: "Upstairs partitions",
      },
    ]);
  }
  return [
    {
      type: "internal_walls",
      name: "Internal walls",
      evidence: "Internal walls / partitions",
    },
  ];
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
