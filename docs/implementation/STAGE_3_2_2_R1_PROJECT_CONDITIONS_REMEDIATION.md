# Stage 3.2.2-R1 — Project Conditions Remediation

**Status:** Complete Local — Deck Owner Retest Pending  
**Date:** 2026-08-12  
**Baseline:** `8a45ef4`

---

## Delivered

1. **Commercial:** `getCombinedLabourAccessFactor` — project `site_access` consumed once (Deck/Fence/Pergola).  
2. **Architecture UX:** Site Constraints primary card suppressed when Project Conditions is active; known + remaining + Edit conditions in one surface.  
3. **Question UI:** Question → helper → primary options; secondary Not sure / Assume / Skip once; Not sure stripped from primary options.  
4. **Copy:** Truthful Not sure / assumption wording (no “invent”).  
5. **Disclosure:** incomplete Scope Details categories (any unanswered) start open; sticky preserved.  
6. **Perf (low-risk):** parallel Analyse constraint writes; project-only revalidate after brief seed.  
7. Verify: `scripts/verify-stage-3-2-2-r1-deck-owner-remediation.ts`

---

## Persistence

Unchanged: Project Conditions → `constraints` via existing upsert. No migration. No parallel table.

---

## Non-goals honoured

- No 3.2.3  
- No 3.2.4 assumption persistence  
- No DNA / Production SD / formula rate rewrites  
- No full Assistant shell redesign (recommendation documented)

---

## Assistant shell simplification (recommendation — not fully implemented)

Future presentation grouping only:

1. **PROJECT** — Capture / Work Areas  
2. **SCOPE** — Review / Specification / Scope Details  
3. **PROJECT CONDITIONS** — Known + remaining (done in R1 merge)  
4. **ESTIMATE** — Review / Generate  

Canonical domain stages remain; UI grouping is presentation-only.

---

## Stage status

| Item | Status |
| --- | --- |
| 3.2.2 | In Owner Preview / R1 remediation (Complete Local pending Deck retest) |
| 3.2.3 | Not Started |
| Stage 3.2 global | Not Complete |
| Production Scope Discovery | Disabled |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned (evidence updated) |
