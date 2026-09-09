# Quotr Question Interaction Contract

**Classification:** CANONICAL — Clarify / Refine answer controls and persistence.  
**Does not authorise:** estimator formula changes, rates, Quote maths, commercial engine, migrations, Production.  
**Code:** `lib/assistant/clarify/question-contract.ts`, `lib/assistant/clarify/interaction.ts`, `components/assistant/clarify/`, `components/assistant/selection/OptionSelect.tsx`

This is the interaction contract for every current and future Work Area. Scope *content* still lives in `docs/architecture/QUOTR_SCOPE_DETAILS_QUESTION_CONTRACT.md`.

---

## A. How to choose question type

Pick the **semantic control**, then store it as the matching template / candidate `inputType`.

| Semantic control | When | Stored `inputType` |
| --- | --- | --- |
| `SINGLE_SELECT` | Exactly one answer can be true | `select` |
| `BOOLEAN` | Binary include / yes-no, no third exclusive state | `boolean` |
| `MULTI_SELECT` | Several answers can be true at once | `multi_select` |
| `NUMBER` | Quantity / measurement | `number` |
| `TEXT` | Free text | `text` |

**Do not** infer `MULTI_SELECT` because `options` is an array. Option lists are normal for single-select.

`clarifyControlType()` is the runtime authority. `clarifyStoredInputType()` maps Yes/No/Not sure metadata to `select` so it is not rendered as Include/Not included.

---

## B. Single-select

Use `SINGLE_SELECT` when one and only one answer is valid.

Examples: framing type, finish type, difficulty, scope level, material, site access, occupied site (Yes / No / Not sure), working hours, floor substrate.

**Behaviour**

- Tap A, then B → only B remains selected.
- Old answer deselects immediately (local/optimistic).
- Persist the chosen scalar (or canonical enum), not an array.

**Test:** select A, select B, only B remains. Reload restores B.

---

## C. Boolean

Use `BOOLEAN` for true binary questions, or genuine “Include X?” writes.

Copy:

- Yes / No for “Is demolition required?” style questions **without** a Not-sure third chip.
- Include / Not included **only** when the question is explicitly “Include X?”

Do not render Boolean as multi-select. Do not map “Not sure” to No.

If the fact supports uncertainty, use `SINGLE_SELECT` with Yes / No / Not sure and persist `"Not sure"` as that value.

**Test:** only one state. Yes and No cannot both be selected.

---

## D. Multi-select

Use `MULTI_SELECT` only when several components can coexist.

Examples: items being removed, fixtures included, services present, selected scope components.

**Behaviour**

- Each option toggles independently.
- The canonical value is **one array** (the complete set).
- Toggles stay local. **Continue** commits that set once.

**Test:** multiple values survive; deselect one preserves others; Continue persists the whole set; reload restores the exact set.

---

## E. Optimistic UI

Click/tap updates selected state immediately. Do not wait for:

- server action
- database
- candidate recomposition
- `router.refresh()`

`OptionSelect` paints `aria-pressed` from local optimistic state. Remount with `key={candidate.id}` so optimistic arrays never leak onto the next question.

Target: no perceptible network-dependent highlight. Desktop and mobile.

---

## F. Persistence

UI may be optimistic. Canonical persistence remains the current project fact / condition store.

- Select / boolean: overlay the fact or constraint **synchronously**, then serialise the write.
- Multi-select: one write of the complete array on Continue (not one write per toggle).
- Number / text: persist on Save / Continue or the existing field blur contract. Do not remount the field while typing.

On success, overlay reconciles when `requestSeq` is still latest. On failure, show the existing inline/toast error. Revert overlay **only** if that write is still the latest intent for that key.

---

## G. Latest-intent-wins

User answers Q1 then quickly Q2 while Q1 is still persisting.

A late Q1 response must **not**:

- reopen Q1
- clear Q2
- move current question backwards
- overwrite a newer overlay

Facts already keep overlays with `seq > requestSeq`. Constraints must **merge**: keep previous rows whose overlay seq is newer than the incoming snapshot. Do not replace the entire constraint list with a stale mutation payload.

Do not `router.refresh()` over a still-valid newer overlay.

---

## H. Multi-select Continue

1. Toggles update instantly and stay local.
2. Continue is immediately tappable (not blocked on prior per-option writes).
3. Continue commits **one** canonical array.
4. UI advances as soon as that write is queued / accepted (optimistic overlay + skip locally resolved ids).
5. Duplicate Continue is ignored.
6. Reload restores the full set.

Do not wait for the serial mutation queue to drain before advancing.

---

## I. Question readiness / initial-capture

Progressive Clarify still uses `HARD_MINIMUM` / `ASK_NOW` from `question-contract.ts`. Remaining count and current question use the **same** effective resolved-state:

`persisted facts + live constraint overlay + locally accepted candidate ids`

A stale server snapshot must not resurrect a question that was already accepted locally, unless persistence failed (error shown) or a later answer legitimately invalidates the fact.

“Not sure” is a captured answer. It must not bounce the same question back.

---

## J. Refine reuses the same semantics

Clarify and Refine share `ClarifyAnswerControl` / `clarifyControlType()`.

If a question is single-select in Clarify, it is single-select in Refine. Same options, same exclusivity, same persistence shape.

Refine has no Continue; in-place multi-select still writes the **whole current array** on each toggle, never a partial option.

---

## K. Maturity test (required before a Work Area is Mature)

Every question:

1. Correct semantic control.
2. Immediate highlight on tap/click.
3. Persistence + reload.
4. Fast-answer race (Q1 → Q2 → Q3 with latency) — no reversion.
5. Clarify → Refine consistency.

Multi-select additionally: multiple values, deselect, Continue, reload.

Numeric/text: chips are not used; field does not remount while typing.

---

## Current-question identity

`currentClarifyCandidate()` skips locally accepted ids. `showing` is never blindly `view.candidates[0]` after an optimistic advance.

Advance exactly once. Do not advance → recompose → revert → advance again.

---

## Error handling

Failed writes set the existing `actionError` / inline destructive copy. Do not silently keep an unsaved advance without that error. Do not revert to an older question without that explanation.
