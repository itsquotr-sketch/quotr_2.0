# Stage 3.1B.7F — Owner Preview E2E Test Pack

**Status:** Ready for Owner Execution (post–Stage 3.1C; run after confirming latest Preview)  
**Date:** 2026-08-07 (prep refreshed 2026-08-10)  
**Closes:** DEF-7E-003 (when all three journeys PASS)  
**Final sign-off:** `docs/runbooks/STAGE_3_1B_OWNER_PREVIEW_FINAL_SIGNOFF.md`  
**7F-R3 Deck retest first (if not already signed):** `docs/runbooks/STAGE_3_1B7FR3_DECK_FINAL_RETEST.md`  
**Preview flag:** `SCOPE_DISCOVERY_ENABLED=true` on Preview branch  
**Production:** Remains **Disabled**  
**Results capture:** `docs/audits/STAGE_3_1B7F_OWNER_E2E_RESULTS.md`  

This pack supports live Preview journeys. It does **not** prescribe exact AI
wording. Use PASS / FAIL / PARTIAL in the results file.

---

## Before you start

1. Open the latest Preview deployment for `hardening/stage-2a-security`  
   (or the URL recorded in the defect register).
2. Confirm Scope Review appears after Work Areas (flag on).
3. Note commit / deployment URL / timestamp in the results file.
4. Prefer one browser session per project (Desktop 1440 + one Mobile 390 pass).
5. Watch browser console + Vercel logs; do not paste secrets or full briefs into docs.

### Journey checklist (every project)

1. Project Capture (brief + notes)  
2. Analyse Job  
3. Confirm Work Areas  
4. Automatic Scope Review  
5. Batch Confirm scope (and at least one Not required)  
6. Specification  
7. Scope Details  
8. Site Constraints  
9. Estimate Review  
10. Generate Quick Estimate  
11. Pricing draft  
12. Quote draft (if available after review)  

Also deliberately trigger **one scope-impact** change (edit a Fact that should
suggest a scope-item state change) and exercise Apply or Keep.

### Stage 3.1B.7G presentation checks (every project)

On Desktop (1024+):

- [ ] Quick Estimate **sticks** while scrolling the centre column (not a floating overlay)
- [ ] Commercial hierarchy: Recommended sell → range → confidence → Cost / Margin / GP
- [ ] Concise status (“Ready for pricing” or “N items need attention”)
- [ ] **Prepare final pricing** above secondary disclosures
- [ ] Project readiness / Scope / Assumptions / Rate sources collapse/expand
- [ ] **View full breakdown** remains available and secondary to the CTA
- [ ] Centre completed stages are one–two lines; expand restores full detail
- [ ] Active stage is visually dominant vs completed/locked stages

On Tablet / Mobile (&lt;1024):

- [ ] No sticky side rail
- [ ] Compact Quick Estimate summary (sell · confidence / ready) + View estimate
- [ ] Full estimate content accessible without overlapping primary actions
- [ ] No duplicated desktop + mobile estimate chrome at once

---

## Quality rubric (1–5)

Owner acceptance guidance only — **not** a production SLA.

| Category | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Work Area identification | Wrong / missing major WA | Mostly right with noise | Correct high-level WAs |
| Scope-item completeness | Major omissions | Key items present | Sensible coverage for brief |
| Scope-item relevance | Many irrelevant | Some noise | Mostly on-topic |
| Exclusions respected | Explicit exclusions ignored | Partial | Exclusions honoured |
| Clarification quality | Useless / fabricated | Mixed | Useful unknowns |
| Question relevance | Off-WA / duplicate | Mostly OK | Correct WA & timing |
| Constraint relevance | Wrong / invented | Partial | Supported constraints sensible |
| Estimate transparency | Opaque / confusing | Usable | Clear readiness/confidence |
| Overall workflow usability | Broken / confusing | Completable | Coherent end-to-end |

**Release target recommendation**

- No category below **3**
- Average ≥ **4** for each project
- No Critical / High functional defect

---

## Project A — Deck

### Initial Project Brief (paste into Project Capture)

