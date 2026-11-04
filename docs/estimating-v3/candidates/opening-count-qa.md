# Opening-count QA results

- Tested SHA: `1288d9ee387207fa4f4bdfa7daa26199360d8efd`
- Baseline SHA: `01e4b508c062dbee0bd46c12b763d77996308122`
- Checkout: `C:\Users\Admin\Desktop\quotr-v3-opening-count-qa`, detached at that SHA. No tracked application file was edited.
- Candidate Preview: `dpl_GEhr682QSyVy5t6rFrai9WiPs3ML`, Ready, `estimating/v3-opening-count`, same SHA.
- Focused command: `npx --yes tsx scripts/verify-estimating-v3-stage-2a.ts` — 46 passed, 0 failed.
- Independent check: `qa-evidence/opening-count/independent-opening-count.ts` in that checkout. No project, estimate, or pricing row was persisted.

## Outcome

Focused deterministic acceptance passed. Hosted persistence and reload stayed blocked: no Preview test organisation was authorised for that run, and the browser had no Quotr session. This approval is not a hosted smoke result.

## Frozen criteria

1. Six stated door openings stay six unsized openings, with no invented 810×1980 size. **PASS**
2. Unsized openings add no opening price and ask for width and height. **PASS**
3. Applying the same brief again stays at six and keeps the first opening id. **PASS**
4. One saved door opening is not expanded to the later stated count. **PASS**
5. “Six door sets” stays door work and creates no wall opening. **PASS**
6. One stated door opening still stores one opening. **PASS**
7. No schema, rate, credential, or Production change. Saved opening rows are not rewritten. **PASS**

## Corrected timber expectation

One explicit size, 0.92 m × 2.10 m, was written on the first of the six openings. It is a test answer, not extraction.

- Expected raw timber: 2 × 2.4 + 0.92 = 5.72 lm. Two trimmers use the 2.4 m wall height. The header is the stated 0.92 m width. Cripples are 0.
- The handoff originally said 5.61 lm. That figure used an unstated 810 mm header: 2 × 2.4 + 0.81 = 5.61. It is not the expectation.
- Actual raw timber: 5.72 lm, one emission for opening `d21035fd-1580-44ac-ac5d-165fefb41a39`.
- Purchase quantity: 6.29 lm. Null wastage settings use the existing 10% timber fallback, and round2(5.72 × 1.10) = 6.29.
- The other five openings stayed ineligible and unresolved. One overlap group. Lining deduction 1.932 m² once per lined face. Gross face 10.08 m². Net face 8.148 m². Opening labour for the sized opening stayed an unpriced owner-rate line.

**PASS** against the corrected expectation.

## Hosted persistence and reload

**BLOCKED.** The Preview SHA matched, so the alias was eligible, and no hosted product check was run. Organisation `9cfc28ea-8eb6-4d81-85b1-3ff7327506ca` was not reused. No password, rate, quote, or Pricing review was changed.

## Unrelated

Unsized timber still asks for a timber size rate. The lining specification string rounds the deduction and net to 1.93 m² and 8.15 m² while the takeoff fields stay 1.932 m² and 8.148 m². Brief B door height uses the disclosed 1980 mm default; door width stayed empty. None of these was scored as an opening-count defect.
