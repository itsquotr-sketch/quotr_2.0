# Stage 3.1A + Stage 3.1D — Preview Sign-Off

**Document type:** Owner-gated Preview closure  
**Date:** 2026-08-05  
**Result:** **Passed** — Stage 3.1A and Stage 3.1D closed  
**Constraint compliance:** Documentation and status only; no application code, migrations, database, commercial formula, AI prompt, ISD, deferred schema, or Company DNA changes in this closure  

---

## 1. Preview environment

| Field | Value |
| --- | --- |
| Host | Vercel Preview |
| Deployment | Preview deployment for branch `hardening/stage-2a-security` |
| Scope | Combined Stage 3.1A + Stage 3.1A-R1 + Stage 3.1D smoke |

---

## 2. Branch and commit

| Field | Value |
| --- | --- |
| Branch | `hardening/stage-2a-security` |
| Commit | `ccab50c7ec0a6846f922e68f89e125f1c2df382f` (`ccab50c`) |
| Commit subject | Stabilise project capture, answers, spec editing and client details |

---

## 3. Test date

**2026-08-05** — Owner completed combined Stage 3.1A and Stage 3.1D Preview smoke successfully.

---

## 4. Project Capture result

**Passed.**

- Project Brief and Site Notes are clearly differentiated.
- Analyse Job receives both Project Brief and Site Notes.

---

## 5. Answer persistence result

**Passed.**

- Rapid answer changes preserve the latest answer.
- Older server responses do not overwrite the latest answer.
- Refresh preserves the final saved answer.

---

## 6. Saving / Saved / Error result

**Passed.**

- Saving and Saved states work as expected during answer edits.

---

## 7. Rapid-edit reconciliation result

**Passed.**

- Latest-write-wins behaviour confirmed under rapid edits.
- Stale server responses do not clobber the latest local answer.

---

## 8. Enum-formatting result

**Passed.**

- Raw enum values are no longer shown to users.
- Display uses human-readable labels; storage remains canonical.

---

## 9. None-answer result

**Passed.**

- Deliberate None answers are accepted as valid and satisfy the relevant requirement.

---

## 10. Fact source-of-truth result

**Passed.**

- Facts remain the estimating / readiness source of truth.
- Question answers do not independently authorize estimate readiness.

---

## 11. Derived-fact non-overwrite result

**Passed.**

- Derived facts do not overwrite user-authored facts.

---

## 12. Missing-information result

**Passed.**

- Missing-information evaluation uses current Facts.

---

## 13. Specification-level result

**Passed.**

- Quick Estimate Edit opens the existing Quality / specification editor.
- Specification level saves and persists after refresh.

---

## 14. Client-detail lifecycle result

**Passed.**

- Project client details propagate to Pricing.
- Pricing edits update the authoritative project / client details.
- Dirty Pricing form state is protected from silent overwrite.
- Historical quote snapshots are not rewritten.

---

## 15. Login and rates UX result

**Passed.**

- Login spacing is acceptable.
- Rates-page spacing is acceptable.

---

## 16. Commercial regression result

**Passed.**

- Estimate → Pricing → Quote regression passes.
- GST and commercial totals remain correct.
- Unknown-cost behaviour remains honest.
- No commercial formula changes were introduced by this Preview closure.

---

## 17. Vercel log review

**Passed.**

- Vercel Preview logs contain no unexplained errors.

---

## 18. Supabase log review

**Passed.**

- Supabase logs contain no unexplained errors.

---

## 19. Incidents or warnings

**None.** No incidents or unresolved warnings recorded during owner Preview sign-off.

---

## 20. Rollback required

**No.** No rollback was required.

---

## 21. Remaining accepted limitations

The following remain accepted and are **not** blockers for closing 3.1A / 3.1D:

1. Sequential per-answer DB writes remain (no batch write redesign).
2. Full RSC refresh still used after save where required for missing-item correctness.
3. Dual question + fact storage retained; future write paths must continue through shared persistence helpers.
4. Heal of question→fact drift is best-effort when missing-details / scope writes run.
5. Estimate history still overwrite-on-regen (deferred schema D-S5; not approved).
6. Photos / file documents / evidence store still missing (out of scope).
7. Constraint taxonomy expansion (FEAT-003) and optional quote presentation (FEAT-002) remain Deferred.
8. Collapsible work-area cards (FEAT-001) remain Deferred.
9. Assemblies still absent — Stage 3.3 not ready.
10. Company DNA / Evidence Engine not started.
11. Stage 2B deploy/smoke remains a separate owner-gated track where applicable.

---

## 22. Final statuses

| Item | Status |
| --- | --- |
| Stage 3.1A — Product Stabilisation | **Complete** |
| Stage 3.1A-R1 — Preview Remediation | **Complete** |
| Stage 3.1C — Domain Model Audit | **Complete** (unchanged) |
| Stage 3.1D — Domain Model Refinement | **Complete** |
| Stage 3.1B — Intelligent Scope Discovery | **Ready to Plan** |
| Deferred schema proposals | **Not Approved** |
| FEAT-001 through FEAT-003 | **Deferred** |

Evidence of this sign-off: this document. Supporting local evidence remains in:

- `docs/implementation/STAGE_3_1A_PRODUCT_STABILISATION_COMPLETION.md`
- `docs/implementation/STAGE_3_1A_R1_PREVIEW_REMEDIATION.md`
- `docs/implementation/STAGE_3_1D_DOMAIN_MODEL_REFINEMENT_COMPLETION.md`
- `docs/runbooks/STAGE_3_1A_PREVIEW_SMOKE_TEST.md`

---

## 23. Confirmation — Intelligent Scope Discovery has not started

**Confirmed.** Stage 3.1B (Intelligent Scope Discovery) has **not** started. Status is **Ready to Plan** only. No ISD implementation, prompts, or discovery UX work began as part of this closure.

---

## 24. Confirmation — Deferred schema proposals remain unapproved

**Confirmed.** Proposals in `docs/architecture/STAGE_3_1D_DEFERRED_SCHEMA_PROPOSALS.md` remain **Not Approved**. No migrations implementing those proposals were run or authorised by this sign-off.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1A_3_1D_PREVIEW_SIGNOFF.md` |
| Created | 2026-08-05 |
| Owner | Product owner Preview confirmation |
| Closure type | Documentation / status only |
