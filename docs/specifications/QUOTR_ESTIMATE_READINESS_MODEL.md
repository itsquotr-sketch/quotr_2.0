# Quotr Estimate Readiness Model

**Status:** Stage 3.2.0-R1 conceptual model; **derived in 3.2.1 pure engine**; **presented near Quick Estimate in 3.2.2** (label + attention only) — **Generate soft-block deferred to 3.2.4**  
**Date:** 2026-08-12  
**Complements:** Builder Interview architecture; existing Quick Estimate attention routing (3.1B R6-R4.1)  
**Reconciliation:** `docs/audits/STAGE_3_2_0_R1_ARCHITECTURE_RECONCILIATION.md`  
**Engine:** `docs/architecture/STAGE_3_2_1_CANDIDATE_ENGINE_ARCHITECTURE.md`  

Do not create another giant blocking gate.  
Do not create another competing readiness **source of truth**.  
Soft-block applies to **Quick Estimate readiness only** (D3) — not Pricing/Quote.

---

## 1. Intent

Separate:

- what **genuinely prevents** a sensible estimate;
- what **reduces confidence** but still allows pricing;
- what is merely **nice to know**.

Builder Interview feeds this model as a **derived projection** over interview candidates, calculator `missingInfo`, and existing gates. It does not replace Scope Details completeness, Scope Review decisions, company setup readiness, or the assistant stage machine.

---

## 2. Readiness states

| State | Meaning | User experience |
| --- | --- | --- |
| **READY** | No open P0 unknowns; required calculator inputs satisfied or derived; no critical scope contradictions | Generate estimate normally; confidence healthy |
| **READY WITH ASSUMPTIONS** | P0 cleared only via explicit “Use reasonable assumption” or approved system assumptions; or open P2/P3 only | Generate allowed; show assumptions; confidence tempered |
| **NEEDS IMPORTANT INFORMATION** | Open P0 (or owner-approved critical P1) without assumption | Nudge interview / Details / Review; generate may be allowed with strong warning **or** soft-blocked per D3 |

### Non-goals

- Not a 30-item checklist gate  
- Not “all Scope Details optional questions answered”  
- Not company setup readiness (separate — `lib/setup/readiness.ts`)  
- Not quote-ready commercial sign-off  

---

## 3. What blocks vs reduces confidence

### Genuinely prevents sensible estimate (P0 class)

Examples:

- Primary quantity unknown and not derivable (e.g. deck area/length×width both missing)  
- Confirmed WA with zero usable quantity inputs and no assumption  
- Critical scope undecided when ISD requires completion (existing Scope Review gate when flag on)  
- Irreconcilable Fact conflict user has not resolved  

### High impact but assumption-capable (P1)

Examples:

- Material carry distance on demolition-heavy job  
- Occupied site on commercial fitout  
- Services isolation unknown on stripout  
- Hazmat unknown on older renovation  

→ Prefer ASK; allow “Use reasonable assumption” → READY WITH ASSUMPTIONS.

### Useful / optional (P2/P3)

Examples:

- Parking nuance when access already “Difficult”  
- Client-supplied items when supply scope already set in Details  
- Paint brand  

→ Never block estimate.

---

## 4. Interaction with existing systems

| System | Role |
| --- | --- |
| `project_facts` missing required | Still drives Detail completeness (3.1D) |
| Calculator `missingInfo[]` | Maps into P0/P1 where keyed; else confidence |
| Quick Estimate attention | Routes QUESTION → Scope Details; SCOPE → Scope Review; future SITE → Interview |
| Constraints required flags | Feed interview candidates; not a second readiness SoT |
| Estimate `assumptions[]` / `missing_info[]` | Presentation + confidence |
| Company setup readiness (`lib/setup/readiness.ts`) | Independent gate for quote / org setup — **do not merge** |
| Assistant stage (`ready_to_estimate`) | Wizard progression; generate stage gate today — readiness triad **overlays** UX, does not rename stages |
| Progressive disclosure | UI accordion only — not readiness |

### Authority rule (3.2.0-R1)

```
READY triad = derived view(open P0/P1 interview candidates, explicit assumptions,
                           mapped calculator missingInfo, ISD Scope Review blockers when enabled)
```

No new readiness table. Soft-block (Owner D3) may prevent/warn on generate without changing Fact SoT.

---

## 5. Assumption impact on confidence

| Event | Readiness effect | Confidence effect |
| --- | --- | --- |
| User answers P0 | Clears toward READY | Positive |
| User chooses reasonable assumption on P0/P1 | READY WITH ASSUMPTIONS | Mild penalty + listed assumption |
| User Skip / Not sure on P0 | Remains NEEDS IMPORTANT INFORMATION | Strong penalty if generate allowed |
| Skip on P2/P3 | Still READY / READY WITH ASSUMPTIONS | Negligible |
| System BENCHMARK | Usually silent | None or tiny |

---

## 6. Generate policy (recommendation for D3)

| State | Generate Quick Estimate |
| --- | --- |
| READY | Allowed |
| READY WITH ASSUMPTIONS | Allowed; banner lists assumptions |
| NEEDS IMPORTANT INFORMATION | Soft-block with CTA to answer 1–3 P0 questions; Owner may allow “estimate anyway” with loud confidence warning |

**Recommended:** Soft-block P0, never hard-lock the product behind a full interview.

---

## 7. Multi-WA readiness

Project readiness is the **worst** of:

- project-level interview P0s;
- any confirmed WA with blocking missing quantities;
- unresolved required Scope Review items (when ISD enabled).

Project-wide answered site topics do not re-open per WA.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/QUOTR_ESTIMATE_READINESS_MODEL.md` |
| Owner decision | D3, D5, D14 (invalidation), D15 (recompute) |
