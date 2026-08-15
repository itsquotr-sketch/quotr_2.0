# FOUNDATION-R1-R1 — Project Conditions readiness audit

**Date:** 2026-08-15  
**Status:** Implemented locally (Owner Preview Pending)  
**Does not start:** FOUNDATION-R2, REQ-1, requirement emission, Deck takeoff, 3.2.3, DNA, PERF, Production

---

## Owner Preview regression

After FOUNDATION-R1 Preview deploy, Owner found:

1. Quick Estimate could be generated before Project Conditions were completed.
2. Deck / Bathroom / Demolition / External Stairs / Kitchen / Fence / Retaining showed **no Project Conditions**.

R1 correctly removed WA duplicates (`bathroom.access`, `demolition.access`, etc.). It did **not** delete the PROJECT ASK registry. The regression is handoff + gating, not “questions were deleted.”

---

## ROOT CAUSE A — missing Project Conditions

The Builder Interview engine still emits PROJECT ASK CONSTRAINT candidates (`interview.site.*`) when a confirmed Work Area exists and the constraint is unknown.

What hid them:

1. **Auto-unlock.** After Scope Details, `AssistantShell` called `saveConstraints(project.id, [])` as soon as Project Conditions was preferred. That advanced stage to `ready_to_estimate` **without any answers**.
2. **Disclosure.** `resolveActiveDisclosureStage` then returned `null` (“Quick Estimate panel leads”). The PC card was no longer the active incomplete stage.
3. **Compress after generate.** Once an estimate existed, `compressCompletedSetup` hid completed setup cards — including Project Conditions — so Owner saw no PC stage.
4. **Applicability gap.** Several canonical keys (`waste_bin_access`, `site_slope`, `consent_engineering`, …) were CORE templates only, not in the live PC ASK batch.

R1 DEFER of WA access clones did **not** empty the PROJECT ASK set.

---

## ROOT CAUSE B — premature Estimate readiness

Generate enablement was **stage-only**:

`canGenerateEstimate = constraintsSubmitted && !estimateReady`

`constraintsSubmitted` became true from the empty `saveConstraints([])` unlock.

`deriveInterviewReadiness.canGenerateQuickEstimate` / `softBlockQuickEstimate` existed but were **presentation-only** (deferred to 3.2.4). The server `runEstimateGeneration` path checked stage only — not unresolved required Project Conditions.

Skip / Not sure / assume already **do not** persist values. They did not falsely complete the engine — Generate simply ignored completeness.

---

## Contract after R1-R1

- Project Conditions = sole user-facing ask for site-wide conditions.
- Scope Details = WA physical facts only. No WA duplicate reintroduction.
- Applicability is deterministic from confirmed WAs + Facts. Not all 14 keys on every job.
- Required unresolved → HARD BLOCK Generate (UI + server).
- Assumable asked; “Use reasonable assumption” is **not** a durable resolve (still `assumption_deferred`).
- Optional never blocks.
- Skip / Not sure on required ≠ resolved.
- Known extracted constraints show as Known and are not re-asked.
- PC stage shows when known **or** applicable unanswered.
