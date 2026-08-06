/**
 * Convert validated evidence items into human-readable summaries.
 * Does not fabricate content — only templates around supplied fields.
 */

import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";

const MAX_EXCERPT = 160;
const MAX_SUMMARIES = 6;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

function workAreaTypeLabel(type: string): string {
  const item = SCOPE_CATALOGUE.find((c) => c.type === type);
  if (item) return item.label;
  // Prefer readable words over raw underscores when catalogue miss.
  const words = type
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.length > 0 ? words.join(" ") : "work area";
}

function humaniseKey(key: string): string {
  return key
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export interface RawEvidenceLike {
  readonly sourceType?: unknown;
  readonly sourceId?: unknown;
  readonly excerptOrValue?: unknown;
  readonly relevance?: unknown;
}

/**
 * Format a single validated evidence item. Returns null when insufficient data.
 */
export function formatEvidenceSummary(item: RawEvidenceLike): string | null {
  const sourceType = String(item.sourceType ?? "").toUpperCase();
  const excerpt =
    typeof item.excerptOrValue === "string"
      ? truncate(item.excerptOrValue, MAX_EXCERPT)
      : item.excerptOrValue != null
        ? truncate(String(item.excerptOrValue), MAX_EXCERPT)
        : "";
  const sourceId =
    typeof item.sourceId === "string" ? item.sourceId.trim() : "";

  switch (sourceType) {
    case "PROJECT_BRIEF_TEXT": {
      if (!excerpt) return "Your project brief was used as evidence.";
      return `Your brief says “${excerpt}”.`;
    }
    case "SITE_NOTE": {
      if (!excerpt) return "A site note supports this suggestion.";
      return `A site note says “${excerpt}”.`;
    }
    case "EXISTING_WORK_AREA": {
      const typeHint = excerpt || sourceId;
      if (!typeHint) return "A work area is already confirmed.";
      return `A ${workAreaTypeLabel(typeHint)} work area is already confirmed.`;
    }
    case "USER_FACT": {
      const keyLabel = sourceId ? humaniseKey(sourceId) : "project fact";
      if (
        excerpt === "" ||
        excerpt === "null" ||
        excerpt.toLowerCase() === "unknown"
      ) {
        return `No ${keyLabel.toLowerCase()} has been recorded.`;
      }
      return `${keyLabel} is recorded as “${excerpt}”.`;
    }
    case "CONSTRAINT": {
      const keyLabel = sourceId ? humaniseKey(sourceId) : "site constraint";
      if (excerpt) {
        if (/access/i.test(sourceId) || /access/i.test(keyLabel)) {
          return `Site access is marked as ${excerpt}.`;
        }
        return `${keyLabel} is marked as “${excerpt}”.`;
      }
      return `A site constraint (${keyLabel}) was considered.`;
    }
    case "DETERMINISTIC_RULE": {
      return "A structured scope rule flagged related work.";
    }
    case "USER_CORRECTION": {
      return "A previous correction on this project was considered.";
    }
    case "DOCUMENT_REFERENCE":
    case "PHOTO_REFERENCE": {
      return "Referenced project media was considered.";
    }
    default:
      return null;
  }
}

export function formatEvidenceSummaries(
  evidence: unknown,
  max: number = MAX_SUMMARIES
): readonly string[] {
  if (!Array.isArray(evidence)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of evidence) {
    if (!raw || typeof raw !== "object") continue;
    const summary = formatEvidenceSummary(raw as RawEvidenceLike);
    if (!summary || seen.has(summary)) continue;
    seen.add(summary);
    out.push(summary);
    if (out.length >= max) break;
  }
  return out;
}

export function formatMissingInformationSummaries(
  missing: unknown,
  max: number = 4
): readonly string[] {
  if (!Array.isArray(missing)) return [];
  const out: string[] = [];
  for (const item of missing) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const promptKey =
      typeof rec.promptKey === "string"
        ? rec.promptKey
        : typeof rec.key === "string"
          ? rec.key
          : null;
    if (!promptKey) continue;
    out.push(`Needs clarification: ${humaniseKey(promptKey)}.`);
    if (out.length >= max) break;
  }
  return out;
}
