# Quotr Calibration and Company DNA Architecture

**Status:** CANONICAL  
**Date:** 2026-08-17  
**HEAD:** `a4de0f875b3497f11d4bcd0379865a811ca4bf1c`  
**Mode:** Architecture lock. Company DNA remains **Not Started**.  
**Does not:** authorise `lib/company-dna`, silent rate writes, or Stage 3.4 implementation.

“Company DNA” must **not** mean vague AI memory.

Existing `calibration_responses` (migration 033) and outdoor calibration scenarios are **explicit evidence**, not DNA. They must not silently overwrite rates (Stage 3.1C.3-R2D contract).

---

## 1. Hard rule

**Quotr must not silently learn and change commercial assumptions or prices.**

Progression for every learning domain:

```
OBSERVE → CALCULATE → RECOMMEND → USER APPROVES → COMPANY AUTHORITY
```

Until the user approves, a suggestion is **not** a company rate, productivity, or inclusion rule.

---

## 2. Learning domains

### A. RATE LEARNING

What this contractor actually pays.

Sources: company-entered costs, approved supplier imports, approved overrides, later actual invoices.

Output: recommended `cost_rate` for a canonical key. Never auto-apply.

### B. PRODUCTIVITY LEARNING

How long this contractor expects tasks to take.

Sources: LabourRequirement hours vs user-edited hours vs later actuals.

Output: recommended hours/unit for a `taskKey`. Project Conditions stay separate — do not bake access into learned productivity **and** re-apply project factors.

### C. SCOPE PREFERENCES

What they routinely include / exclude (face boards, skip bin, painting with walls, etc.).

Sources: repeated Scope Details answers, quote disclosures, rejected ISD suggestions.

Output: recommended defaults with disclosure. Never hide a question permanently without approval.

### D. MATERIAL PREFERENCES

What materials / specifications they typically use (kwila vs pine, Aqualine in wet areas).

Sources: repeated `materialKey` choices, company catalogue, later Owner catalogue input.

Output: recommended default spec for a Work Area component. Rate still resolves separately.

### E. COMMERCIAL BEHAVIOUR

Margins, minimums, markups/GM preferences, subbie treatment, explicit sell overrides.

Sources: org default GM, project target GM, explicit charge-out overrides (CF-D6), subcontract adopt-cost patterns.

Output: recommended default GM / override policy. F-SFM remains the arithmetic. DNA must not invent markup-as-GM.

### F. OUTCOME LEARNING

Won/lost, final quote, later actual cost.

Sources: quote sent/accepted/declined, business_status, later actuals if captured.

Output: win-rate and cost-vs-quote diagnostics. Not an automatic price change.

---

## 3. Calibration evidence

Architecture must not discard information required for future calibration. A full event store is **not** required now. Generate outputs, user edits, and commercial documents must remain attributable.

### 3.1 Commercial / document evidence (eventual)

- Quotr suggested value
- user edited value
- final estimate
- final pricing document
- final quote
- quote sent
- quote accepted / declined
- project won / lost
- later actual cost where available

### 3.2 User-edit evidence (conceptual)

| Field | Meaning |
| --- | --- |
| entity | estimate line, rate, fact, requirement, margin |
| field | e.g. `unitCost`, `baseHours`, `materialKey` |
| previous value | before edit |
| new value | after edit |
| Work Area | type + id |
| component / task | `componentKey` |
| timestamp | when |
| source | ui, import, rfq adopt, calibration screen |

Existing hooks: `pricing_audit_log`, quote revisions (016), `calibration_responses` (033), estimate stale + calibration version (006/022), company material wastage (021).

Do not add a parallel undocumented store. REQ-1 must preserve provenance on requirements so later DNA can read them. **AN-EVIDENCE-01** must decide emit shape before AN-1.

---

## 4. What is not DNA

| Thing | Why |
| --- | --- |
| Outdoor / scenario calibration fixtures | Engineering goldens |
| `calibration_responses` MVP | Explicit one-off evidence; no silent overwrite |
| Company rates the user typed | Direct authority, not inferred |
| ISD accept/reject | Scope evidence; not rate DNA |
| Analytics events | Observation; not commercial authority |
| AI “remember this builder” | Forbidden as a product mechanism |

---

## 5. Sequencing

DNA-0 requires:

1. EstimateRequirements history (REQ-1+)
2. Honest rate provenance (already started)
3. Outcome events (AN-1 emitters, quote send/accept)
4. Stage 3.4 explicit company defaults / manual learning **before** automated recommend
5. Volume of real jobs — not trial anecdotes alone

Photos/voice are evidence for Facts, not a DNA shortcut.

---

## 6. Acceptance UX (architecture only)

Recommendation: a visible **Recommendations** queue (rates, productivity, defaults). Each item shows suggested vs current, evidence count, and Approve / Dismiss / Edit.

This is Owner decision OD-ARCH-03. It does **not** block REQ-1.

---

## 7. Non-goals of this lock

Building Company DNA · auto-updating rates · using AI to mutate GM · treating 033 as DNA complete.
