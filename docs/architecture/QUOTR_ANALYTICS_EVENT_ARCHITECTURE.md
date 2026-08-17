# Quotr Analytics Event Architecture

**Status:** CANONICAL  
**Date:** 2026-08-17  
**HEAD:** `a4de0f875b3497f11d4bcd0379865a811ca4bf1c`  
**Mode:** Architecture lock. Does not build analytics UI or emitters.  
**Types freeze:** `lib/analytics/event-contract.ts` (`ANALYTICS_EVENT_CONTRACT_VERSION = foundation-r1.0`)  
**AN-1:** Not Started (types only; no emitters added in FOUNDATION-R1)

Do not wait for Analytics UI before recording events. Do not build UI until enough history exists.

---

## 1. Planned event contract (already typed)

Must-record-early (AN-1):

| Event | When |
| --- | --- |
| `estimate_generated` | Quick Estimate generate succeeds |
| `pricing_created` | Pricing document created from estimate |
| `quote_created` | Quote created from pricing |
| `quote_sent` | Staff send (today manual status; later email/public URL) |
| `quote_viewed` | Public page view (needs QUOTE-2) |
| `quote_accepted` | Client accept (not staff `markQuoteAccepted` alone) |
| `quote_declined` | Client decline |

Payload minimum: `type`, `occurredAt`, `orgId`, `projectId`, optional `entityId`.

Existing crude substitutes: `business_status`, `pricing_audit_log`, quote timestamps. Keep them; do not treat them as the product event log.

---

## 2. Future events (architecture only)

| Event | Class | Notes |
| --- | --- | --- |
| `estimate_revised` | **AN-EVIDENCE-01** | Regenerated estimate; not per-keystroke |
| `estimate_line_edited` | **AN-EVIDENCE-01** | Distinct from generate if line-level calibration needs rate vs qty vs hours vs override |
| `pricing_revised` | later | Recalibration |
| `project_won` / `project_lost` | later | May alias business_status until dedicated |
| `rfq_sent` | later | RFQ-1 |
| `subcontract_quote_received` | later | RFQ-2 |
| `requirement_promoted` | later | REQ-4 parity promote |
| `recommendation_approved` | later | DNA-0 |

**AN-EVIDENCE-01 (blocks AN-1 emitters):** decide exact edit evidence before writing events. Recommended: `estimate_generated` + `estimate_revised` plus `estimate_line_edited` if Company DNA must distinguish rate / quantity / hours / explicit override. Do not force all edit detail into one generic payload. No emitters in this batch.

---

## 3. Future analytics (no UI now)

### SALES

Leads · quotes · wins/losses · quote value · acceptance time.

### COMMERCIAL

Cost · GP · margin · labour/material/subbie split (from line categories / later requirements).

### ESTIMATING

Estimate turnaround · Work Area pricing mix · productivity · calibration drift.

Cannot productise without events: turnaround, acceptance %, win/loss reasons, viewed-but-not-accepted, mix over time.

---

## 4. Multimodal / quote / RFQ (event touchpoints only)

Photos/voice feed Facts — not analytics UI.  
Quote send/accept emit the contract events.  
RFQ emits later events; adopt-cost is commercial, not an analytics rewrite.

---

## 5. Non-goals

Dashboards · warehouses · per-answer telemetry · storing project text in analytics.