```text
Residential rear elevated timber deck for a two-storey house in Auckland.
Proposed deck about 5.2 m long by 3.1 m wide, finished floor roughly 1.2 m above
ground at the outer edge. Client wants hardwood decking boards with fascia.
Existing weathered pine deck to be removed. Substructure condition unknown —
some piles look stained but not inspected. Include a single step down to lawn.
No balustrade required — client confirmed exclusion. Site access is restricted
down a narrow side path; waste carting about 25–30 m to the street.
```

### Site Notes (2–4)

1. `Visited site. Side access too narrow for a wheelbarrow without two people.`  
2. `Existing deck demolition confirmed. Client keeping garden beds either side.`  
3. `Client said they do not want a balustrade. Confirm in writing later.`  
4. `Hardwood preference stated; stain colour not decided.`  

### Expected high-level Work Areas

- Deck (primary)  
- Possibly related access/demolition captured under Deck scope — not a separate WA unless Analyse Job proposes one that is clearly justified  

### Likely scope items (illustrative)

- Existing deck removal / demolition  
- New deck framing / substructure allowance (unknown piles)  
- Hardwood decking  
- Fascia  
- Step  
- Balustrade should be **Not required** / excluded  

### Deliberate exclusions

- Balustrade / barrier  

### Facts that should already be known / pre-filled where supported

- Length / width (from brief)  
- Height / elevated condition (from brief)  
- Existing deck removal = Yes  
- Board material preference toward hardwood  
- Fascia included  
- Balustrade not required  

### Questions that may remain unknown / need confirmation

- Exact substructure / pile condition  
- Final stain / coating  
- Exact carry distance band if not mapped cleanly  

### Expected Site Constraints

- Restricted / difficult site access  
- Material carry distance in ~10–30 m or >30 m band  
- Not occupied commercial; residential site may still prompt occupied-site question  

### Scope-impact change to test

After Scope Details: change **Existing deck removal** or **Balustrade** answer and
confirm a Scope Review recommendation appears (or Analyse again if stale policy
requires it). Apply or Keep once.

### Expected estimate journey

Specification → complete required Scope Details → Site Constraints → Estimate
Review summary → Generate estimate → open full breakdown → Prepare final pricing
→ draft quote if flow allows.

---

## Project B — Bathroom

### Initial Project Brief

```text
Full bathroom renovation in an occupied family home. Strip existing bathroom
back to framing. Client keeps the existing toilet pan if serviceable; replace
vanity and shower. New waterproofing membrane throughout wet areas. Floor and
wall tiling. Relocate shower mixer slightly. Plumbing and electrical alterations
as required. Existing substrate condition under tiles unknown until strip-out.
Access via hallway; house occupied during works; limited daytime working hours.
```

### Site Notes

1. `Client wants to retain toilet if possible after inspection.`  
2. `House lived in during works — dust and access management needed.`  
3. `Working hours restricted: no noisy work before 8am or after 5pm weekdays.`  
4. `Tile selection not final — provisional allowance OK.`  

### Expected high-level Work Areas

- Bathroom (primary)  

### Likely scope items (illustrative)

- Demolition / strip-out  
- Waterproofing  
- Floor tiling / wall tiling  
- Plumbing alterations  
- Electrical alterations  
- Vanity  
- Shower  
- Toilet — retained / conditional  

### Deliberate exclusions / retentions

- Client-retained toilet (if serviceable) — do not force replace without evidence  

### Facts that may be known

- Occupied site  
- Working-hour restrictions  
- Demolition required  
- Waterproofing required  

### Questions that should remain unknown

- Substrate condition after strip-out  
- Final tile selection  
- Exact toilet retain vs replace after inspection  

### Expected Site Constraints

- Occupied site  
- Working hours  
- Access moderate / hallway  

### Scope-impact change to test

Toggle a clarification or fixture retain/replace answer and confirm Scope Details
/ scope-impact behaviour does not invent Facts or duplicate WAs.

### Expected estimate journey

