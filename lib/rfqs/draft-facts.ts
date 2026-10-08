import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnthropicMessage, getAnthropicModel } from "@/lib/ai/anthropic";
import { composeJobDraft, factIsSafe, type DraftFact, type DraftSource } from "@/lib/rfqs/draft-compose";
import { withholdReason, type PrivateProjectRecords } from "@/lib/rfqs/draft-privacy";
import { selectWorkAreaScope, type ScheduleSuggestion } from "@/lib/rfqs/scope-selection";

const NOTE_TYPES = ["measurement", "access", "existing_condition", "material_preference", "exclusion"];

function factText(value: unknown, unit: string | null): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? (unit ? `${trimmed} ${unit}` : trimmed) : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return unit ? `${value} ${unit}` : String(value);
  }
  if (value && typeof value === "object" && "value" in value) {
    return factText((value as { value: unknown }).value, unit);
  }
  return null;
}

export async function draftRfqJobFacts(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  workAreaId: string
): Promise<{
  requestedScope: string;
  measurementNotes: string;
  sources: DraftSource[];
  withheld: Array<{ source: string; reason: string }>;
  suggestions: ScheduleSuggestion[];
  fallback: string | null;
  missing: string[];
  aiUsed: boolean;
}> {
  const project = await supabase
    .from("projects")
    .select("org_id, brief_text, client_name, client_email, notes")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!project.data || project.data.org_id !== orgId) {
    return { requestedScope: "", measurementNotes: "", sources: [], withheld: [], suggestions: [], fallback: null, missing: ["That project is not available."], aiUsed: false };
  }
  const records: PrivateProjectRecords = {
    clientNames: typeof project.data.client_name === "string" ? [project.data.client_name] : [],
    emails: typeof project.data.client_email === "string" ? [project.data.client_email] : [],
    internalNotes: typeof project.data.notes === "string" ? [project.data.notes] : [],
  };
  const [area, items, facts, notes] = await Promise.all([
    supabase.from("work_areas").select("name, type, summary, quote_description, status, org_id").eq("id", workAreaId).eq("project_id", projectId).eq("org_id", orgId).maybeSingle(),
    supabase.from("work_area_scope_items").select("id, title, description").eq("work_area_id", workAreaId).eq("project_id", projectId).eq("org_id", orgId),
    supabase.from("project_facts").select("id, key, label, value, unit, source, confidence").eq("work_area_id", workAreaId).eq("project_id", projectId).eq("org_id", orgId),
    supabase.from("project_notes").select("id, content, note_type").eq("project_id", projectId).eq("org_id", orgId).in("note_type", NOTE_TYPES),
  ]);
  const areaConfirmed = area.data?.status === "confirmed";
  const preparedFacts: ScopeSelectionInputFact[] = [];
  const withheld: Array<{ source: string; reason: string }> = [];
  for (const fact of areaConfirmed ? facts.data ?? [] : []) {
    if (!factIsSafe(fact.key ?? "", fact.label ?? "")) {
      withheld.push({ source: fact.label?.trim() || "Commercial fact", reason: "This is a commercial record, not a supplier scope fact." });
      continue;
    }
    const text = factText(fact.value, fact.unit);
    if (!text) continue;
    const uncertain = fact.source === "assumption" || (fact.confidence != null && Number(fact.confidence) < 0.6);
    const measurement = Boolean(fact.unit) || Boolean(fact.key?.toLowerCase().includes("quant")) || Boolean(fact.label?.toLowerCase().includes("quant"));
    preparedFacts.push({
      id: fact.id,
      label: fact.label?.trim() || "Work area fact",
      text: fact.label ? `${fact.label}: ${text}` : text,
      uncertain,
      measurement,
    });
  }
  const selected = selectWorkAreaScope({
    areaType: typeof area.data?.type === "string" ? area.data.type : "",
    areaName: typeof area.data?.name === "string" ? area.data.name : "",
    areaConfirmed,
    brief: typeof project.data.brief_text === "string" ? project.data.brief_text : "",
    summary: typeof area.data?.summary === "string" ? area.data.summary : "",
    description: typeof area.data?.quote_description === "string" ? area.data.quote_description : "",
    items: (items.data ?? []).map((item) => ({
      id: item.id,
      title: item.title ?? "",
      description: item.description ?? "",
    })),
    facts: preparedFacts,
    notes: (notes.data ?? []).map((note) => ({
      id: note.id,
      noteType: note.note_type ?? "",
      text: note.content ?? "",
    })),
  });
  const collected: DraftFact[] = [];
  for (const fact of selected.facts) {
    const reason = withholdReason(fact.text, records);
    if (reason) {
      withheld.push({ source: fact.source, reason });
      continue;
    }
    collected.push(fact);
  }
  const suggestions = selected.suggestions.filter((suggestion) => {
    const reason = withholdReason(`${suggestion.title} ${suggestion.specification}`, records);
    if (reason) {
      withheld.push({ source: suggestion.source, reason });
      return false;
    }
    return true;
  });
  withheld.push(...selected.withheld);
  const order = await orderFactIds(collected);
  const draft = composeJobDraft(collected, order.ids);
  const fallback = draft.requestedScope.trim() ? null : selected.fallback;
  return { ...draft, withheld, suggestions, fallback, aiUsed: order.aiUsed };
}

type ScopeSelectionInputFact = {
  id: string;
  label: string;
  text: string;
  uncertain: boolean;
  measurement: boolean;
};

async function orderFactIds(facts: DraftFact[]): Promise<{ ids: string[]; aiUsed: boolean }> {
  if (!process.env.ANTHROPIC_API_KEY || facts.length < 2) {
    return { ids: facts.map((fact) => fact.id), aiUsed: false };
  }
  try {
    const result = await createAnthropicMessage({
      model: getAnthropicModel(),
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Order these supplier fact ids. Return JSON {"order":["id"]} using only these ids. Do not add ids or text.\n${JSON.stringify(facts.map((fact) => ({ id: fact.id, source: fact.source })))}`,
      }],
    }, { timeoutMs: 12000, label: "rfq-draft" });
    const text = result.message.content.map((block) => block.type === "text" ? block.text : "").join("");
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) as { order?: unknown } : null;
    const ids = Array.isArray(parsed?.order) ? parsed.order.filter((id): id is string => typeof id === "string") : [];
    return { ids, aiUsed: ids.length > 0 };
  } catch {
    return { ids: facts.map((fact) => fact.id), aiUsed: false };
  }
}
