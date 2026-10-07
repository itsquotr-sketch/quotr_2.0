import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnthropicMessage, getAnthropicModel } from "@/lib/ai/anthropic";
import { composeJobDraft, factIsSafe, type DraftFact, type DraftSource } from "@/lib/rfqs/draft-compose";
import { withholdReason, type PrivateProjectRecords } from "@/lib/rfqs/draft-privacy";

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
    return { requestedScope: "", measurementNotes: "", sources: [], withheld: [], missing: ["That project is not available."], aiUsed: false };
  }
  const records: PrivateProjectRecords = {
    clientNames: typeof project.data.client_name === "string" ? [project.data.client_name] : [],
    emails: typeof project.data.client_email === "string" ? [project.data.client_email] : [],
    internalNotes: typeof project.data.notes === "string" ? [project.data.notes] : [],
  };
  const [area, items, facts, notes] = await Promise.all([
    supabase.from("work_areas").select("name, summary, quote_description, status, org_id").eq("id", workAreaId).eq("project_id", projectId).eq("org_id", orgId).maybeSingle(),
    supabase.from("work_area_scope_items").select("id, title, description").eq("work_area_id", workAreaId).eq("project_id", projectId).eq("org_id", orgId),
    supabase.from("project_facts").select("id, key, label, value, unit, source, confidence").eq("work_area_id", workAreaId).eq("project_id", projectId).eq("org_id", orgId),
    supabase.from("project_notes").select("id, content, note_type").eq("project_id", projectId).eq("org_id", orgId).in("note_type", NOTE_TYPES),
  ]);
  const collected: DraftFact[] = [];
  const withheld: Array<{ source: string; reason: string }> = [];
  function consider(fact: DraftFact) {
    const reason = withholdReason(fact.text, records);
    if (reason) {
      withheld.push({ source: fact.source, reason });
      return;
    }
    collected.push(fact);
  }
  const brief = typeof project.data.brief_text === "string" ? project.data.brief_text.trim() : "";
  if (brief) {
    consider({ id: "brief", field: "scope", source: "Project description", text: brief, uncertain: false });
  }
  const areaConfirmed = area.data?.status === "confirmed";
  if (areaConfirmed && area.data?.summary?.trim()) {
    consider({ id: "summary", field: "scope", source: "Work area details", text: area.data.summary.trim(), uncertain: false });
  }
  if (areaConfirmed && area.data?.quote_description?.trim()) {
    consider({ id: "description", field: "scope", source: "Work area description", text: area.data.quote_description.trim(), uncertain: false });
  }
  for (const item of areaConfirmed ? items.data ?? [] : []) {
    const title = item.title?.trim() ?? "";
    const description = item.description?.trim() ?? "";
    const text = [title, description].filter(Boolean).join(": ");
    if (!text) continue;
    consider({ id: `scope-${item.id}`, field: "scope", source: "Captured specification", text, uncertain: false });
  }
  for (const fact of areaConfirmed ? facts.data ?? [] : []) {
    if (!factIsSafe(fact.key ?? "", fact.label ?? "")) {
      withheld.push({ source: fact.label?.trim() || "Commercial fact", reason: "This is a commercial record, not a supplier scope fact." });
      continue;
    }
    const text = factText(fact.value, fact.unit);
    if (!text) continue;
    const uncertain = fact.source === "assumption" || (fact.confidence != null && Number(fact.confidence) < 0.6);
    const field = fact.unit || fact.key?.toLowerCase().includes("quant") || fact.label?.toLowerCase().includes("quant")
      ? "measurements"
      : "scope";
    consider({
      id: `fact-${fact.id}`,
      field,
      source: field === "measurements" ? "Measured quantity" : "Work area fact",
      text: fact.label ? `${fact.label}: ${text}` : text,
      uncertain,
    });
  }
  for (const note of notes.data ?? []) {
    const content = note.content?.trim() ?? "";
    if (!content) continue;
    const field = note.note_type === "measurement" ? "measurements" : "scope";
    consider({
      id: `note-${note.id}`,
      field,
      source: note.note_type === "measurement" ? "Measurement note" : "Site note",
      text: content,
      uncertain: false,
    });
  }
  const order = await orderFactIds(collected);
  const draft = composeJobDraft(collected, order.ids);
  return { ...draft, withheld, aiUsed: order.aiUsed };
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