Same as Deck through pricing/quote. Confirm optional/uncertain items do not
fabricate certainty in estimate assumptions.

---

## Project C — Commercial Fitout

### Initial Project Brief

```text
Small commercial office fitout on level 2 of an existing multi-tenant building.
Scope includes strip-out of previous tenant fitout, new partitions, suspended
ceiling alterations, new doors, services coordination with base-build HVAC and
fire, fire stopping at penetrations, seismic restraints for partitions/ceilings
where required, and make-good to landlord base-build condition at handover.
Goods lift available but booking required; loading dock shared; after-hours
access only for noisy works. Landlord approval required for base-build
connections.
```

### Site Notes

1. `Level 2 — materials via goods lift only; booking 24 hours ahead.`  
2. `Landlord wants fire stopping certificates for all penetrations.`  
3. `Noisy works after 6pm only.`  
4. `Base-build HVAC taps exist; exact connection points TBD with services engineer.`  

### Expected high-level Work Areas

- Commercial fitout / office (or equivalent catalogue type)  
- Possibly separate services coordination only if product proposes a justified WA  

### Likely scope items (illustrative)

- Strip-out  
- Partitions  
- Ceilings  
- Doors  
- Services coordination / allowances  
- Fire stopping  
- Seismic restraints / bracing allowances  
- Make-good  

### Deliberate exclusions / conditions

- Landlord / base-build works outside tenant scope should not be silently included
  as free complete packages  

### Facts / knowns

- Upper floor / level 2  
- Restricted working hours  
- Access / logistics constrained  

### Questions that should remain unknown

- Exact seismic design confirmation  
- Exact services connection details  
- Fire stopping quantity until setout  

### Expected Site Constraints

- Floor level / upper floor  
- Working hours  
- Access / deliveries logistics (where templated)  

### Scope-impact change to test

Confirm or exclude a services / fire-stopping suggestion, then ensure Estimate
Review and Quick Estimate remain coherent without duplicate WAs.

### Expected estimate journey

Full path to estimate + pricing + quote. Treat seismic/fire as allowances or
outstanding — **no legal compliance fabrication**.

---

## Latency capture (per project)

Use browser console `[quotr-preview-perf]` where present, plus stopwatch.

Capture ≥3 observations where practical:

| Action | Notes |
| --- | --- |
| Initial Assistant load | |
| Analyse Job | Progress banner visible? |
| Scope Review run | Auto after WA confirm |
| Confirm scope | |
| Question save acknowledgement | Immediate? |
| Question save completion | |
| Estimate generation | |
| Scope-impact Apply/Keep | |

**Flag if:** >1s with no acknowledgement; long Analyse/Scope Review without
progress; long saves; flicker/remount.

Record medians in `docs/performance/STAGE_3_1B_PREVIEW_PERFORMANCE_RESULTS.md`.

---

## Provider usage (safe metadata only)

Per discovery run, note if visible in logs/UI metadata:

- Calls per run  
- Repair attempts  
- Input / output tokens (if exposed)  
- Duplicate-run reuse  
- Stale rerun behaviour  

Do **not** store project text, evidence excerpts, or secrets.

---

## Log review process

During each journey:

1. Browser console — errors, warnings, no API keys  
2. Vercel deployment logs — 5xx, repeated provider calls  
3. Supabase — unexpected RLS denials  

Classify: Critical / High / Medium / Low / benign.  
Add to `docs/audits/STAGE_3_1B7E_PREVIEW_DEFECT_REGISTER.md`.

---

## Commercial check (each project)

- Quick Estimate recommended sell / range  
- Pricing conversion  
- Margin behaviour  
- GST  
- Optional items  
- Quote total + snapshot immutability  

Any unexplained money mismatch = **Critical**.

---

## Owner sign-off decision

After all three results are entered:

**A. READY FOR OWNER PRODUCTION GATE** — only if Deck, Bathroom, and Fitout
pass targets above with no Critical/High blockers.

**B. BLOCKED BY PREVIEW DEFECTS** — list exact DEF IDs.

Do **not** enable Production from this pack.
