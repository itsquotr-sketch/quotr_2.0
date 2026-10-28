# V3 product checkpoint — 29 October 2026

Hosted journeys ran on the integrated Preview. This is not a Production release. No overall pass score is used.

## Environment

| Item | Value |
| --- | --- |
| Branch | `estimating/v3` |
| HEAD under test | `434f214a2cbfeebb5da0f433f91e1dd96c65e47d` |
| Ready Preview | `dpl_3U2Xub2b4WD9Ni8XmbjxtayWeE78` |
| Preview URL | https://quotr-2-0-git-estimating-v3-quotr1.vercel.app |
| Preview database | Supabase host classified as preview, not production |
| Session | Isolated organisation “Stage 3C isolated”. No customer, site, quote, GST decision, or Checkout |
| Production | Not deployed. The earlier Production deployment was left in place |

There were no newer commits on this branch to preserve. Other worktrees were not merged.

Viewport checks used Chrome device metrics in the IDE browser: 1440×900 and 390×844. That is simulation, not a physical phone or a resized desktop window. No physical device was tested. The 390×844 layout reflowed (collapsed navigation, stacked pricing cards, no horizontal overflow on the office pricing page). Screenshots of that simulation show the narrow page inside the wider IDE pane.

## Follow-up on this checkpoint

The hosted journeys above were run on `434f214a`. They are not restated as a pass. Pricing additions, edits, removals, manual-edit preservation, and saved-snapshot protection were not exercised.

Three later commits are on `estimating/v3`:

| Commit | What it changes |
| --- | --- |
| `09be34fc` | Missing-price lines, affected work areas, unresolved specifications, and scope-coverage gaps stay separate. Nine lines are not labelled as one missing price. A group and its own line are not both counted. |
| `de30f3b3` | Leave until inspection and explicit retention do not price a new pile set. A confirmed new support layout still prices. Explicit replacement keeps the stated supports and keeps the allowance as an unresolved costing defect, not a complete price. |
| `886b2730` | “Needs preparation” keeps straight-lay carpet tiles and floor preparation as two unpriced gaps. Removal of the existing floor is not a ready substrate. |

The Ready deployment id is recorded only after the serving SHA is checked. Production is unchanged.

Local checks for these commits:

- `verify-ux-01c-estimate-overview.ts` passed.
- `verify-ux-01b-workflow-strip.ts` passed except check 13, which already fails because the quote page does not contain `quoteItems={data.items}`.
- `verify-ux-01d-work-area-breakdown.ts` passed except check 7. That check also fails on `434f214a` because `WorkAreaBreakdown.tsx` already imports `useEffect`.
- `verify-estimating-v3-stage-2c.ts` and `verify-estimating-v3-stage-2d.ts` passed, including pending inspection, explicit retention, explicit replacement, and a mixed retained-plus-confirmed-layout case.
- `verify-estimating-v3-stage-3d.ts` passed, including the two preparation gaps through the pricing adapter.
- `npm run build:safe` panics because `node_modules` is a junction. That is the baseline Turbopack error. The webpack compile is the Preview-safe build.

### Conditional piles

Before: Leave until inspection priced new pile material, installation, and holes, and said replacement was not assumed. The allowance line was absent on that path.

After: those three lines are not priced from a spacing layout or from the replacement count. New framing stays. Explicit retention does the same and does not add the allowance. A confirmed bearer layout still prices new supports and says the retained piles are not that layout. Explicit replacement prices the stated supports and still adds the allowance. The allowance does not name work outside material, installation, excavation, concrete, or removal, so the result is not a complete price.

### Office flooring boundary

Selecting “Needs preparation” did not keep the carpet-tile recipe and add an unpriced preparation line. It replaced the finish with one specialist line. The brief’s completed flooring removal does not establish a ready substrate. Finish and preparation are now both explicit unpriced gaps. No preparation rate is invented.

### Still open, not changed in this pass

- Bathroom tasks and customer-supply responsibilities missing from the work card.
- Lining and painting requested without a priced or explicitly unpriced line.
- Six door sets associated with one wall opening.
- Typical-setup footing copy, and the Low-level chip beside elevated labour.
- Modifier text omitted from pile and hole formulas.
- Floating-point area headings.
- Waste wording that disagrees with the selected pricing path.
- `verify-ux-01d` check 7 and the Turbopack junction panic.

