# Stage 3.1B.4B-0 — Persistence Architecture and Security Gate Completion

**Status:** Complete — Planning  
**Date:** 2026-08-05  
**Type:** Documentation / schema design / verification planning only  
**SQL / migrations created:** **No**  
**Application code changed:** **No**  
**Analyse Job:** **Unchanged**  

---

## 1. Objective

Finalise the minimum durable persistence model for scope-discovery runs, immutable suggestions, evidence (as JSONB), append-only decisions, idempotency, and future accept/reject/modify — with org isolation, Fact SoT preservation, and no commercial/DNA authority — **without** writing SQL.

---

## 2. Deliverables

| Document | Path |
| --- | --- |
| Architecture | `docs/architecture/STAGE_3_1B4B_PERSISTENCE_ARCHITECTURE.md` |
| Security review | `docs/security/STAGE_3_1B4B_PERSISTENCE_SECURITY_REVIEW.md` |
| Verification plan | `docs/runbooks/STAGE_3_1B4B_PERSISTENCE_VERIFICATION_PLAN.md` |
| Owner approval register | `docs/decisions/STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md` |
| This completion | `docs/implementation/STAGE_3_1B4B0_PERSISTENCE_GATE_COMPLETION.md` |

Updated: persistence proposal, Stage 3.1B plan, backlog, roadmap, MVP hardening guide.

---

## 3. Recommended table model

**Three tables:** `scope_discovery_runs`, `scope_discovery_suggestions`, `scope_discovery_decisions`.  
**Evidence:** validated JSONB on suggestions — **no** separate evidence table in MVP.  
**Naming:** `org_id` for consistency with Quotr child tables and `auth_org_id()`.

---

## 4. Immutability model

- Runs: update-limited while `RUNNING`; identity/snapshot/versions frozen after terminal.  
- Suggestions: payload/evidence immutable; status/stale/supersede update-limited.  
- Decisions: append-only events.  
- Soft-archive optional; no normal hard delete.

---

## 5. Idempotency / concurrency

Partial unique index on `(project_id, idempotency_key) WHERE status = 'RUNNING'`. Insert-before-provider. Concurrent Analyse: one winner; loser reuses or gets `DUPLICATE_IN_FLIGHT`. No distributed lock required.

---

## 6. Org / project integrity

Reuse `enforce_child_project_org_match` + run/suggestion/decision match triggers. Server derives `org_id`; never trust client.

---

## 7. RLS design

Org-scoped via `auth_org_id()`; SELECT/INSERT; limited UPDATE; no client DELETE; no decision UPDATE; no anon grants (026).

---

## 8. JSONB / column decisions

Ownership, status, versions, keys, confidence band → columns. Snapshot, provider metadata, evidence, missing_information → validated JSONB with caps/allowlists.

---

## 9. Data minimisation

No secrets, raw provider bodies (default), commercial fields, attachments, or DNA rules. Persist canonical validated results + metadata.

---

## 10. Accept / reject / modify

Future transactional accept (decision + WA create); reject/modify append decisions; original suggestion preserved; Fact SoT untouched. RPC recommended — owner gate.

---

## 11. Migration safety

Reserved **`028`** after `027`. Local Docker first; remote owner-gated. Pre-adoption drop OK; post-data preserve + feature-flag off.

---

## 12. Threat review

Documented in security review (cross-org, forgery, duplicate accept, JSONB abuse, immutable UPDATE, service-role, anon, etc.).

---

## 13. Verification plan

Local-only runbook with V-01…V-82 style checks; refuse non-local URLs for destructive verification.

---

## 14. Owner approvals required

Fifteen decisions in `STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md` — **all Pending**. Recommended MVP values provided; **none marked approved**.

---

## 15. Confirmation

- Docs only.  
- No migration file created.  
- No application / Supabase / Analyse Job / UI / prompt / commercial / DNA / Builder Interview changes.

---

## 16. Status

| Item | Value |
| --- | --- |
| Stage 3.1B.4B-0 | **Complete — Planning** |
| Stage 3.1B.4B implementation | **Ready Pending Owner Approval** |
| Migration | **Not Approved** |
| Production adoption | **Not Started** |
| Analyse Job | **Unchanged** |

---

## 17. Next step

Owner completes approval register. Only then authorise batch to write `028` SQL and run local verification plan.
