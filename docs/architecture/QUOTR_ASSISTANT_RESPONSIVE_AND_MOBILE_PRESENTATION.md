# Quotr Assistant — Responsive and Mobile Presentation Architecture

**Status:** Documented (implementation of native app — Not Started)  
**Date:** 2026-08-07  
**Related batch:** Stage 3.1B.7G  
**Boundary:** Presentation only — same Facts, scope decisions, and estimate
view-models drive every surface.

---

## Principle

Do **not** implement a separate mobile business logic layer.

Desktop web, mobile web, and a future native app must render different
**presentations** of one project state:

- Project brief + notes  
- Work Areas and scope decisions  
- Facts and constraints  
- Estimate / pricing / quote view-models (authoritative server values)  

Commercial arithmetic, Scope Discovery, and Fact authority remain shared.

---

## Desktop (web)

| Region | Job |
| --- | --- |
| Left Stepper | Where am I? (progress + short counts) |
| Centre workflow | What do I review or change? |
| Right Quick Estimate | What does this mean commercially? |

Quick Estimate uses a **sticky** right rail from `lg` (1024px) upward
(`position: sticky`, header offset, column containment). No JS scroll tracking.

Completed stages compress to one–two line outcomes; expand for full detail.

---

## Mobile web / future app

| Surface | Job |
| --- | --- |
| Compact stage progress | Orientation (stepper-like, not three columns) |
| Active stage | Primary working view |
| Quick Estimate compact summary | Sell · confidence · open full estimate |
| Full estimate | Dedicated sheet / screen (web: expand accordion for now) |
| Completed stages | Via project / stage navigator |

Current web implementation (3.1B.7G / 3.1B.7F-R2):

- Below `lg`: compact summary accordion (`buildQuickEstimateMobileSummary`)  
- No sticky rail  
- No complex app navigation shell in this batch  

### Mobile project header (3.1B.7F-R2)

Desktop and mobile intentionally differ.

At `sm` and below, the project workspace header shows approximately:

- Back (Dashboard)
- Project name (wraps safely)
- Actions (project menu / user control)

Do **not** permanently display full desktop metadata on mobile:

- client name
- full address
- lead / business-status / priority chrome (desktop-only)
- due date row
- long subtitle

Those remain available via Edit project, Actions, or project information views.
Desktop (`sm+`) retains the richer metadata row.

Header chrome must stay mutually exclusive (one responsive presentation), keep
tap targets usable, and leave the Assistant stage reachable without excessive
vertical consumption.

Future native / PWA may bind the same view-model to a bottom sheet without
recomputing money.

---

## Shared presentation contracts

| Module | Role |
| --- | --- |
| `lib/assistant/presentation/quick-estimate-view-model.ts` | Status + mobile summary strings |
| `lib/assistant/stage-completion-summaries.ts` | Centre / stepper compact labels |
| `lib/estimate/financial-view-model.ts` | Authoritative money display labels |
| Estimate / Scope Review server DTOs | Source of truth |

UI must not invent totals, confidence, or Facts.

---

## Explicit non-goals (this document)

- Native app implementation  
- Separate mobile API  
- Production Scope Discovery enablement  
- Company DNA / Builder Interview  

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/architecture/QUOTR_ASSISTANT_RESPONSIVE_AND_MOBILE_PRESENTATION.md` |
| Created | 2026-08-07 |
