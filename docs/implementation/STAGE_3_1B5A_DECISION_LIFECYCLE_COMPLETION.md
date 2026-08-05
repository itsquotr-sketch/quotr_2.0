# Stage 3.1B.5A — Decision Lifecycle Completion

**Status:** Complete — Local  
**Date:** 2026-08-05  
**Migration:** `supabase/migrations/029_scope_discovery_acceptance_rpc.sql`  
**Verify:** `scripts/verify-stage-3-1b5a-decision-lifecycle.ts`  
**Depends on:** Migration 028 (local)  
**Remote apply:** **Not Applied** (028 and 029)  
**Production adoption:** **Not Started**  
**Analyse Job:** **Unchanged**  
**UI:** **Not Started**

---

## 1. Objective

Implement a local transactional lifecycle for accepting, rejecting, and modify-accepting scope-discovery suggestions — creating at most one Work Area per suggestion, preserving append-only decisions and immutable proposal payloads, without fabricating Facts or wiring production UI.

---

## 2. Acceptance transaction

RPC: `public.accept_scope_discovery_suggestion(suggestion_id, project_id, source_revision, reason_code?, user_note?)`

1. Resolve `auth.uid()` + org from `profiles`.  
2. Lock suggestion `FOR UPDATE`.  
3. Verify org/project/run eligibility.  
4. Insert `work_areas` (`status=confirmed`, `ai_confidence=null`).  
5. Append `ACCEPT` decision with `created_work_area_id`.  
6. Return `{ ok, decision_id, work_area_id, ... }`.  
7. Any failure rolls back the entire function transaction.

---

## 3. Rejection transaction

RPC: `public.reject_scope_discovery_suggestion(...)`

- Append-only `REJECT`; no Work Area.  
- Idempotent retry returns existing REJECT.  
- Blocked after scope creation.  
- No Company DNA effect.

---

## 4. Modify transaction

RPC: `public.modify_accept_scope_discovery_suggestion(...)`

- Validates modified title / description / catalogue type.  
- Creates Work Area from corrected values.  
- Appends `MODIFY` with modification fields + `created_work_area_id`.  
- Does **not** rewrite original suggestion columns.  
- Counts as scope-creating (blocks later ACCEPT/MODIFY).

---

## 5. Eligibility

Blocked when: foreign org (as not found); stale; superseded; non-scope kind; existing scope-creating decision; existing ACCEPT; existing REJECT (for accept/modify); unsupported type; duplicate confirmed WA type; invalid modification.

Stable codes: `SUGGESTION_NOT_FOUND`, `SUGGESTION_NOT_ELIGIBLE`, `ALREADY_ACCEPTED`, `ALREADY_SCOPE_CREATED`, `STALE_SUGGESTION`, `SUPERSEDED_SUGGESTION`, `FOREIGN_OR_MISSING`, `INVALID_MODIFICATION`, `DUPLICATE_WORK_AREA`, `DECISION_CONFLICT`, `TRANSACTION_FAILED`.

---

## 6. Work Area mapping

| Field | Source |
| --- | --- |
| `org_id` | Auth profile |
| `project_id` | Request |
| `type` | Proposed or modified catalogue type |
| `name` | Proposed or modified title |
| `status` | `confirmed` |
| `ai_confidence` | `null` |
| `summary` | Proposed or modified description |
| `sort_order` | max(existing)+1 |

No quantities, rates, margins, Facts, or provider dumps.

---

## 7. Fact protection

RPCs never insert/update `project_facts`, questions, estimates, pricing, or quotes.

---

## 8. Immutability

Suggestion payload columns remain frozen (028 triggers). Decisions remain append-only. Provenance is decision linkage only.

---

## 9. Idempotency / concurrency

- Partial unique `(suggestion_id) WHERE decision_type IN ('ACCEPT','MODIFY') AND created_work_area_id IS NOT NULL`.  
- Suggestion row lock + uniqueness → one WA under concurrent ACCEPT / MODIFY.  
- Reject retries reuse existing REJECT.  
- Forced WA or decision failure leaves neither orphan.

---

## 10. RLS / grants

SECURITY INVOKER RPCs; `search_path = public`. EXECUTE to `authenticated` + `service_role` only. No anon EXECUTE. Table RLS unchanged.

---

## 11. Persistence adapters

`lib/scope-discovery/decisions/` — Zod validation, eligibility helpers, RPC service, safe errors. Not imported by Analyse Job or Assistant UI.

---

## 12. Local verification

`verify-stage-3-1b5a-decision-lifecycle.ts` — local-only; **46 passed, 0 failed** (acceptance, rejection, modify, atomicity, concurrency, security, boundaries).

---

## 13. Full regression

All passed (2026-08-05):

| Check | Result |
| --- | --- |
| `supabase db reset` (001–029) | Pass |
| `tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `verify-stage-3-1a-product-stabilisation.ts` | Pass |
| `verify-stage-3-1a-r1-preview-remediation.ts` | Pass |
| `verify-stage-3-1d-domain-model-refinement.ts` | Pass |
| `verify-stage-3-1b1` … `3.1b4b` | Pass |
| `verify-stage-3-1b5a-decision-lifecycle.ts` | 46/46 |
| `verify-rls-coverage.ts` | Pass |
| `verify-batch-2b10-final-commercial-authority.ts` | Pass |
---

## 14. Remote status

**Migration 029 — Complete — Local, Not Applied Remotely.**  
**Migration 028 remote apply — Not Approved.**

---

## 15. Known limitations

- Does not seed missing-details question blocks (deferred to 5B/UI).  
- Does not restore existing suggested/excluded rows of same type (inserts new confirmed).  
- No production server actions / routes.  
- Clarification-only kinds are not accept-eligible.

---

## 16. Rollback

- Pre-adoption: drop functions/index in 029.  
- Post-data: disable feature; preserve decisions and Work Areas.

---

## 17. Confirmation — no production adoption

No remote apply, Analyse Job wiring, Assistant UI, commercial-formula, Company DNA, or Builder Interview work.

---

## 18. Recommendation for 3.1B.5B

Wire gated server actions + optional missing-details seed after accept; Preview-only flag; still no Analyse Job rewire until separately gated; remote apply of 028/029 remains owner-gated.
