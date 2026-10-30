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

## Cost-integrity and status follow-up closed

Closed on the behavior in `8c52b93b891d7aa3c696cc385c1df58a4d151fbb`. Preview deployment `dpl_H2x2zG4pwmBA7NXf5AZbzNw4Miux` (Ready, alias https://quotr-2-0-git-estimating-v3-quotr1.vercel.app). This note does not change that behavior. Production deployment `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` is unchanged. No quote was sent.

When replacement is requested and support material, installation, or excavation is already its own line, the $1,440 pile/post replacement allowance stays out of the total. It remains a Pricing line the user can fill. A saved rate is not applied automatically. When that allowance is the only replacement money, the existing priced allowance stays. A spacing layout is not a confirmed pile count. Fresh job `3f349cff-8f28-4483-ab37-a29ca273c0b4` was regenerated on this behavior: known cost $6,024.54, known sell $7,530.20, three lines still need prices, and the allowance is not in that total.

Where generated lines have prices and scope is still open, Overview, the work-area chip, the dashboard, and Pricing say “Generated lines priced” and do not call the job complete. Missing prices still take priority over that label. At 390×844 the Preview feedback control no longer covers the last assistant choice: the scroll pane keeps 3.25rem of clear space while that control is present.

Explicitly deferred: typical-setup footing copy; Low-level chip beside elevated labour; modifier text on pile and hole formulas; floating-point area headings; waste wording versus the pricing path; `verify-ux-01d` check 7; `verify-ux-01b` check 13; the Turbopack junction panic; preparation with no recipe and no price; insulation labour Pricing Required; skirting painting with no rate; the work-area “All priced” chip beside an Incomplete overview. `get-quotr.com` remains marketing HTML. The app stays on `app.get-quotr.com`. Production deployment `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` is unchanged.

## Bathroom scope preservation

Accepted for the bounded partial result on behavior `6b43ee349cd16541041371b3e8fae466e2e36151`. Preview deployment `dpl_ATkr5RuB2vMnirQQBc8zZPWHm4bQ` was Ready with no production target on https://quotr-2-0-git-estimating-v3-quotr1.vercel.app when this record was written. Production deployment `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` (SHA `bc0a76674229`) is unchanged. No quote was sent and no pricing was marked reviewed. This does not add a bathroom recipe, a preliminary-and-general allowance, or a calibration change. The whole bathroom assembly is not fully supported.

The priced lines below are the existing calculator. Open tile format, repair extent and waterproofing are not confirmed inputs and do not receive a new rate. Company carpenter cost on this organisation is $75/h. Margin is 20%, so sell is cost × 1.25. Displayed overview totals use whole dollars; the draft keeps cents.

Original brief, job `7c2c4d32-01a8-4704-97d1-028071412fbb`. Plan 2.4 × 2.1 m is 5.04 m² of floor and of ceiling. Gross walls are 21.6 m². Wall tile extent is none, so paintable area is 26.64 m². Site access Easy and carry under 10 m were session answers and add nothing. Occupied upstairs adds 5% to demolition labour hours only. The assumption states that vanity installation, floor tiling, painting and the disposal allowance are not adjusted, and that stair protection and daily cleaning are separate requested tasks outside that 5%.

- Vanity installation: builder install, 1 × 4 h × $75. Cost $300, sell $375. The customer supplies the vanity. The occupied factor is not applied. The line notes the 900 mm specification.
- Floor tiler installation: 5.04 m² × $95/m² (`bathroom.tile.install.m2`), net area, no waste. Cost $478.80, sell $598.50. Tile format is open and is used only for an approximate count, which is not priced. Substrate, repair extent and waterproofing do not change this line.
- Floor tile supply allowance: customer-supplied, not in the total, cost $0.
- Painting: 26.64 m² × $30/m² (`bathroom.painting.m2`). Cost $799.20, sell $999. It depends on wall tile extent. Tile format, substrate, repair extent and waterproofing do not change it.
- Removals use carpenter $75/h after the 1.05 occupied factor: floor finish 1.32 h, cost $99, sell $123.75; vanity 0.35 h, cost $26.25, sell $32.81; toilet 0.18 h, cost $13.50, sell $16.88; shower 1.58 h, cost $118.50, sell $148.13.
- Bathroom disposal: strip-out score 5, standard $650 lump. Existing Quotr allowance, not a density model, and not occupied-adjusted. Sell $812.50.

Included cost $2,485.25. Included sell $3,106.57. The overview shows known sell $3,107 and known cost $2,485. The four coverage rows are outside that total. There is no waterproofing, plumbing or electrical charge. Substrate on this job was “Keep existing floor”, so the existing plywood and underlay allowance did not run. “Partial repair, extent unknown” does not price lining. Waterproofing stayed asked, was not assumed, and does not block the partial estimate. An existing assumption still says “Full strip-out and rebuild — component trade allowances applied.” That wording was left as it is.

Mixed supply was hosted as job `6ba794d6-0190-4508-a8ff-63e3f85ff1b8`. The contractor supplies the toilet and shower as existing PC allowances only: toilet $650 cost / $812.50 sell, shower tray/base $750 / $937.50. Installation remains a plumber charge, stated as excluded, with no installation labour line. Customer supply of the vanity keeps the 4 h builder installation. Customer supply of the tiles keeps the tiler installation and leaves the tile purchase out of the total. Ancillary materials stay an unresolved coverage row. Plumbing and electrical charges stay excluded.

On that job, floor substrate was answered Not Sure. That is not a confirmed plywood specification. The existing calculator then allowed 19 mm H3.2 treated plywood (2 × $145, cost $290, sell $362.50, plus 4.85 h at $75, cost $363.75, sell $454.69) and 6 mm Hardie Ceramic Tile Underlay (3 × $42.12, cost $126.36, sell $157.95, plus the same 4.85 h). The underlay note says it is required over 19 mm plywood when the floor finish is tile, with 10% sheet waste. Tile format Not Sure, framing Not Sure, and unanswered waterproofing added no further priced line. Known cost $5,029.11, known sell $6,286.40, labour 17.13 h. Overview stays Incomplete: generated lines are priced, four requested tasks have no line, and four specifications stay open. Desktop reload and a 390×844 reload kept that status, the occupied disclosure, customer-supplied vanity and tiles, and the plumber exclusions. The phone document width stayed 390.

Fresh unsent draft `a3116424-279f-4539-aec0-a8f49cac5339` was created on this behavior. The customer tile row and the four coverage rows stay visible internally as “Not in total” and “Hidden from quote”. They are not free quote items. Mark as reviewed and Create quote stay disabled while scope is unresolved. Hiding a row does not price the task or mark it excluded. Client exclusions still name plumbing and electrical. No quote was created.

Older draft `31d66ec2-d37b-4562-9766-5f9eceba01a0` is still Draft, unsent, cost $2,485.25, sell $3,106.57. It was created before insert-time quote visibility, so its $0 rows remain quote-visible. Explicit reconciliation compares money, quantity and wording, not quote visibility, so it does not hide those rows and no update banner appears while those values still match. Review and quote creation stay blocked. The draft was not rewritten, and no issued snapshot was rewritten. The earlier mixed draft `7e864dee-1c20-4294-82c5-576d4891bbe7` was also left as it was.

Still unpriced, with no rate invented: partial wall-lining extent, stair protection, daily cleaning, and contractor-supplied ancillary materials. `scripts/verify-bathroom-scope-preservation.ts` covers the original, shorthand and mixed assemblies, including quote projection and the visibility-only reconciliation limit. `scripts/verify-pricing-draft-reconciliation.ts` passed. `scripts/verify-estimate-readiness-contract-r1.ts` still fails only the pre-existing “CTA does not stay on Saving… during generate” check. Typecheck passed. The guarded webpack build exited 0 and refused the production database.

## Bathroom substrate and repair costing

Scope preservation stays the accepted slice above. This section is a separate correction. Behavior `bd9855404f4253c3908dd6509d39a3398986cee5`. Preview `dpl_3w784NZ3c9mfpYZgmpZ74PYW9XSz`, target none. Production remains `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` / `bc0a76674229`.

“Not sure” had been treated as a confirmed 19 mm H3.2 plywood replacement whenever the job was not strip-out only. A tile floor then derived 6 mm Hardie Ceramic Tile Underlay. Both layers used the net floor area, 10% sheet waste, and installation labour of net m² × 0.9167 h/m² × the access factor. Plywood is the Quotr benchmark $145 per sheet. Underlay is the Quotr benchmark $42.12 per sheet. The two labour lines are different tasks that share that productivity figure. Equal hours are not one allowance counted twice.

The earlier hosted mixed job that answered substrate “Not sure” included that assembly: known cost $5,029.11, sell $6,286.40, labour 17.13 h. That job and its drafts were not rewritten.

Fresh Preview jobs on the correction:

- Unknown, project `685fa67f-c364-41df-b34a-bac5cc250bca`. Substrate “Not sure”. The review keeps “Floor substrate condition is unknown. A full floor replacement is not assumed. Coverage is unresolved.” No plywood, no Hardie underlay, and no installation labour for either. Known cost $3,885, sell $4,857, labour 7.43 h. Customer tile supply stays out of the total. Vanity installation stays priced. Plumbing and electrical stay excluded. Desktop and a 390×844 reload kept the same totals and the same gap.
- Retained, project `97978b91-baf0-4972-b50e-4a5e74569714`. “Keep existing floor”. No substrate replacement line and no substrate gap. Same known cost $3,885 and sell $4,857.
- Partial repair, project `a6073803-08d5-4865-bb44-b0ea3dc4f5b9`. “Partial repair”. The review keeps “Floor substrate repair extent is not measured. A full floor replacement is not assumed. Coverage is unresolved.” There is no measured-extent recipe, so the gap stays and the full floor is not priced. Same known cost $3,885 and sell $4,857.
- Confirmed replacement, project `96e020b8-fe48-4cca-b5e6-604eff4be103`, regenerated after this correction. “19 mm treated plywood” with a tile floor. 5.04 m² net, 5.54 m² purchase, 2 plywood sheets at $290 and 3 underlay sheets at $126, both Quotr benchmarks. Floor substrate labour and tile underlay labour are separate 4.85 h lines at the company carpenter rate, $364 each. The visible assumption states 0.9167 h/m² from the Quotr benchmark, 4.62 person-hours before access, then access factor 1.05, and that matching hours are not one allowance counted twice. Known cost $5,029, sell $6,286. Customer supply and the plumbing and electrical exclusions stay.

The blanket “Full strip-out and rebuild” assumption is replaced by wording from the selected removals, floor finish, painting and fixtures. There is no existing way to accept a proposed substrate allowance before it is priced, so this correction does not add a universal bathroom default. Unknown and unmeasured partial repair stay visible gaps. A confirmed sheet system still prices. “Other” stays an open specification. This is not a fully supported bathroom assembly.

`scripts/verify-bathroom-substrate-repair.ts` passed, including the builder-visible labour note. Preservation and pricing-draft reconciliation passed. Bathroom physical and polish checks passed apart from the pre-existing migration 110 failure. Readiness still fails only the pre-existing Saving CTA check. Typecheck passed. The guarded webpack build passed on the substrate commit and refused the production database. No quote was sent.

## Quote visibility reconciliation

Closed on behavior `4efc441f53d5bf54838ab7fbaaa0d40149c82aaf`. Verified on Preview `dpl_8yasoGUEMdGtqXT3cgCgGuVTjutu`, target none, alias https://quotr-2-0-git-estimating-v3-quotr1.vercel.app. Production remains `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` / `bc0a76674229`. No quote was sent. Pricing was not marked reviewed.

Explicit Pricing reconciliation now compares whether a generated row should appear on the customer quote. A row is matched by its source line id or requirement scope, not by label, position or amount. A visibility-only difference appears in Preview changes when quantity, wording and the monetary difference are unchanged. Page load does not rewrite the draft.

Older draft `31d66ec2` on project `7c2c4d32` still had the customer tile purchase and four unresolved coverage rows on the quote at $0. Preview changes listed those five rows to update. Current and latest subtotals were both $3,107, difference $0. Each note said the row will be hidden and the task stays unresolved. Priced rows stayed unchanged. After Update final pricing, the same rows remain in Pricing as Not in total and Hidden from quote. Direct cost stays $2,485.25 and client sell stays $3,106.57. Desktop reload and a 390×844 reload kept that result, and Preview changes was not offered again. The customer projection omits those rows. The internal note still says floor tile supply is customer-supplied and installation stays in the estimate. Client exclusions still name plumbing and electrical. Review stays blocked because the requested tasks have no priced line. Hiding a row did not price it, resolve it, or mark it excluded.

Fresh draft `a3116424` on project `6ba794d6` was created after insert-time visibility. The customer tile purchase and the unresolved coverage rows are already Not in total and Hidden from quote. There is no visibility-only update to apply. Totals stay $5,029.11 and $6,286.40. Review and Create quote stay disabled. Plumbing and electrical exclusions remain.

Untouched generated rows take the current source visibility only through Update final pricing. A manually edited generated row is left for review. An explicit visibility override is kept and needs a review decision. A legacy row with no source id and no requirement scope is not matched by label or amount. An included no-charge row stays visible. Repeating the update does not list the same change again. An issued quote snapshot is not changed, and an archived document is not offered the update.

`scripts/verify-pricing-draft-reconciliation.ts` covers the visibility-only $0 difference, visible-to-hidden and hidden-to-visible, an edited generated row, a manual no-charge row, an explicit visibility override, a legacy row without identity, a repeated update, and issued-snapshot immutability. `scripts/verify-bathroom-scope-preservation.ts` covers the quote projection and the readiness block. Both passed. Typecheck passed. The guarded webpack build exited 0 and refused the production database.

## Project preliminaries

Quote visibility stays the accepted slice above. This section is project-wide preliminaries. Behavior `358f5574bd58`. Preview alias https://quotr-2-0-git-estimating-v3-quotr1.vercel.app, target none. Production remains `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` / `bc0a76674229`. No quote was sent. Pricing was not marked reviewed. No schema change.

Preliminaries are one project fact and one Preliminaries work area, created only when items are saved or an estimate is generated. They are not a percentage and they are not copied into each trade. Provisional is a flag on the item, separate from requested, included, or excluded. A requested or unresolved item stays out of the total and off the customer quote. It is not an exclusion and it is not a free included line.

Supported bases, using the existing sell convention (company margin; 20% on this organisation, so sell is cost / 0.8):

- Fixed cost. A single amount is a combined allowance, not materials and not labour. Materials and labour are split only when both parts are entered.
- Labour hours times a company role rate, or an explicit project hourly cost. A Quotr benchmark does not price this.
- Days or occurrences times an entered unit cost.
- Recurring labour: occurrences times hours per occurrence times the hourly cost.

No duration, visit count, or benchmark amount is invented. “Clean up daily” recognises the item and leaves the number of days empty.

Before this slice, the office brief left site establishment, daily cleaning, final cleaning, and supervision inside the walls coverage note, and the bathroom brief left stair protection and daily cleaning as bathroom coverage. Common-area protection and deliveries were in the office brief and were not even in that note. After this slice those names are one project item each. Duration still not confirmed, and goods-lift access, stay on the walls note. Booked delivery windows are a restriction, not a delivery charge. Occupied-site labour is not payment for protection, supervision, or daily cleaning.

Office job `c2b4e96f-56c2-4559-a8e5-cfad8acfa1ce`, brief length 627. The details gate needed existing-workflow answers before Create estimate. Those answers do not price painting, lining, insulation labour, floor preparation, common-area protection, or final cleaning. The job stays Incomplete.

Independent check at carpenter $75/h, then the hosted estimate:

- Site establishment, fixed $1,000. Cost $1,000, sell $1,250. Combined amount. Source on the estimate: Entered amount.
- Daily cleaning, 10 days × $80. Cost $800, sell $1,000. Formula `10 day × $80.00/day.`
- Supervision, 8 h × $75. Cost $600, sell $750. Company rate. Labour takeoff shows 8.00 hrs, $75/h, Your rate, labour cost $600. The occupied +5% on carpet installation is not applied to these hours.
- Deliveries, provisional fixed $500. Cost $500, sell $625, and it stays in the total. Source: Entered amount · provisional.
- Common-area protection and final cleaning stay requested. Pricing required, not in the total, hidden from the quote, coverage unresolved.

Priced preliminaries direct cost $2,900 and 8.00 hours. Preliminaries client sell $3,625. Whole-job known cost $12,994 and known sell $16,242 are priced work only. Eight lines still need prices. Two requested tasks have no line. Scope summary: included site establishment, daily cleaning, and supervision; provisional deliveries; requested and not yet priced common-area protection and final cleaning. Client exclusions name electrical, structural, plumbing, and fire-system work. They do not exclude the unpriced preliminaries.

Saving 12 days, then an explicit Regenerate, moved known cost to $13,154 and known sell to $16,442. That is +$160 cost and +$200 sell, which is 2 × $80 and 2 × $100. Preview changes listed one item to update: Daily cleaning $1,000 to $1,200, difference +$200. The other 18 rows were unchanged, including the $0 unresolved rows. Update final pricing applied that one change. Preliminaries client sell became $3,825. Review and Create quote stayed disabled. No quote was created.

Bathroom job `80a4b84a-1bde-43af-bb7b-69f9cbb46d8f` used the original bathroom brief. Analysis shows one Daily cleaning and one Stair protection under Preliminaries, both unresolved, and neither is a bathroom line. “Clean up daily” did not become one day. Partial wall lining, ancillary materials, and waterproofing stay to confirm. Waterproofing was not answered. Plumbing and electrical stay excluded. No estimate was forced, and the job is not complete.

A 390×844 reload of that capture kept the document at 390 px with no horizontal overflow. Scope, pricing-basis, and provisional controls are 44 px or taller and sit inside the width.

`scripts/verify-preliminaries.ts` checks the same money, an unknown duration, a shared protection identity, a later duration change classified as will update, a manual edit left in place, and an issued snapshot blocked from reconciliation. Stage 2A briefs, stage 3D, bathroom scope preservation, and pricing-draft reconciliation passed. Typecheck passed. The guarded webpack build compiled 50 pages and refused the production database.

Limits that remain from the first preliminaries slice are closed on `estimating/v3-preliminaries`, which starts at `af4a388b`. Production is not deployed. No schema change.

Capture shows the company role rate generation will use. An explicit project hourly cost replaces that rate and is labelled Project hourly cost. The selected supervision role is stored on the labour line, so labour takeoff names Carpenter, Labourer, or Apprentice. An entered amount stays Entered amount on the estimate and in Pricing. Default allowance is only the label when that is the stored source. The internal type for an entered amount is still default.

The same daily cleaning or the same protection named in the project and in a trade description is one item, including when the trade uses different words for that service, such as cleaning the work area at the end of each working day or keeping the common areas protected. Daily cleaning and final cleaning stay separate. Common-area protection and stair protection stay separate. A second mention that cannot be identified is a review and stays out of the total until someone confirms it is a different service. Confirming that does not invent a price.

Recurring labour is occurrences × hours per occurrence × the selected company role rate. A project hourly cost is used instead when one is entered. Edited Pricing rows and issued snapshots are still left unchanged. The accepted office preliminary total stays $2,900 cost and $3,625 sell.

A delivery window without a delivery-service item is stored and shown in capture, and it does not by itself create the Preliminaries work area.

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
