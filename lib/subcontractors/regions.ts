/**
 * Service areas are where a subcontractor will travel for work.
 * They are not the business street address and they are not rates.
 * Keep the alias list aligned with subcontractor_region_code in migration 088.
 */

export const NZ_SERVICE_REGIONS = [
  { code: "northland", label: "Northland" },
  { code: "auckland", label: "Auckland" },
  { code: "waikato", label: "Waikato" },
  { code: "bay_of_plenty", label: "Bay of Plenty" },
  { code: "gisborne", label: "Gisborne" },
  { code: "hawkes_bay", label: "Hawke's Bay" },
  { code: "taranaki", label: "Taranaki" },
  { code: "manawatu_whanganui", label: "Manawatū-Whanganui" },
  { code: "wellington", label: "Wellington" },
  { code: "tasman", label: "Tasman" },
  { code: "nelson", label: "Nelson" },
  { code: "marlborough", label: "Marlborough" },
  { code: "west_coast", label: "West Coast" },
  { code: "canterbury", label: "Canterbury" },
  { code: "otago", label: "Otago" },
  { code: "southland", label: "Southland" },
] as const;

export const AU_SERVICE_REGIONS = [
  { code: "nsw", label: "New South Wales" },
  { code: "vic", label: "Victoria" },
  { code: "qld", label: "Queensland" },
  { code: "sa", label: "South Australia" },
  { code: "wa", label: "Western Australia" },
  { code: "tas", label: "Tasmania" },
  { code: "act", label: "Australian Capital Territory" },
  { code: "nt", label: "Northern Territory" },
] as const;

export const NATIONWIDE_REGION = { code: "nationwide", label: "Nationwide" } as const;
export const OTHER_REGION = { code: "other", label: "Other" } as const;

export type ServiceRegionCode =
  | (typeof NZ_SERVICE_REGIONS)[number]["code"]
  | (typeof AU_SERVICE_REGIONS)[number]["code"]
  | typeof NATIONWIDE_REGION.code
  | typeof OTHER_REGION.code;

const REGION_LABELS = new Map<string, string>(
  [...NZ_SERVICE_REGIONS, ...AU_SERVICE_REGIONS, NATIONWIDE_REGION, OTHER_REGION].map(
    (region) => [region.code, region.label]
  )
);

const REGION_ALIASES = new Map<string, ServiceRegionCode>();

function regionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

for (const region of [...NZ_SERVICE_REGIONS, ...AU_SERVICE_REGIONS, NATIONWIDE_REGION, OTHER_REGION]) {
  REGION_ALIASES.set(regionKey(region.code), region.code);
  REGION_ALIASES.set(regionKey(region.label), region.code);
}

for (const [alias, code] of [
  ["nation wide", "nationwide"],
  ["national", "nationwide"],
  ["nz wide", "nationwide"],
  ["new zealand wide", "nationwide"],
  ["australia wide", "nationwide"],
  ["all regions", "nationwide"],
  ["all of nz", "nationwide"],
  ["all of new zealand", "nationwide"],
  ["all of australia", "nationwide"],
] as const) {
  REGION_ALIASES.set(alias, code);
}

export function isServiceRegionCode(value: string): value is ServiceRegionCode {
  return REGION_LABELS.has(value);
}

export function regionLabel(code: string): string {
  return REGION_LABELS.get(code) ?? code;
}

/** Known region and state names become codes. Anything else stays free text. */
export function mapLegacyServiceRegion(label: string): ServiceRegionCode | null {
  const key = regionKey(label);
  if (!key) return null;
  return REGION_ALIASES.get(key) ?? null;
}

export function serviceRegionsForCountry(country: "NZ" | "AU" | null) {
  if (country === "AU") return AU_SERVICE_REGIONS;
  if (country === "NZ") return NZ_SERVICE_REGIONS;
  return [];
}

export function regionAllowedForCountry(
  code: string,
  country: "NZ" | "AU" | null
): boolean {
  if (country == null) return false;
  if (code === NATIONWIDE_REGION.code || code === OTHER_REGION.code) return true;
  return serviceRegionsForCountry(country).some((region) => region.code === code);
}

function uniqueLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(trimmed);
  }
  return next;
}

/**
 * Dropping a country must not drop a previously saved area.
 * Regions outside the new country become Other labels.
 */
export function retainRegionsForCountry(
  country: "NZ" | "AU" | null,
  selected: readonly string[],
  otherLabels: readonly string[]
): { selected: string[]; otherLabels: string[] } {
  const codes: string[] = [];
  const labels = [...otherLabels];
  for (const code of selected) {
    if (code === OTHER_REGION.code) {
      codes.push(code);
      continue;
    }
    if (regionAllowedForCountry(code, country)) {
      codes.push(code);
      continue;
    }
    const label = regionLabel(code);
    labels.push(label);
    codes.push(OTHER_REGION.code);
  }
  const uniqueCodes = [...new Set(codes)];
  const unique = uniqueLabels(labels).slice(0, 20);
  if (unique.length > 0 && !uniqueCodes.includes(OTHER_REGION.code)) {
    uniqueCodes.push(OTHER_REGION.code);
  }
  if (unique.length === 0) {
    return {
      selected: uniqueCodes.filter((code) => code !== OTHER_REGION.code),
      otherLabels: [],
    };
  }
  return { selected: uniqueCodes, otherLabels: unique };
}
