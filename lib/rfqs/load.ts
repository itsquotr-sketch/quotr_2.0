import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readProjectDocumentCentre } from "@/lib/projects/document-centre";
import { suggestSubcontractorsForWorkArea } from "@/lib/subcontractors/search";
import { listSubcontractors } from "@/lib/subcontractors/actions";
import { hashRfqAccessToken, isRfqAccessTokenFormat } from "@/lib/rfqs/token";
import type { RfqDeliveryState, RfqResponseState } from "@/lib/rfqs/states";

export type RfqListRow = {
  id: string;
  status: "draft" | "sent";
  scopeLabel: string;
  dueOn: string | null;
  recipientCount: number;
  respondedCount: number;
  awaitingCount: number;
  questionCount: number;
  recipients: Array<{ name: string; responseState: string; deliveryFailed: boolean }>;
};

export type RfqRecipientView = {
  id: string;
  subcontractorId: string;
  contactId: string | null;
  tradingName: string;
  contactName: string;
  contactEmail: string;
  suggestionReason: string | null;
  selectionSource: "suggested" | "manual";
  responseState: RfqResponseState;
  deliveryState: RfqDeliveryState | null;
  viewed: boolean;
};

export type RfqResponseView = {
  id: string;
  recipientId: string;
  versionNumber: number;
  status: "draft" | "submitted";
  priceExGst: number | null;
  gstTreatment: string | null;
  pricingStructure: string | null;
  includedScope: string;
  excludedScope: string;
  assumptions: string;
  leadTime: string;
  validUntil: string | null;
  message: string;
  submittedAt: string | null;
  fileReady: boolean;
  fileName: string | null;
};

export type RfqDetail = {
  id: string;
  projectId: string;
  status: "draft" | "sent";
  scopeKind: "work_area" | "written";
  workAreaId: string | null;
  scopeLabel: string;
  requestedScope: string;
  measurementNotes: string;
  responseDueOn: string | null;
  includeSiteAddress: boolean;
  siteAddress: string;
  siteDetails: string;
  questions: string;
  message: string;
  builderName: string;
  recipients: RfqRecipientView[];
  files: Array<{ id: string; versionId: string; title: string; filename: string }>;
  responses: RfqResponseView[];
  clarifications: Array<{
    id: string;
    recipientId: string;
    body: string;
    createdAt: string;
    fromRecipient: boolean;
    audience: "private" | "all";
    parentId: string | null;
    authorUserId: string | null;
    requestSentAt: string | null;
    sharedRecipientIds: string[];
    deliveryState: "sent" | "failed" | null;
  }>;
  events: Array<{ id: string; kind: string; summary: string; createdAt: string; recipientId: string | null }>;
  applications: Array<{
    id: string;
    responseId: string;
    recipientId: string;
    allowanceItemId: string;
    replacedItemIds: string[];
    costExGst: number;
    workAreaId: string;
  }>;
};

export type RfqPricingTarget = {
  documentId: string;
  documentStatus: string;
  gstRate: number;
  quoteExists: boolean;
  items: Array<{
    id: string;
    workAreaId: string | null;
    label: string;
    totalCost: number;
    totalSell: number;
  }>;
};

export type PublicRfqView =
  | { state: "unavailable" }
  | { state: "expired" }
  | { state: "limited" }
  | {
      state: "open";
      token: string;
      builderName: string;
      scopeLabel: string;
      requestedScope: string;
      measurementNotes: string;
      responseDueOn: string | null;
      siteAddress: string;
      siteDetails: string;
      questions: string;
      message: string;
      responseState: RfqResponseState;
      files: Array<{ id: string; title: string; filename: string; mimeType: string }>;
      clarifications: Array<{ id: string; body: string; fromRecipient: boolean }>;
      responses: RfqResponseView[];
    };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function loadProjectRfqs(
  supabase: SupabaseClient,
  projectId: string
): Promise<RfqListRow[]> {
  await supabase.rpc("expire_project_rfqs_v1", { p_project: projectId });
  const { data } = await supabase
    .from("rfqs")
    .select("id, status, scope_kind, work_area_name, written_scope_label, response_due_on, rfq_recipients(id, trading_name, response_state, rfq_deliveries(status, created_at), rfq_clarifications(id, from_recipient, parent_id))")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => {
    const recipients = (row.rfq_recipients ?? []) as Array<{
      trading_name?: string;
      response_state?: string;
      rfq_deliveries?: Array<{ status?: string; created_at?: string }>;
      rfq_clarifications?: Array<{ id?: string; from_recipient?: boolean; parent_id?: string | null }>;
    }>;
    const notes = recipients.flatMap((item) => item.rfq_clarifications ?? []);
    const answered = new Set(notes.map((note) => note.parent_id).filter((id): id is string => Boolean(id)));
    return {
      id: row.id,
      status: row.status === "sent" ? "sent" : "draft",
      scopeLabel: row.scope_kind === "work_area" ? text(row.work_area_name) : text(row.written_scope_label),
      dueOn: row.response_due_on,
      recipientCount: recipients.length,
      respondedCount: recipients.filter((item) => item.response_state === "responded").length,
      awaitingCount: recipients.filter((item) => item.response_state === "awaiting" || item.response_state === "clarification").length,
      questionCount: notes.filter((note) => note.from_recipient && note.id && !answered.has(note.id)).length,
      recipients: recipients.map((item) => {
        const delivery = [...(item.rfq_deliveries ?? [])].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];
        const failed = delivery?.status === "failed" || delivery?.status === "bounced" || delivery?.status === "complained";
        return {
          name: text(item.trading_name) || "Recipient",
          responseState: text(item.response_state) || "awaiting",
          deliveryFailed: failed,
        };
      }),
    };
  });
}