## Scope-coverage slice accepted

Accepted on `estimating/v3`. This is not a Production release. No new recipe, P&G model, calibration, domain change, or Production deployment is included.

The estimate behavior under test is `129734bcf496562ec1636b92a1dda5b5a0563a24` (`687829c9` asks for a lining product when included faces are still unspecified; `129734bc` keeps the next wall question on the estimate page). Preview deployment of that behavior: `dpl_HHQ21Su4VK6NokKiLoC4RzE9bR8Q`. The guarded webpack build of that commit exited 0 (compiled, TypeScript, 50 static pages). `npm run build:safe` still panics on the `node_modules` junction.

The acceptance record is `108ed8b8c34561727ecaeb3f089a5b9948581f17`. Preview served that commit as `dpl_2QsmGmMxAGzzZfe8h4QsoKvmZzbZ` (Ready, alias https://quotr-2-0-git-estimating-v3-quotr1.vercel.app). That deployment changes this note only.

Included lining with no product now asks for Side A. When the same lining is already on both sides, that one answer is copied to Side B. Side B is asked only when the faces are not the same. Supported choices stay the existing list. Other, plywood, and fibre cement stay explicit gaps. Plasterboard is not assumed.

Hosted checks on the isolated Stage 3C organisation:

- Office job `1ae69339-1e47-4d09-8a77-a8a652edabc6`: one Standard GIB answer, save and reload, regenerate. Materials has one 13 mm Standard GIB line for both faces (44 sheets, 129.6 m²). The unspecified Side A and Side B lining rows are not active costs. Skirting stays 45 lm. Six door sets stay separate. Preparation stays unpriced. The reviewed carpet-tile supply stays $6,930 and the manual allowance stays $15.
- Partition `4eb889e9-603d-48aa-8af1-33e9e7ead412`: both faces are Standard GIB (28.8 m² gross, one line) and Level 4 stopping is 12.8 m² on each face. One hollow-core door set is a separate assembly. Opening size 0.81 × 1.98 m and Level 4 were session answers; the brief says a standard door and stopping ready for painting, not those figures. Electrical and painting are not priced. Opening labour remains Pricing Required.
- Paraphrase `7390f622-5f5a-4a3f-aaf1-50d3d814d12f` uses “new partition walls” and “line both sides”, not the original office sentence. Details asks “What lining is on Side A?”. One Standard GIB answer is stored on both sides. Desktop 1440×900 and mobile 390×844 show that question without horizontal overflow. The mobile assistant button overlaps the right edge of the choices.
- Retention `7a6fe263-70d9-460c-953c-4db01d2d41bc`: Assume retained. Materials have no pile, excavation, or concrete cost. The assumption says existing piles are retained as a scope decision, not structural proof, and that new support material, installation, excavation, and concrete are not included. A supports schedule still shows an unpriced 12-pile layout note.
- Replacement `719b6c47-71da-4c85-80dd-c154b809a7bc`: Assume replaced. The count stayed required. The session entered 8; the brief does not state a count. The estimate uses that stated 8 and does not use the 12-post spacing layout. The pile/post replacement allowance is $1,440 and says its coverage is unresolved, so this is not a complete price. Known sell $10,152 is labelled not the complete price. Spoil disposal stays Pricing Required.

Pending inspection `b1a1263e-73ec-4016-b0ed-4a3421ddc767` is unchanged by the lining fix and is not re-run. Issued-snapshot protection stays the local `scripts/verify-pricing-draft-reconciliation.ts` fixture. No quote was sent.

Explicitly deferred: bathroom card visibility; typical-setup footing copy; Low-level chip beside elevated labour; modifier text on pile and hole formulas; floating-point area headings; waste wording versus the pricing path; `verify-ux-01d` check 7; `verify-ux-01b` check 13; the Turbopack junction panic; preparation with no recipe and no price; insulation labour Pricing Required; skirting painting with no rate; the work-area “All priced” chip beside an Incomplete overview. `get-quotr.com` remains marketing HTML. The app stays on `app.get-quotr.com`. Production deployment `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` is unchanged.

## Original briefs

Test answers below were supplied in the session. They are not facts extracted from the brief unless the note says the brief stated them. Company carpenter cost on this organisation was already $75/h. Laminate underlay $8/m² and laminate waste $40/m² were already company rates. No new benchmark was invented.

### Internal partition

https://quotr-2-0-git-estimating-v3-quotr1.vercel.app/app/projects/11309945-4413-44d7-b5b2-ebd876ee080e

**Worked.** 6 m × 2.4 m timber partition, both faces, insulation, and one door set stayed separate. Painting, skirting, and electrical remained exclusions. Opening net face 12.80 m². Door set priced at company labour and Quotr benchmarks: cost $520.00, sell $650.01. Reload kept the unpriced opening-labour line, the door money, and the locked quote. “Go to the first unresolved Work Area” opened the opening-labour line. Create quote and Mark as reviewed stayed disabled.

**Clarification, recorded as test answers.** Framing 90×45. Opening 0.81 m × 1.98 m. Thermal insulation. Cornice no. Stopping level 4 on Side A and Side B, as a mapping of “ready for painting”; the brief does not name a level. Hollow-core leaf, 810 mm wide, 1980 mm high left as the default assumption. Access Easy, carry under 10 m, occupied no, working hours no.

**Priced.** Walls materials and framing, lining, insulation, and stopping labour that had rates. Doors leaf, latch, and both install lines. Known cost $3,148.33. Recommended sell $3,935.44 for priced work.

**Unpriced.** Opening labour. No owner hours were entered.

**Defects.** A. Overview said “2 Work Areas · All priced” while the work area and Pricing showed one Pricing Required line. C. “Add door set” showed “Adding…” during an unrelated save. The wall note “Door leaf / hardware: Not included” sits beside a priced door set. Dashboard “Pricing in draft” hides the missing price.

### Low deck

https://quotr-2-0-git-estimating-v3-quotr1.vercel.app/app/projects/5b5db1af-08eb-44a3-921e-3df1bdace4a5

**Worked.** Area 17.28 m². Board supply 211.2 lm is the 192 lm install quantity plus 10%. Substructure, fixings, and post-hole labour priced. No pile-replacement allowance. Pricing was not opened.

**Clarification.** Fascia, full-height skirting, and concrete footings not included. Post count 6, a required test count; the 1.8 m layout of 12 was disclosed and not used. Ordinary soil, hand digging, spoil remains on site. Decking material Not Sure. Access Easy, carry under 10 m.

**Priced.** Decking, substructure, six posts, hole excavation, and the elevated labour allowance. Known cost $5,626. Recommended sell $7,032. Margin 20%.

**Unpriced.** None on the estimate. Concrete material was absent, which matches footings not included. Hole excavation labour was still priced.

**Defects.** C. The analysis chip said Low-level while 450 mm still added elevated extra labour, which is the over-300 mm rule. “Use typical setup” still said full concrete fill after footings were excluded. D. The stated 5 mm board gap is not in the coverage width. Pricing add, change, remove, and snapshot protection were not exercised.

### Elevated replacement deck

https://quotr-2-0-git-estimating-v3-quotr1.vercel.app/app/projects/1bba9080-2602-4435-82fe-66769ab06064

**Worked.** 16.12 m², hardwood, removal, fascia 16.6 m, and one step stayed in scope. Balustrade stayed excluded. Spoil destination stayed Pricing Required. Access Difficult +10% and carry 10–30 m +5% were visible. Most labour formulas showed the composed +15%.

**Clarification.** Leave until inspection, matching the brief. Post count 8, a test count; the layout of 12 was not used. Ordinary soil, hand digging, spoil Not Sure. Board width Not Sure, which resolved to 140 mm. Step size used the Quotr assumption. Fascia used the full rectangular perimeter. Skirting and concrete footings not included. Carry 10–30 m was already selected from the brief distance; it was not a separate click in this pass.

**Priced.** New decking, framing, fascia, step, removal, eight new piles, pile installation, and hole excavation. Known cost $6,682. Known sell $8,352, labelled as priced work only.

**Unpriced.** Post-hole spoil destination.

**Defects.** A. The assumption says existing piles are not assumed replaced or kept, while the estimate prices a full new pile set. The separate pile-replacement allowance line was not emitted. C. Pile and hole formulas include the 15% in the hours and omit it from the formula text. Typical-setup copy said full concrete fill after footings were excluded. Dashboard “Ready to price” hides the missing spoil price. Regeneration was read as copy and not clicked on this job.

### Laminate

https://quotr-2-0-git-estimating-v3-quotr1.vercel.app/app/projects/4a94c03a-0a75-427e-9e4e-60c8e1feaf26

**Worked.** 30 m² matched 6 m × 5 m. Skirting stayed excluded. Underlay 30 m² × $8 and extra waste 3 m² × $40 used existing company rates. Pricing recovery opened the unpriced click-lock package. Quote and review stayed locked. No package rate was entered.

**Clarification.** Floating click-lock, confirmed as an assumption. Location “Not sure”, which became the room name. Access Easy, carry under 10 m after Not Sure failed to resolve the question, occupied no, working hours no. Moisture control excluded. Combined supply-and-install package. Underlay charged separately. Waste charged as the extra quantity only.

**Priced.** Underlay and extra waste. Known cost $360. Known sell $450.

**Unpriced.** The 30 m² click-lock package. No laminate benchmark exists, and none was invented.

**Defects.** B. The package stays Pricing Required until a company rate exists. C. The work-area sentence says waste is included in the supply quantity, while Pricing says the extra 3 m² is separate and the package stays the net area. “Not sure” was stored as the room name. D. Carry Not Sure does not satisfy the distance question.

### Office fitout

https://quotr-2-0-git-estimating-v3-quotr1.vercel.app/app/projects/82ad80f2-eec5-4c34-b48d-5eaded2dbd2b

**Worked.** 24 m × 2.7 m partition, six hollow-core door sets, and 120 m² carpet tiles stayed separate. Stated skirting 45 lm was priced; the derived 46.38 lm was disclosed and did not replace it. Door cost $3,322.50 reconciles to 6 × ($240 + $55) plus 20.70 h at $75. Pricing said “3 lines still need prices”, and quote and review stayed disabled. Recovery opened Internal walls on the opening-labour line.

**Clarification.** Timber framing and 90×45 were test answers; the brief does not state timber. One lining layer. One door opening, 0.81 m × 1.98 m, mapped from the door-set test size; the product did not ask for an opening count. Skirting both sides. Cornice no. Hollow core, 810 mm, hardware included, height left at the 1980 mm default. Straight lay, confirmed as an assumption. Substrate “Needs preparation”, because the product says “already removed” is not a ready answer. Access Moderate. Carry under 10 m. Occupied, protection, and working hours were shown as Yes without a separate click; treat those as product inferences from the brief, not as typed test answers.

**Priced.** Wall timber, fixings, one opening’s framing, acoustic insulation material, skirting, framing labour, and skirting labour. Six door sets. Known cost $9,842.98. Client sell $12,303.89 for priced lines only. Flooring sell stayed Pricing Required.

**Unpriced.** Opening labour. Acoustic insulation labour. The whole carpet-tile area, as one specialist line. Painting is in the scope sentence and has no cost line.

**Unsupported and not carried onto the estimate.** Analysis listed site establishment, daily cleaning, final cleaning, supervision, unconfirmed duration, and goods-lift access, plus excluded structural, plumbing, fire, and electrical work. Protection of common areas and deliveries were in the brief and were absent from that sentence. The estimate assumptions list did not repeat the preliminaries.

**Defects.** A. Overview said one item needs a price, the work-area header said requiring prices 2, and Pricing said 3 lines. The wall opening quantity matches one opening, not six door sets. “Add a lining product for this face” is a review note; two lined faces have no lining line. B. Carpet tiles on this multi-trade path did not enter the carpet-tile recipe. C. The job badge said Estimate ready while Pricing said Needs attention.

### Three-room flooring

https://quotr-2-0-git-estimating-v3-quotr1.vercel.app/app/projects/c8db9871-e8c8-41c5-8c5b-880920ede3b5

**Worked.** Bedroom 1, Bedroom 2, and the hallway stayed separate. Removal and carpet underlay priced at $75/h and the $15/m² benchmark. Vinyl supply quantity 10.56 m² is 9.6 × 1.10. Skirting replacement and major subfloor repairs stayed excluded. Labour formulas named the room. A condition change to Difficult marked the estimate previous and required Regenerate; hours did not change until that click. Restoring Easy and regenerating returned the 2.39 h estimate.

**Clarification.** Existing substrate removal no, new substrate no, hallway preparation no. Separate finish supply and installation. Access Easy and carry under 10 m. Occupied and working hours may have been set by a broad No click; they were not extracted from the brief. Waste extra-only was not still on screen after the pricing choice; the estimate still discloses 10%.

**Priced.** Three removal lines and two carpet underlay lines. Known cost $573. Known sell $716. Labour $179 after display rounding.

**Unpriced, still separate.** Each room’s finish installation. Each carpet room’s accessories and roll purchasing. Hallway vinyl supply and vinyl adhesive. Transitions requested and unpriced.

**Defects.** A/C. The work-area button said Pricing Required 9, the header said Requiring prices 1, and the overview said 1 needs a price. C. Area headings showed `11.520000000000001 m²` and `14.700000000000001 m²`. Dashboard “Ready to price” hides the gap. D. Carpet roll purchasing is not derived from 10% waste, and no carpet square-metre rate was invented.

### Conflicting area

https://quotr-2-0-git-estimating-v3-quotr1.vercel.app/app/projects/bc9be575-84fe-4043-b8f3-670a91552eb9

**Worked.** Analysis showed 5 × 4 m measures 20 m² and the stated area is 32 m². Neither Direct Area nor Length And Width was selected. Create estimate stayed absent. Dashboard said Specification / Confirm work areas, which matches the blocked state.

**Clarification.** The area choice was left unanswered on purpose.

**Priced.** Nothing. No estimate was created.

**Defects.** D. The conflict stays unresolved until one area is chosen. That is the designed gate.

### Bathroom

https://quotr-2-0-git-estimating-v3-quotr1.vercel.app/app/projects/d74704e5-7e4a-4536-b749-cc2f24821af7

**Worked.** The brief remained stored in full, including vanity, shower, toilet, tiles, paint, customer supply, and the plumber and sparky exclusion. The work card showed a 2.4 × 2.1 m bathroom, height 2.4 m, 5.04 m², demolition included, and waterproofing still to confirm. No estimate was forced.

**Clarification.** Waterproofing was not answered. The brief does not specify it.

**Priced.** Nothing.

**Unsupported.** Vanity, shower, toilet, tiling, painting, damaged gib, customer-supplied fittings, stair protection, and daily cleaning were not listed on the work card.

**Defects.** A. Unsupported bathroom scope stayed in the brief and did not stay visible as work-area scope. B. There is still no bathroom recipe, and this checkpoint does not add one.

## Checks that were not completed

Pricing additions, edits, removals, and saved-snapshot protection were not exercised. No manual price was typed. No quote was created. Condition regeneration was exercised on the three-room job only. Reload after leaving the page was exercised on the partition. The pile-replacement allowance’s documented double-emit path was not re-triggered; Leave Until Inspection did not emit that allowance line.

## Next three slices

1. **Pile replacement when inspection is still open.** Pending piles plus a new substructure price a full new set while the copy says replacement is not assumed. The documented allowance can also be emitted beside new piles. Resolve that before any deck price is treated as complete. Do not delete the allowance in passing.
2. **Wall quantities the brief already stated.** Six door sets became one opening. Lining both sides became a review note instead of a line. A stated lining and a stated opening count have to survive as quantities or as visible unpriced lines.
3. **Flooring commercial lines that are still the job.** Carpet tiles on a mixed office brief collapsed to one specialist line. Carpet rolls, vinyl supply, accessories, install productivity, and the laminate click-lock package stay unpriced, which is correct when no rate exists, and the known sell must not read as the finished job. Keep the rates uninvented.

Dashboard “Ready to price” and the estimate badge “Ready”, while Pricing says Needs attention, should move with slice 3. They are presentation, and they hide the same gap.
