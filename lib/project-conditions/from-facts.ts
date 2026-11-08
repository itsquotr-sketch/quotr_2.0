import {
  DUPLICATE_FACT_TO_CONSTRAINT,
  resolveCanonicalProjectConditionKey,
  type CanonicalProjectConditionKey,
} from "@/lib/project-conditions/canonical";
import { isNotSureValue } from "@/lib/estimate/facts";

export type ProjectConditionFact = {
  readonly key: string;
  readonly value: unknown;
};

export type ProjectConditionWrite = {
  readonly key: CanonicalProjectConditionKey;
  readonly label: string;
  readonly value: string;
};

const PROJECT_FACT_TO_CONSTRAINT: Readonly<
  Record<string, { key: CanonicalProjectConditionKey; label: string }>
> = {
  "project.site_access": { key: "site_access", label: "Site access" },
  "project.material_carry_distance": {
    key: "material_carry_distance",
    label: "Material carry distance",
  },
  "project.floor_level": { key: "floor_level", label: "Floor level" },
  "project.occupancy_status": { key: "occupied_site", label: "Occupied site" },
  "project.occupied_site": { key: "occupied_site", label: "Occupied site" },
  "project.working_hours": { key: "working_hours", label: "Working hours" },
};

const CONSTRAINT_LABEL: Record<CanonicalProjectConditionKey, string> = {
  site_access: "Site access",
  high_level_access: "High-level access",
  material_carry_distance: "Material carry distance",
  floor_level: "Floor level",
  occupied_site: "Occupied site",
  working_hours: "Working hours",
  parking_loading: "Parking / loading",
  waste_bin_access: "Waste access",
  hazardous_materials_risk: "Hazardous materials",
  services_isolated: "Services isolated",
  protection_dust_control: "Protection / dust control",
  site_slope: "Site slope",
  client_supplied_items: "Client-supplied items",
  by_others_trades: "By-others trades",
  consent_engineering: "Consent / engineering",
};

function text(value: unknown): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

export function normaliseProjectConditionValue(
  key: CanonicalProjectConditionKey,
  value: unknown
): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (isNotSureValue(raw)) return "Not sure";
  const lower = raw.toLowerCase().replace(/\s+/g, " ");

  if (key === "site_access") {
    if (lower === "easy" || lower === "standard access") return "Easy";
    if (lower === "moderate") return "Moderate";
    if (lower === "difficult" || lower === "restricted") return "Difficult";
    if (lower === "very poor" || lower === "verypoor") return "Very poor";
    return null;
  }
  if (key === "material_carry_distance") {
    if (/under\s*10|<\s*10|less than 10|short carry/.test(lower)) return "< 10m";
    if (/10\s*[–-]\s*30|10 to 30|moderate carry/.test(lower)) return "10–30m";
    if (/>\s*30|over 30|more than 30|long carry/.test(lower)) return "> 30m";
    const metres = Number(lower.replace(/[^\d.]/g, ""));
    if (Number.isFinite(metres) && metres > 0 && /m/.test(lower)) {
      if (metres < 10) return "< 10m";
      if (metres <= 30) return "10–30m";
      return "> 30m";
    }
    return null;
  }
  if (key === "floor_level") {
    if (/ground/.test(lower)) return "Ground";
    if (/upper|first floor|second floor|upstairs/.test(lower)) return "Upper floor";
    if (/basement|lower ground/.test(lower)) return "Basement";
    return null;
  }
  if (key === "occupied_site") {
    if (/unoccupied|not occupied|vacant|^no$/.test(lower)) return "No";
    if (/occupied|^yes$/.test(lower)) return "Yes";
    return null;
  }
  if (key === "working_hours") {
    if (/unrestricted|no restriction|^no$|normal hours/.test(lower)) return "No";
    if (/restrict|^yes$|after hours/.test(lower)) return "Yes";
    return null;
  }
  if (lower === "yes" || lower === "true") return "Yes";
  if (lower === "no" || lower === "false") return "No";
  return null;
}

function writeFor(
  key: CanonicalProjectConditionKey,
  value: unknown
): ProjectConditionWrite | null {
  const normalised = normaliseProjectConditionValue(key, value);
  if (!normalised) return null;
  return { key, label: CONSTRAINT_LABEL[key], value: normalised };
}

export function projectConditionWritesFromFacts(
  facts: readonly ProjectConditionFact[]
): ProjectConditionWrite[] {
  const writes: ProjectConditionWrite[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    const project = PROJECT_FACT_TO_CONSTRAINT[fact.key];
    const duplicate = DUPLICATE_FACT_TO_CONSTRAINT[fact.key];
    const key = project?.key ?? duplicate;
    if (!key || seen.has(key)) continue;
    const write = writeFor(key, fact.value);
    if (!write) continue;
    seen.add(key);
    writes.push(write);
  }
  return writes;
}

export function factKeysForCondition(key: string): string[] {
  const canonical = resolveCanonicalProjectConditionKey(key);
  if (!canonical) return [];
  const projectKeys = Object.entries(PROJECT_FACT_TO_CONSTRAINT)
    .filter(([, row]) => row.key === canonical)
    .map(([factKey]) => factKey);
  const duplicateKeys = Object.entries(DUPLICATE_FACT_TO_CONSTRAINT)
    .filter(([, constraintKey]) => constraintKey === canonical)
    .map(([factKey]) => factKey);
  return [...projectKeys, ...duplicateKeys];
}

export function mergeProjectConditionWrites(input: {
  readonly authoritative: readonly ProjectConditionWrite[];
  readonly fromFacts: readonly ProjectConditionWrite[];
}): { constraints: ProjectConditionWrite[]; warnings: string[] } {
  const constraints = [...input.authoritative];
  const warnings: string[] = [];
  const byKey = new Map(constraints.map((row) => [row.key, row]));
  for (const factWrite of input.fromFacts) {
    const existing = byKey.get(factWrite.key);
    if (!existing) {
      constraints.push(factWrite);
      byKey.set(factWrite.key, factWrite);
      continue;
    }
    if (existing.value !== factWrite.value) {
      warnings.push(
        `${factWrite.label} stays ${existing.value}. A second extracted value was ${factWrite.value}.`
      );
    }
  }
  return { constraints, warnings };
}