export async function loadRfqDetail(
  supabase: SupabaseClient,
  projectId: string,
  rfqId: string
): Promise<RfqDetail | null> {
  await supabase.rpc("expire_project_rfqs_v1", { p_project: projectId });
  const { data } = await supabase
    .from("rfqs")
    .select(`
      id, project_id, status, scope_kind, work_area_id, work_area_name, written_scope_label,
      requested_scope, measurement_notes, response_due_on, include_site_address, site_address,
      site_details, questions, message, builder_name
    `)
    .eq("id", rfqId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data) return null;
  const [recipients, files, events] = await Promise.all([
    supabase.from("rfq_recipients").select("id, subcontractor_id, contact_id, trading_name, contact_name, contact_email, suggestion_reason, selection_source, response_state").eq("rfq_id", rfqId),
    supabase.from("rfq_shared_documents").select("id, project_document_version_id, title, display_filename").eq("rfq_id", rfqId),
    supabase.from("rfq_events").select("id, kind, summary, created_at, recipient_id").eq("rfq_id", rfqId).order("created_at"),
  ]);
  const recipientIds = (recipients.data ?? []).map((row) => row.id);
  const [responses, clarifications, deliveries] = await Promise.all([
    recipientIds.length
      ? supabase.from("rfq_responses").select("id, recipient_id, version_number, status, price_ex_gst, gst_treatment, pricing_structure, included_scope, excluded_scope, assumptions, lead_time, valid_until, message, submitted_at").in("recipient_id", recipientIds)
      : Promise.resolve({ data: [] }),
    recipientIds.length
      ? supabase.from("rfq_clarifications").select("id, recipient_id, body, created_at, from_recipient, audience, parent_id, author_user_id, request_sent_at, shared_recipient_ids, delivery_state").in("recipient_id", recipientIds)
      : Promise.resolve({ data: [] }),
    recipientIds.length
      ? supabase.from("rfq_deliveries").select("recipient_id, status, created_at").in("recipient_id", recipientIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const recipientIdSet = new Set(recipientIds);
  const latestDelivery = new Map<string, RfqDeliveryState>();
  for (const row of deliveries.data ?? []) {
    if (!recipientIdSet.has(row.recipient_id) || latestDelivery.has(row.recipient_id)) continue;
    latestDelivery.set(row.recipient_id, row.status as RfqDeliveryState);
  }
  const viewed = new Set(
    (events.data ?? []).filter((row) => row.kind === "viewed" && row.recipient_id).map((row) => row.recipient_id as string)
  );
  const responseRows = (responses.data ?? []).filter((row) => recipientIdSet.has(row.recipient_id));
  const responseIds = responseRows.map((row) => row.id);
  const fileRows = responseIds.length
    ? await supabase
        .from("rfq_response_files")
        .select("response_id, upload_status, original_filename")
        .in("response_id", responseIds)
    : { data: [] };
  const fileByResponse = new Map(
    (fileRows.data ?? []).map((row) => [row.response_id, row])
  );
  const applications = await supabase
    .from("rfq_pricing_applications")
    .select("id, response_id, recipient_id, allowance_item_id, replaced_item_ids, cost_ex_gst, work_area_id")
    .eq("rfq_id", rfqId)
    .is("superseded_at", null);
  return {
    id: data.id,
    projectId: data.project_id,
    status: data.status === "sent" ? "sent" : "draft",
    scopeKind: data.scope_kind === "written" ? "written" : "work_area",
    workAreaId: data.work_area_id,
    scopeLabel: data.scope_kind === "work_area" ? text(data.work_area_name) : text(data.written_scope_label),
    requestedScope: text(data.requested_scope),
    measurementNotes: text(data.measurement_notes),
    responseDueOn: data.response_due_on,
    includeSiteAddress: Boolean(data.include_site_address),
    siteAddress: text(data.site_address),
    siteDetails: text(data.site_details),
    questions: text(data.questions),
    message: text(data.message),
    builderName: text(data.builder_name),
    recipients: (recipients.data ?? []).map((row) => ({
      id: row.id,
      subcontractorId: row.subcontractor_id,
      contactId: row.contact_id,
      tradingName: row.trading_name,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      suggestionReason: row.suggestion_reason,
      selectionSource: row.selection_source === "suggested" ? "suggested" : "manual",
      responseState: row.response_state as RfqResponseState,
      deliveryState: latestDelivery.get(row.id) ?? null,
      viewed: viewed.has(row.id),
    })),
    files: (files.data ?? []).map((row) => ({
      id: row.id,
      versionId: row.project_document_version_id,
      title: row.title,
      filename: row.display_filename,
    })),
    responses: responseRows.map((row) => {
      const file = fileByResponse.get(row.id);
      return {
        id: row.id,
        recipientId: row.recipient_id,
        versionNumber: row.version_number,
        status: row.status === "submitted" ? "submitted" : "draft",
        priceExGst: row.price_ex_gst == null ? null : Number(row.price_ex_gst),
        gstTreatment: row.gst_treatment,
        pricingStructure: row.pricing_structure,
        includedScope: text(row.included_scope),
        excludedScope: text(row.excluded_scope),
        assumptions: text(row.assumptions),
        leadTime: text(row.lead_time),
        validUntil: row.valid_until,
        message: text(row.message),
        submittedAt: row.submitted_at,
        fileReady: file?.upload_status === "ready",
        fileName: file?.original_filename ?? null,
      };
    }),
    clarifications: (clarifications.data ?? [])
      .filter((row) => recipientIdSet.has(row.recipient_id))
      .map((row) => ({
        id: row.id,
        recipientId: row.recipient_id,
        body: row.body,
        createdAt: row.created_at,
        fromRecipient: row.from_recipient !== false,
        audience: row.audience === "all" ? "all" as const : "private" as const,
        parentId: row.parent_id,
        authorUserId: row.author_user_id ?? null,
        requestSentAt: row.request_sent_at ?? null,
        sharedRecipientIds: Array.isArray(row.shared_recipient_ids) ? row.shared_recipient_ids : [],
        deliveryState: row.delivery_state === "sent" || row.delivery_state === "failed" ? row.delivery_state : null,
      })),
    events: (events.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      summary: row.summary,
      createdAt: row.created_at,
      recipientId: row.recipient_id,
    })),
    applications: (applications.data ?? []).map((row) => ({
      id: row.id,
      responseId: row.response_id,
      recipientId: row.recipient_id,
      allowanceItemId: row.allowance_item_id,
      replacedItemIds: Array.isArray(row.replaced_item_ids) ? row.replaced_item_ids : [],
      costExGst: Number(row.cost_ex_gst ?? 0),
      workAreaId: row.work_area_id,
    })),
  };
}

export async function loadRfqPricingTargets(
  supabase: SupabaseClient,
  projectId: string
): Promise<RfqPricingTarget | null> {
  const document = await supabase
    .from("pricing_documents")
    .select("id, status, gst_rate")
    .eq("project_id", projectId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!document.data) return null;
  const [items, quotes] = await Promise.all([
    supabase
      .from("pricing_items")
      .select("id, work_area_id, client_label, total_cost, total_sell")
      .eq("pricing_document_id", document.data.id)
      .order("sort_order"),
    supabase.from("quotes").select("id").eq("project_id", projectId).limit(1),
  ]);
  return {
    documentId: document.data.id,
    documentStatus: document.data.status,
    gstRate: Number(document.data.gst_rate ?? 15),
    quoteExists: (quotes.data ?? []).length > 0,
    items: (items.data ?? []).map((item) => ({
      id: item.id,
      workAreaId: item.work_area_id,
      label: item.client_label,
      totalCost: Number(item.total_cost ?? 0),
      totalSell: Number(item.total_sell ?? 0),
    })),
  };
}

export async function loadRfqComposerSources(
  supabase: SupabaseClient,
  projectId: string,
  orgId: string
) {
  const [areas, people, documents] = await Promise.all([
    supabase.from("work_areas").select("id, type, name, status").eq("project_id", projectId).order("sort_order"),
    listSubcontractors(),
    readProjectDocumentCentre(supabase, projectId, orgId),
  ]);
  const workAreas = (areas.data ?? [])
    .filter((row) => row.status !== "excluded")
    .map((row) => ({ id: row.id, type: row.type, name: row.name }));
  return {
    workAreas,
    subcontractors: people
      .filter((person) => person.archived_at == null)
      .map((person) => ({
        id: person.id,
        tradingName: person.trading_name,
        workAreaTypes: person.work_area_types,
        suggestedFor: workAreas.filter((area) =>
          suggestSubcontractorsForWorkArea([person], area.type).length > 0
        ).map((area) => area.type),
        contacts: person.contacts
          .filter((contact) => contact.email)
          .map((contact) => ({
            id: contact.id,
            name: contact.name,
            email: contact.email as string,
          })),
      })),
    documents: documents.documents.flatMap((document) => {
      const ready = document.versions.filter((version) => version.uploadStatus === "ready");
      const current = ready.find((version) => version.current) ?? ready[0];
      if (!current) return [];
      return [{
        versionId: current.id,
        title: document.title,
        filename: current.displayFilename,
        visibility: current.visibility,
      }];
    }),
  };
}

export async function lookupPublicRfq(rawToken: string): Promise<PublicRfqView> {
  if (!isRfqAccessTokenFormat(rawToken)) return { state: "unavailable" };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { state: "unavailable" };
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("lookup_rfq_by_token_hash_v1", {
    p_token_hash: hashRfqAccessToken(rawToken),
  });
  if (error || !data || typeof data !== "object") return { state: "unavailable" };
  const row = data as Record<string, unknown>;
  if (row.ok !== true) {
    if (row.error === "EXPIRED") return { state: "expired" };
    if (row.error === "RATE_LIMITED") return { state: "limited" };
    return { state: "unavailable" };
  }
  const withheld = ["clientName", "clientEmail", "customerId", "margin", "pricing", "estimateCost", "internalNotes"];
  if (withheld.some((key) => key in row)) return { state: "unavailable" };
  const responses = Array.isArray(row.responses) ? row.responses : [];
  return {
    state: "open",
    token: rawToken,
    builderName: text(row.builderName),
    scopeLabel: text(row.scopeLabel),
    requestedScope: text(row.requestedScope),
    measurementNotes: text(row.measurementNotes),
    responseDueOn: typeof row.responseDueOn === "string" ? row.responseDueOn : null,
    siteAddress: text(row.siteAddress),
    siteDetails: text(row.siteDetails),
    questions: text(row.questions),
    message: text(row.message),
    responseState: text(row.responseState) as RfqResponseState,
    files: Array.isArray(row.files)
      ? row.files.flatMap((file) => {
          if (!file || typeof file !== "object") return [];
          const item = file as Record<string, unknown>;
          if (typeof item.id !== "string") return [];
          return [{ id: item.id, title: text(item.title), filename: text(item.filename), mimeType: text(item.mimeType) }];
        })
      : [],
    clarifications: Array.isArray(row.clarifications)
      ? row.clarifications.flatMap((note) => {
          if (!note || typeof note !== "object") return [];
          const item = note as Record<string, unknown>;
          if (typeof item.id !== "string") return [];
          return [{ id: item.id, body: text(item.body), fromRecipient: item.fromRecipient !== false }];
        })
      : [],
    responses: responses.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const response = item as Record<string, unknown>;
      if (typeof response.id !== "string") return [];
      return [{
        id: response.id,
        recipientId: "",
        versionNumber: Number(response.versionNumber) || 1,
        status: response.status === "submitted" ? "submitted" as const : "draft" as const,
        priceExGst: response.priceExGst == null ? null : Number(response.priceExGst),
        gstTreatment: typeof response.gstTreatment === "string" ? response.gstTreatment : null,
        pricingStructure: typeof response.structure === "string" ? response.structure : null,
        includedScope: text(response.includedScope),
        excludedScope: text(response.excludedScope),
        assumptions: text(response.assumptions),
        leadTime: text(response.leadTime),
        validUntil: typeof response.validUntil === "string" ? response.validUntil : null,
        message: text(response.message),
        submittedAt: typeof response.submittedAt === "string" ? response.submittedAt : null,
        fileReady: response.fileReady === true,
        fileName: typeof response.fileName === "string" ? response.fileName : null,
      }];
    }),
  };
}
