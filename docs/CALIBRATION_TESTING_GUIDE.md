# Calibration testing guide

Internal guide for Jean-Luc and calibration partners. Use this during structured test sessions before wider release.

> **Reminder:** During calibration testing, do not judge one number alone. Review recognition, questions, facts, assumptions, estimate line items, final pricing, and quote output together.

## Purpose

Calibration testing checks whether Quotr behaves correctly across real project scenarios — not whether a single total “looks about right.”

Each test project should help the team identify:

- Work areas the AI recognises correctly or misses
- Questions that are missing, redundant, or unclear
- Facts/criteria that extract well or fail
- Estimate line items and calculations that need tuning
- Final pricing behaviour after review and edits
- Quote descriptions that read well for clients
- Rates and defaults that need adjustment

This is **structured review**, not a full admin calibration platform. Findings are recorded in test templates and prioritised for later sprints.

## Before you start

1. Ensure your organisation has the work areas you plan to test **enabled** in setup.
2. Enter realistic starter rates (or your best current guesses) — calibration will expose rate gaps too.
3. Open [`CALIBRATION_TEST_TEMPLATE.md`](./CALIBRATION_TEST_TEMPLATE.md) and copy one template per test project.
4. Optionally use a **Calibration / testing note** on the project (Site notes → note type) for session comments. These notes are internal only and are **not** sent to AI analysis or shown on client quotes.

See also: [`DEMO_WORKFLOW.md`](./DEMO_WORKFLOW.md) for the standard end-to-end flow and [`WORK_AREA_COVERAGE_MATRIX.md`](./WORK_AREA_COVERAGE_MATRIX.md) for what is built vs still to test.

## How to run a test project

### 1. Set up the test

- Give the project a clear **test name** (e.g. `CAL-03 Kitchen + demolition`).
- Paste a **realistic brief** — the kind you would receive from a client or estimator, with dimensions, materials, access, and timeline where relevant.
- Record the brief in your test template.

### 2. Run the workflow

Follow the normal Quotr path:

1. **Create project** — title, client, site, brief.
2. **Site notes** (optional) — add measurements or constraints if the scenario includes them.
3. **Analyse job** — AI suggests work areas and extracts facts from the brief (+ site notes).
4. **Work areas** — confirm, exclude, or add missing areas manually.
5. **Questions** — answer scope questions; note anything missing or confusing.
6. **Scope review** — read assumptions and missing-info warnings.
7. **Quick estimate** — generate and review line items, totals, assumptions.
8. **Final pricing** — prepare from estimate; edit if you would in real use.
9. **Review checklist** — mark pricing reviewed when satisfied for the test.
10. **Quote** — create quote; review client-facing scope descriptions and terms.
11. **Print / PDF** — optional sanity check on export layout.

Do **not** skip steps to “get to the number.” Each step is part of what you are calibrating.

### 3. Record findings

Fill in [`CALIBRATION_TEST_TEMPLATE.md`](./CALIBRATION_TEST_TEMPLATE.md) while the project is fresh. One template per test project.

### 4. Decide pass / partial / fail

- **Pass** — acceptable for this work-area mix; only P2/P3 polish needed.
- **Partial** — usable with manual fixes (add work area, edit pricing, tweak description); P1 items logged.
- **Fail** — wrong scope, unusable estimate/pricing, or missing capability blocks the scenario; P0 logged.

## What to record

| Area | What to capture |
|------|-----------------|
| Brief | Exact text used |
| Work areas | Expected vs AI-suggested vs what you confirmed |
| Questions | Which appeared; which should have appeared |
| Facts | Correct extractions; wrong/missing keys and values |
| Estimate | Total, major line items, assumptions, missing-info messages |
| Final pricing | Sell totals vs your expected range; manual edits required |
| Quote | Scope wording per work area; assumptions/exclusions page |
| AI | Confidence, rationale if visible, false positives/negatives |
| Fix | One clear “required fix” statement + priority |

## How to judge AI recognition

AI recognition is **correct** when:

