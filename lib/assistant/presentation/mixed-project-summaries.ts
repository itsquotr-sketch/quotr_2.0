/**
 * PLATFORM-01-R1 — presentation copy for mixed Work Area summaries.
 * Does not read or write commercial quantities, rates, or facts.
 */
import type { EstimateFact } from "@/lib/estimate/types";
import { jobScopeDisplay, parseInternalWallsJobScope, type InternalWallsJobScope } from "@/lib/estimate/internal-walls-scope";
import {
  liningProductDisplay,
  type InternalWallsWallType,
} from "@/lib/estimate/internal-walls-wall-types";

export function doorsSpecificationCountLabel(specificationCount: number): string {
  return specificationCount === 1
    ? "1 door specification"
    : `${specificationCount} door specifications`;
}

export function isBareKnownSummaryLine(line: string): boolean {
  const value = line.trim();
  if (!value) return true;
  if (/^\d+(?:\.\d+)?$/.test(value)) return true;
  if (/^(?:yes|no|true|false)$/i.test(value)) return true;
  if (/^[a-z][a-z0-9]*_[a-z0-9_]+$/i.test(value)) return true;
  return false;
}

function formatMetres(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatAreaM2(area: number): string {
  return `${formatMetres(area)} m²`;
}

export function formatCeilingKnownSummary(input: {
  label: string | null;
  lengthM: number | null;
  widthM: number | null;
  areaM2: number | null;
  structureFamily: string | null;
  liningLabel: string | null;
}): string | null {
  const rawLabel = input.label?.trim() || "";
  const name = rawLabel
    ? /ceiling/i.test(rawLabel)
      ? rawLabel
      : `${rawLabel} Ceiling`
    : "Ceiling";
  const area =
    input.lengthM != null && input.widthM != null && input.lengthM > 0 && input.widthM > 0
      ? input.lengthM * input.widthM
      : input.areaM2;
  const structure =
    input.structureFamily === "existing_framing"
      ? "existing framing"
      : input.structureFamily === "timber_direct_fix"
        ? "new timber framing"
        : input.structureFamily === "steel_direct_fix"
          ? "steel framing"
          : input.structureFamily === "suspended_steel"
            ? "suspended steel"
            : input.structureFamily === "tile_and_grid"
              ? "tile and grid"
              : null;
  const parts = [
    name,
    area != null && area > 0 ? formatAreaM2(area) : null,
    structure,
    input.liningLabel,
  ].filter((part): part is string => Boolean(part));
  if (parts.length <= 1 && parts[0] === "Ceiling") return null;
  return parts.join(" · ");
}

function timberFramingPhrase(size: InternalWallsWallType["frame_size"]): string | null {
  if (size === "90x45") return "90 × 45 mm timber framing";
  if (size === "140x45") return "140 × 45 mm timber framing";
  if (size === "other") return "timber framing";
  return null;
}

function liningPhrase(type: InternalWallsWallType): string | null {
  const linedA = type.side_a.lined || type.side_a.product != null;
  const linedB = type.side_b.lined || type.side_b.product != null;
  if (!linedA && !linedB) return null;
  const same =
    type.same_lining_both_sides === true ||
    (linedA &&
      linedB &&
      type.side_a.product === type.side_b.product &&
      type.side_a.thickness_mm === type.side_b.thickness_mm);
  const face = same || linedA ? type.side_a : type.side_b;
  const product =
    face.product === "fibre_cement"
      ? "fibre-cement"
      : liningProductDisplay(face.product) ?? "plasterboard";
  const thickness = face.thickness_mm != null ? `${face.thickness_mm} mm ` : "";
  const sides = same && linedA && linedB ? "to both sides" : linedA && linedB ? "to both faces" : "to one side";
  return `${thickness}${product} ${sides}`;
}

function selectedExtras(type: InternalWallsWallType): string[] {
  const extras: string[] = [];
  if (type.insulation_included === true) extras.push("insulation");
  if (type.skirting != null && type.skirting !== "none") extras.push("skirting");
  return extras;
}

function partitionNoun(count: number, framed: "timber" | "steel" | null, jobScope: InternalWallsJobScope | null): string {
  const noun = count === 1 ? "partition" : "partitions";
  const frame =
    framed === "timber" ? "timber-framed " : framed === "steel" ? "steel-framed " : "";
  const fresh = jobScope === "new_partition" ? "new " : "";
  return `${count} ${fresh}${frame}${noun}`;
}

function joinIncluding(parts: string[]): string | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function internalWallsKnownSentence(
  type: InternalWallsWallType,
  jobScope: InternalWallsJobScope | null
): string {
  const count = type.wall_count != null && type.wall_count > 0 ? type.wall_count : 1;
  const framed =
    type.frame_system === "timber" ? "timber" : type.frame_system === "steel" ? "steel" : null;
  const lined = liningPhrase(type) != null;
  const fibreCement =
    type.side_a.product === "fibre_cement" || type.side_b.product === "fibre_cement";
  const extras = selectedExtras(type);
  const included = [
    lined ? (fibreCement ? "fibre-cement lining" : "plasterboard lining") : null,
    ...extras,
  ].filter((part): part is string => Boolean(part));
  const including = joinIncluding(included);
  const lead =
    jobScope && jobScope !== "new_partition"
      ? `${jobScopeDisplay(jobScope)}: ${partitionNoun(count, framed, null)}`
      : partitionNoun(count, framed, jobScope);
  return including ? `${lead}, including ${including}.` : `${lead}.`;
}

export function internalWallsEstimateScopeLine(
  type: InternalWallsWallType,
  jobScope: InternalWallsJobScope | null
): string {
  const count = type.wall_count != null && type.wall_count > 0 ? type.wall_count : 1;
  const noun = count === 1 ? "partition" : "partitions";
  const scope =
    jobScope === "new_partition"
      ? `${count} new ${noun}`
      : jobScope
        ? `${count} ${noun}`
        : `${count} ${noun}`;
  const geometry =
    type.length_lm != null && type.height_m != null
      ? `${formatMetres(type.length_lm)} m × ${formatMetres(type.height_m)} m`
      : null;
  const frame =
    type.frame_system === "timber"
      ? timberFramingPhrase(type.frame_size) ?? "timber framing"
      : type.frame_system === "steel"
        ? "steel framing"
        : type.frame_system === "existing_frame"
          ? "existing framing"
          : null;
  const extras = selectedExtras(type);
  return [scope, geometry, frame, liningPhrase(type), extras.length > 0 ? extras.join(" · ") : null]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function internalWallsJobScopeAssumptionStatement(value: unknown): string {
  const scope = parseInternalWallsJobScope(value) ?? (
    typeof value === "string" ? parseInternalWallsJobScope(value.replace(/\s+/g, "_")) : null
  );
  if (scope === "new_partition") return "New internal partition assumed.";
  const label = jobScopeDisplay(scope);
  return label ? `${label} assumed.` : "Internal partition scope assumed.";
}

const JOB_SCOPE_CALCULATOR_LINE = /^Internal walls job scope:\s*(.+?)\.?\s*$/i;
const WALL_TYPE_ROLLUP_LINE = /^\d+ walls? · \d+ Wall Types?\b/i;

export function presentCalculatorAssumptionLine(
  line: string,
  facts?: readonly Pick<EstimateFact, "key" | "source" | "value">[] | null
): string | null {
  const trimmed = line.trim();
  if (WALL_TYPE_ROLLUP_LINE.test(trimmed)) return null;
  const match = trimmed.match(JOB_SCOPE_CALCULATOR_LINE);
  if (!match) return line;
  const fact = facts?.find((row) => row.key === "internal_walls.job_scope");
  const assumed = fact?.source === "assumption" || fact?.source === "default";
  if (!assumed) return null;
  return internalWallsJobScopeAssumptionStatement(fact?.value ?? match[1]);
}
