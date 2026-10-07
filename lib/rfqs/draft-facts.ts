import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnthropicMessage, getAnthropicModel } from "@/lib/ai/anthropic";
import { composeJobDraft, factIsSafe, type DraftFact, type DraftSource } from "@/lib/rfqs/draft-compose";

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
  projectId: string,
  workAreaId: string
): Promise<{
  requestedScope: string;
  measurementNotes: string;
  sources: DraftSource[];
  missing: string[];
  aiUsed: boolean;
}> {
  const [area, items, facts, notes, project] = await Promise.all([
    supabase.from("work_areas").select("name, summary, quote_description, status").eq("id", workAreaId).eq("project_id", projectId).maybeSingle(),
    supabase.from("work_area_scope_items").select("id, title, description").eq("work_area_id", workAreaId).eq("project_id", projectId),
    supabase.from("project_facts").select("id, key, label, value, unit, source, confidence").eq("work_area_id", workAreaId).eq("project_id", projectId),
    supabase.from("project_notes").select("id, content, note_type").eq("project_id", projectId).in("note_type", NOTE_TYPES),
    supabase.from("projects").select("brief_text").eq("id", projectId).maybeSingle(),
  ]);
  const collected: DraftFact[] = [];
  const brief = typeof project.data?.brief_text === "string" ? project.data.brief_text.trim() : "";
  if (brief) {
    collected.push({ id: "brief", field: "scope", source: "Project description", text: brief, uncertain: false });
  }
  const areaConfirmed = area.data?.status === "confirmed";
  if (areaConfirmed && area.data?.summary?.trim()) {
    collected.push({ id: "summary", field: "scope", source: "Work area details", text: area.data.summary.trim(), uncertain: false });
  }
  if (areaConfirmed && area.data?.quote_description?.trim()) {
    collected.push({ id: "description", field: "scope", source: "Work area description", text: area.data.quote_description.trim(), uncertain: false });
  }
  for (const item of areaConfirmed ? items.data ?? [] : []) {
    const title = item.title?.trim() ?? "";
    const description = item.description?.trim() ?? "";
    const text = [title, description].filter(Boolean).join(": ");
    if (!text) continue;
    collected.push({ id: `scope-${item.id}`, field: "scope", source: "Captured specification", text, uncertain: false });
  }
  for (const fact of areaConfirmed ? facts.data ?? [] : []) {
    if (!factIsSafe(fact.key ?? "", fact.label ?? "")) continue;
    const text = factText(fact.value, fact.unit);
    if (!text) continue;
    const uncertain = fact.source === "assumption" || (fact.confidence != null && Number(fact.confidence) < 0.6);
    const field = fact.unit || fact.key?.toLowerCase().includes("quant") || fact.label?.toLowerCase().includes("quant")
      ? "measurements"
      : "scope";
    collected.push({
      id: `fact-${fact.id}`,
      field,
      source: field === "measurements" ? "Measured quantity" : "Work area fact",
      text: fact.label ? `${fact.label}: ${text}` : text,
      uncertain,
    });
  }
  for (const note of notes.data ?? []) {
    const content = note.content?.trim() ?? "";
    if (!content || !factIsSafe(note.note_type ?? "", content.slice(0, 80))) continue;
    const field = note.note_type === "measurement" ? "measurements" : "scope";
    collected.push({
      id: `note-${note.id}`,
      field,
      source: note.note_type === "measurement" ? "Measurement note" : "Site note",
      text: content,
      uncertain: false,
    });
  }
  const order = await orderFactIds(collected);
  const draft = composeJobDraft(collected, order.ids);
  return { ...draft, aiUsed: order.aiUsed };
}

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
        content: `Order these job facts for a supplier. Return JSON {"order":["id"]} using only the given ids. Do not add facts.\n${JSON.stringify(facts.map((fact) => ({ id: fact.id, text: fact.text })))}`,
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
