/**
 * Two concurrent manual continuations, then a supported area added later.
 * Preview PostgREST only. Refuses Production. Deletes the disposable org.
 *
 * Run: npx --yes tsx scripts/verify-manual-pricing-concurrency-live.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  attachEstimateLinesToOpenManualPricing,
  claimConfirmedManualWorkArea,
  claimManualWorkAreaPricingLine,
  claimOpenManualPricingDocument,
} from "../lib/work-areas/manual-continuation-claim";
import {
  buildManualWorkAreaPricingItemRow,
  copyEnteredManualPrices,
  decideManualPricingHandoff,
  manualWorkAreaPersistence,
} from "../lib/work-areas/manual-pricing-route";

const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const SCOPE = "Supply and lay a 40 square metre concrete driveway, 100 mm thick.";
const OTHER_SCOPE = "Lay a separate 12 square metre path beside the garage.";
const DECK_SELL = 18218.38;
const DECK_QTY = 282.85;

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`ok  ${name}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

async function count(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { count: rows, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw new Error(`${table} count: ${error.message}`);
  return rows ?? 0;
}

async function main(): Promise<void> {
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const anon = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = local.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error("Preview env is missing from .env.local");
  const ref = hostnameRef(url);
  if (ref === PRODUCTION_REF) throw new Error("Refusing Production Supabase URL");
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    throw new Error(`Refusing non-Preview Supabase ref ${ref}`);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const password = `mwp-${randomUUID()}`;
  const orgId = randomUUID();
  const projectId = randomUUID();
  const handoffProjectId = randomUUID();
  const supportedProjectId = randomUUID();
  const userIds: string[] = [];

  try {
    const { error: orgError } = await admin.from("organisations").insert({
      id: orgId,
      name: `MWP-CONC ${suffix}`,
    });
    if (orgError) throw new Error(orgError.message);

    const email = `mwp-owner-${suffix}@example.invalid`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "create owner failed");
    }
    const userId = created.data.user.id;
    userIds.push(userId);
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      org_id: orgId,
      role: "owner",
      full_name: "Manual concurrency owner",
    });
    if (profileError) throw new Error(profileError.message);
    const { error: membershipError } = await admin.from("organisation_memberships").insert({
      org_id: orgId,
      user_id: userId,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });
    if (membershipError) throw new Error(membershipError.message);

    const { error: projectError } = await admin.from("projects").insert([
      {
        id: projectId,
        org_id: orgId,
        created_by: userId,
        title: `Concurrent manual ${suffix}`,
        stage: "brief",
      },
      {
        id: handoffProjectId,
        org_id: orgId,
        created_by: userId,
        title: `Manual then deck ${suffix}`,
        stage: "confirm_work_areas",
      },
      {
        id: supportedProjectId,
        org_id: orgId,
        created_by: userId,
        title: `Deck and kitchen ${suffix}`,
        stage: "estimate_ready",
      },
    ]);
    if (projectError) throw new Error(projectError.message);

    const owner = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await owner.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(signedIn.error.message);

    const persisted = manualWorkAreaPersistence({
      name: "Concreting",
      scopeDescription: SCOPE,
    });
    if (!persisted.ok) throw new Error(persisted.error);
    const areaRow = {
      org_id: orgId,
      project_id: projectId,
      type: persisted.type,
      name: persisted.name,
      status: persisted.status,
      ai_confidence: null,
      summary: persisted.summary,
      quote_description: persisted.quoteDescription,
      sort_order: 1,
    };
    const [firstArea, secondArea] = await Promise.all([
      claimConfirmedManualWorkArea(owner, areaRow),
      claimConfirmedManualWorkArea(owner, areaRow),
    ]);
    if ("error" in firstArea || "error" in secondArea) {
      throw new Error(
        `work area claim failed: ${"error" in firstArea ? firstArea.error.message : ""} ${"error" in secondArea ? secondArea.error.message : ""}`
      );
    }
    const workAreaCount = await count(admin, "work_areas", "project_id", projectId);
    check(
      "two concurrent continuations keep one work area",
      workAreaCount === 1 && firstArea.id === secondArea.id,
      `work_areas=${workAreaCount}`
    );

    const other = manualWorkAreaPersistence({
      name: "Concreting",
      scopeDescription: OTHER_SCOPE,
    });
    if (!other.ok) throw new Error(other.error);
    const otherArea = await claimConfirmedManualWorkArea(owner, {
      ...areaRow,
      name: other.name,
      summary: other.summary,
      quote_description: other.quoteDescription,
      sort_order: 2,
    });
    if ("error" in otherArea) throw new Error(otherArea.error.message);
    const distinctAreas = await count(admin, "work_areas", "project_id", projectId);
    check(
      "a different custom scope is kept",
      distinctAreas === 2 && otherArea.id !== firstArea.id,
      `work_areas=${distinctAreas}`
    );

    const documentRow = {
      org_id: orgId,
      project_id: projectId,
      estimate_id: null,
      title: `Concurrent pricing ${suffix}`,
      status: "draft",
      subtotal_cost: 0,
      subtotal_sell: 0,
      gross_profit: 0,
      margin_percent: 0,
      markup_percent: 0,
      gst_rate: 15,
      gst_amount: 0,
      total_incl_gst: 0,
      created_by: userId,
    };
    const [firstDoc, secondDoc] = await Promise.all([
      claimOpenManualPricingDocument(owner, documentRow),
      claimOpenManualPricingDocument(owner, documentRow),
    ]);
    if ("error" in firstDoc || "error" in secondDoc) {
      throw new Error(
        `document claim failed: ${"error" in firstDoc ? firstDoc.error.message : ""} ${"error" in secondDoc ? secondDoc.error.message : ""}`
      );
    }
    const documentCount = await count(admin, "pricing_documents", "project_id", projectId);
    check(
      "two concurrent continuations keep one Pricing document",
      documentCount === 1 && firstDoc.id === secondDoc.id,
      `pricing_documents=${documentCount}`
    );

    const lineRow = {
      ...buildManualWorkAreaPricingItemRow({
        orgId,
        projectId,
        workAreaId: firstArea.id,
        name: "Concreting",
        scope: SCOPE,
        sortOrder: 0,
      }),
      pricing_document_id: firstDoc.id,
    };
    const [firstLine, secondLine] = await Promise.all([
      claimManualWorkAreaPricingLine(owner, lineRow),
      claimManualWorkAreaPricingLine(owner, lineRow),
    ]);
    if ("error" in firstLine || "error" in secondLine) {
      throw new Error(
        `line claim failed: ${"error" in firstLine ? firstLine.error.message : ""} ${"error" in secondLine ? secondLine.error.message : ""}`
      );
    }
    const otherLine = await claimManualWorkAreaPricingLine(owner, {
      ...buildManualWorkAreaPricingItemRow({
        orgId,
        projectId,
        workAreaId: otherArea.id,
        name: "Concreting",
        scope: OTHER_SCOPE,
        sortOrder: 1,
      }),
      pricing_document_id: firstDoc.id,
    });
    if ("error" in otherLine) throw new Error(otherLine.error.message);
    const lineCount = await count(admin, "pricing_items", "pricing_document_id", firstDoc.id);
    check(
      "same intent keeps one Pricing line and a different scope adds a second",
      firstLine.id === secondLine.id && lineCount === 2,
      `same_line=${firstLine.id === secondLine.id} pricing_items=${lineCount}`
    );

    const manualAreaId = randomUUID();
    const deckAreaId = randomUUID();
    const kitchenAreaId = randomUUID();
    const manualDocId = randomUUID();
    const manualItemId = randomUUID();
    const estimateId = randomUUID();
    const { error: handoffAreaError } = await admin.from("work_areas").insert([
      {
        id: manualAreaId,
        org_id: orgId,
        project_id: handoffProjectId,
        type: "custom",
        name: "Concreting",
        status: "confirmed",
        summary: SCOPE,
        quote_description: SCOPE,
        sort_order: 1,
      },
      {
        id: deckAreaId,
        org_id: orgId,
        project_id: handoffProjectId,
        type: "deck",
        name: "Deck",
        status: "confirmed",
        summary: "Supply and install the deck.",
        quote_description: "Supply and install the deck.",
        sort_order: 2,
      },
    ]);
    if (handoffAreaError) throw new Error(handoffAreaError.message);
    const { error: estimateError } = await admin.from("estimates").insert({
      id: estimateId,
      org_id: orgId,
      project_id: handoffProjectId,
      status: "ready",
    });
    if (estimateError) throw new Error(estimateError.message);
    const { error: manualDocError } = await admin.from("pricing_documents").insert({
      id: manualDocId,
      org_id: orgId,
      project_id: handoffProjectId,
      estimate_id: null,
      title: `Priced manual ${suffix}`,
      status: "draft",
      subtotal_cost: 0,
      subtotal_sell: 1000,
      gross_profit: 0,
      margin_percent: 0,
      markup_percent: 0,
      gst_rate: 15,
      gst_amount: 150,
      total_incl_gst: 1150,
      created_by: userId,
    });
    if (manualDocError) throw new Error(manualDocError.message);
    const manualNotes = String(
      buildManualWorkAreaPricingItemRow({
        orgId,
        projectId: handoffProjectId,
        workAreaId: manualAreaId,
        name: "Concreting",
        scope: SCOPE,
        sortOrder: 0,
      }).notes_internal
    );
    const { error: manualItemError } = await admin.from("pricing_items").insert({
      id: manualItemId,
      org_id: orgId,
      pricing_document_id: manualDocId,
      project_id: handoffProjectId,
      work_area_id: manualAreaId,
      item_type: "allowance",
      delivery_method: "allowance",
      internal_label: "Concreting",
      client_label: "Concreting",
      client_description: SCOPE,
      quantity: 1,
      unit: "item",
      unit_cost: null,
      unit_sell: 1000,
      total_cost: 0,
      total_sell: 1000,
      gross_profit: 0,
      margin_percent: 0,
      markup_percent: 0,
      calculation_mode: "lump_sum",
      visible_on_quote: true,
      optional: false,
      sort_order: 0,
      notes_internal: manualNotes,
    });
    if (manualItemError) throw new Error(manualItemError.message);

    const openDecision = decideManualPricingHandoff([
      {
        id: manualDocId,
        status: "draft",
        estimate_id: null,
        created_at: new Date().toISOString(),
      },
    ]);
    if (openDecision.action !== "fold_into_open") {
      throw new Error(`expected fold, got ${openDecision.action}`);
    }
    const deckLine = {
      org_id: orgId,
      project_id: handoffProjectId,
      work_area_id: deckAreaId,
      source_estimate_line_item_id: null,
      item_type: "material",
      delivery_method: "in_house",
      internal_label: "Decking",
      client_label: "Decking",
      client_description: "140 mm hardwood boards",
      quantity: DECK_QTY,
      unit: "lm",
      unit_cost: 40,
      unit_sell: 64.41,
      total_cost: 14574.7,
      total_sell: DECK_SELL,
      gross_profit: 3643.68,
      margin_percent: 20,
      markup_percent: 25,
      calculation_mode: "quantity_rate",
      visible_on_quote: true,
      optional: false,
      sort_order: 1,
      notes_internal: "Deck calculator line",
    };
    const attached = await attachEstimateLinesToOpenManualPricing(admin, {
      orgId,
      documentId: manualDocId,
      estimateId,
      requirementSnapshotId: null,
      resetReview: false,
      scopeSummary: "Pricing prepared for: Concreting, Deck.",
      rows: [deckLine],
    });
    if (!attached.ok) throw new Error(attached.message);
    const { data: foldedDoc } = await admin
      .from("pricing_documents")
      .select("id, estimate_id, status")
      .eq("project_id", handoffProjectId);
    const { data: foldedItems } = await admin
      .from("pricing_items")
      .select("work_area_id, total_sell, quantity, client_description")
      .eq("pricing_document_id", manualDocId);
    const manualAfter = (foldedItems ?? []).find(
      (item) => item.work_area_id === manualAreaId
    );
    const deckAfter = (foldedItems ?? []).find((item) => item.work_area_id === deckAreaId);
    const handoffDocs = await count(admin, "pricing_documents", "project_id", handoffProjectId);
    check(
      "adding a deck folds into the open manual Pricing document",
      handoffDocs === 1 &&
        foldedDoc?.length === 1 &&
        foldedDoc[0]?.estimate_id === estimateId &&
        Number(manualAfter?.total_sell) === 1000 &&
        manualAfter?.client_description === SCOPE &&
        Number(deckAfter?.quantity) === DECK_QTY &&
        Number(deckAfter?.total_sell) === DECK_SELL,
      `pricing_documents=${handoffDocs} manual_sell=${manualAfter?.total_sell} deck_qty=${deckAfter?.quantity} deck_sell=${deckAfter?.total_sell}`
    );

    const quoteId = randomUUID();
    const { error: convertError } = await admin
      .from("pricing_documents")
      .update({ status: "converted_to_quote", estimate_id: null })
      .eq("id", manualDocId);
    if (convertError) throw new Error(convertError.message);
    const { error: quoteError } = await admin.from("quotes").insert({
      id: quoteId,
      org_id: orgId,
      project_id: handoffProjectId,
      pricing_document_id: manualDocId,
      title: `Quote ${suffix}`,
      status: "draft",
      subtotal: 1000,
      gst_rate: 15,
      gst_amount: 150,
      total_incl_gst: 1150,
      created_by: userId,
    });
    if (quoteError) throw new Error(quoteError.message);
    const { error: quoteItemError } = await admin.from("quote_items").insert({
      org_id: orgId,
      quote_id: quoteId,
      project_id: handoffProjectId,
      pricing_item_id: manualItemId,
      work_area_id: manualAreaId,
      section_title: "Concreting",
      section_description: SCOPE,
      label: "Concreting",
      description: SCOPE,
      quantity: 1,
      unit: "item",
      unit_price: 1000,
      total: 1000,
      visible: true,
      optional: false,
      sort_order: 0,
    });
    if (quoteItemError) throw new Error(quoteItemError.message);
    const { error: issueError } = await admin
      .from("quotes")
      .update({ status: "sent" })
      .eq("id", quoteId);
    if (issueError) throw new Error(issueError.message);

    const issuedDecision = decideManualPricingHandoff([
      {
        id: manualDocId,
        status: "converted_to_quote",
        estimate_id: null,
        created_at: new Date().toISOString(),
      },
    ]);
    check(
      "an issued Quote is not the document that receives the new work",
      issuedDecision.action === "new_after_quote" &&
        issuedDecision.action &&
        issuedDecision.sourceDocumentId === manualDocId
    );
    const copied = copyEnteredManualPrices({
      incomingRows: [
        buildManualWorkAreaPricingItemRow({
          orgId,
          projectId: handoffProjectId,
          workAreaId: manualAreaId,
          name: "Concreting",
          scope: SCOPE,
          sortOrder: 0,
        }),
        deckLine,
      ],
      pricedItems: [
        {
          work_area_id: manualAreaId,
          notes_internal: manualNotes,
          total_sell: 1000,
          unit_sell: 1000,
          total_cost: 0,
          unit_cost: null,
          quantity: 1,
          unit: "item",
          client_description: SCOPE,
          gross_profit: 0,
          margin_percent: 0,
          markup_percent: 0,
        },
      ],
    });
    const newDocId = randomUUID();
    const { error: newDocError } = await admin.from("pricing_documents").insert({
      id: newDocId,
      org_id: orgId,
      project_id: handoffProjectId,
      estimate_id: estimateId,
      title: `Pricing after quote ${suffix}`,
      status: "draft",
      subtotal_cost: 0,
      subtotal_sell: 0,
      gross_profit: 0,
      margin_percent: 0,
      markup_percent: 0,
      gst_rate: 15,
      gst_amount: 0,
      total_incl_gst: 0,
      created_by: userId,
    });
    if (newDocError) throw new Error(newDocError.message);
    const { error: copiedError } = await admin.from("pricing_items").insert(
      copied.map((row, index) => ({
        ...row,
        pricing_document_id: newDocId,
        sort_order: index,
      }))
    );
    if (copiedError) throw new Error(copiedError.message);

    const { data: quoteAfter } = await admin
      .from("quotes")
      .select("id, subtotal, total_incl_gst, status")
      .eq("id", quoteId)
      .maybeSingle();
    const { data: quoteItemAfter } = await admin
      .from("quote_items")
      .select("description, section_description, total")
      .eq("quote_id", quoteId);
    const { data: originalItem } = await admin
      .from("pricing_items")
      .select("total_sell, client_description")
      .eq("id", manualItemId)
      .maybeSingle();
    const { data: copiedManual } = await admin
      .from("pricing_items")
      .select("total_sell")
      .eq("pricing_document_id", newDocId)
      .eq("work_area_id", manualAreaId)
      .maybeSingle();
    const afterQuoteDocs = await count(admin, "pricing_documents", "project_id", handoffProjectId);
    const { count: openDrafts } = await admin
      .from("pricing_documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", handoffProjectId)
      .eq("status", "draft");
    check(
      "the issued Quote stays a snapshot and the new draft keeps the entered price",
      afterQuoteDocs === 2 &&
        openDrafts === 1 &&
        Number(quoteAfter?.subtotal) === 1000 &&
        quoteAfter?.status === "sent" &&
        Number(quoteAfter?.total_incl_gst) === 1150 &&
        quoteItemAfter?.length === 1 &&
        quoteItemAfter[0]?.description === SCOPE &&
        quoteItemAfter[0]?.section_description === SCOPE &&
        Number(quoteItemAfter[0]?.total) === 1000 &&
        Number(originalItem?.total_sell) === 1000 &&
        Number(copiedManual?.total_sell) === 1000,
      `pricing_documents=${afterQuoteDocs} open_drafts=${openDrafts ?? 0} quote_subtotal=${quoteAfter?.subtotal} original_sell=${originalItem?.total_sell} copied_sell=${copiedManual?.total_sell}`
    );

    const supportedEstimateId = randomUUID();
    const { error: supportedEstimateError } = await admin.from("estimates").insert({
      id: supportedEstimateId,
      org_id: orgId,
      project_id: supportedProjectId,
      status: "ready",
    });
    if (supportedEstimateError) throw new Error(supportedEstimateError.message);
    const { error: supportedAreaError } = await admin.from("work_areas").insert([
      {
        id: randomUUID(),
        org_id: orgId,
        project_id: supportedProjectId,
        type: "deck",
        name: "Deck",
        status: "confirmed",
        sort_order: 1,
      },
      {
        id: kitchenAreaId,
        org_id: orgId,
        project_id: supportedProjectId,
        type: "kitchen",
        name: "Kitchen",
        status: "confirmed",
        sort_order: 2,
      },
    ]);
    if (supportedAreaError) throw new Error(supportedAreaError.message);
    const { error: supportedDocError } = await admin.from("pricing_documents").insert({
      org_id: orgId,
      project_id: supportedProjectId,
      estimate_id: supportedEstimateId,
      title: `Supported pricing ${suffix}`,
      status: "draft",
      subtotal_cost: 14574.7,
      subtotal_sell: DECK_SELL,
      gross_profit: 3643.68,
      margin_percent: 20,
      markup_percent: 25,
      gst_rate: 15,
      gst_amount: 2732.76,
      total_incl_gst: 20951.14,
      created_by: userId,
    });
    if (supportedDocError) throw new Error(supportedDocError.message);
    const supportedDecision = decideManualPricingHandoff([]);
    const { count: kitchenManualLines } = await admin
      .from("pricing_items")
      .select("id", { count: "exact", head: true })
      .eq("project_id", supportedProjectId)
      .eq("work_area_id", kitchenAreaId);
    check(
      "deck and kitchen do not open a manual Pricing document",
      supportedDecision.action === "create_new" && (kitchenManualLines ?? 0) === 0,
      `handoff=${supportedDecision.action} kitchen_manual_lines=${kitchenManualLines ?? 0}`
    );
  } finally {
    await admin.from("organisations").delete().eq("id", orgId);
    for (const userId of userIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nmanual pricing concurrency checks passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