- Every distinct trade/scope in the brief maps to an appropriate **enabled** work area (or you consciously merge scopes, e.g. demolition within deck).
- Clearly implied scopes are not silently dropped (e.g. “remove existing deck” → demolition or deck with demolition fact).
- Few or no **false positives** (work areas with no support in the brief).

Flag as **recognition failure** when:

- A major scope is missing and had to be added manually.
- Wrong work area type was suggested (e.g. fence vs retaining wall).
- AI merged or split scopes in a way that breaks estimating downstream.

Note: AI only suggests types **enabled for your organisation**. If a type is disabled, recognition cannot suggest it — that is setup, not AI failure.

## How to judge questions

Questions are **good** when:

- They ask for facts needed to estimate (area, length, material, access, inclusions).
- Wording is clear to a builder/estimator.
- Pre-filled AI answers are mostly correct; you only adjust a few.

Flag when:

- Critical facts have **no question** (you had to guess or edit facts elsewhere).
- Questions are redundant or confusing.
- “Not sure” is the only honest answer because options don’t fit the brief.

Work areas without question templates (see coverage matrix) will rely on brief extraction and manual fact entry — record that gap explicitly.

## How to judge estimates

Review the **whole estimate**, not only the bottom total:

- Line items match confirmed scope (labour, materials, allowances, demolition, etc.).
- Quantities and units look reasonable for the brief.
- Assumptions and missing-info messages are acceptable or explain gaps.
- Rate sources (your rates vs benchmarks vs fallbacks) match expectations.

Compare to your **experience-based range**, not a spreadsheet gold standard unless you have one. Record “directionally low/high” and **which line items** drive the gap.

Work areas with **calculator** support should produce structured line items. **Rough allowance** types may be simpler — judge whether the allowance level is useful for internal pricing, not whether every nail is modelled.

## How to judge final pricing

Final pricing should:

- Map estimate line items to sell-side items sensibly.
- Respect your margin/markup settings unless you intentionally override.
- Allow practical edits (labels, sell prices, grouping) without breaking the quote.

Flag when:

- Recalibration after scope change behaves unexpectedly.
- Items are unassigned or grouped illogically.
- Sell total is unusable without rebuilding from scratch.

Record your **expected pricing range** as a band (e.g. “$45k–$55k ex GST”) from experience, not from Quotr.

## How to judge quote descriptions

Client-facing scope text should:

- Describe what is included in plain language.
- Reflect key facts (size, material, inclusions) when known.
- Avoid internal jargon (rates, margins, productivity).
- Align with final pricing line items — no major scope on the quote that isn’t priced, and vice versa.

Flag generic or empty descriptions (common for work areas with only template fallbacks). Note exact wording you would prefer.

## How to prioritise fixes

Use consistent priorities across all tests:

| Priority | Meaning | Examples |
|----------|---------|----------|
| **P0 — blocking** | Cannot trust output for this scenario | Wrong work area with no manual path; estimate $0 or nonsense; quote shows internal costs |
| **P1 — important** | Usable only with heavy manual correction | Missing questions for key facts; estimate consistently 30%+ off; description misleading |
| **P2 — improvement** | Acceptable for pilot with tweaks | Wording; minor fact extraction; rate tuning |
| **P3 — later** | Nice to have | Extra questions; richer descriptions; non-critical work areas |

After a session, sort all **P0** and **P1** items into a single backlog. Batch fixes by work area or theme (e.g. “fence questions + facts”) rather than one-off edits per project.

## Suggested meeting rhythm

1. **Pre-meeting** — agree 5–10 test briefs covering different work-area mixes; assign who runs each project.
2. **Live session** — run 2–3 projects together on screen; fill templates in real time.
3. **Async** — partners complete remaining tests within a week.
4. **Review** — 30-minute sync: tally pass/partial/fail by work area; agree top 5 P0/P1 fixes.
5. **Do not** change formulas, prompts, or calculators during the meeting — log fixes for development sprints.

## Reporting issues

Use **Report issue** in the app sidebar for bugs with URL. Attach completed test templates for calibration findings (email or shared doc).
