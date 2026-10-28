# Stage 3C — assumptions, changed conditions and explicit refresh

Baseline `estimating/v3` at `97dc7c35e27ccf004823ff6a6ecc85f2a2158c8e`. Production is unchanged. No new recipe.

## Why the current laminate estimate has no regenerate control

Regenerate is shown on the estimate views only when the estimate is stale. The priced laminate estimate is current, so the control is absent. The earlier regeneration appeared after a change, including a rate save, had marked it stale. Answering site access or carry did not do that for a flooring-only job: flooring labour used the adjustment, but flooring was not treated as a consumer, and “Use assumption” did not save a value. An unrelated edit was the way to expose regenerate. A price-affecting answer now marks the estimate stale and shows the existing regenerate control.

## Calculation basis for the laminate job

Unanswered site access adds no labour modifier. That is the same hours as Easy, and it is not an Easy answer. Unanswered carry distance is parsed as short and also adds nothing. It is not a confirmed distance under 10 m. “Not sure” on either stays unresolved and adds nothing. It is not converted to No, and it is not given the old +5% carry allowance.

Hazardous-materials risk is not an input to the laminate hours or material quantities. No allowance is created. Unanswered risk on this job is visible and is not zero. Yes, or Not sure, leaves that work unpriced and blocks commercial readiness. Unanswered risk does not block a non-demolition job.

The priced lines can all have amounts while access and carry are still open. That is not a resolved estimate. Reviewing the price does not write these answers.

Accepting the supported assumption stores Easy as standard access, or under 10 m as standard carry. Both add nothing, and both can be changed. The labour note states which basis was used.

## Refresh

Answering access, carry, occupancy, working hours or slope marks the estimate stale. Hazardous-materials risk does not, because it does not change the calculation. Regenerate runs only from that explicit action. It does not rewrite an issued quote. Pricing then offers the existing preview and apply. Manual pricing edits, company settings, saved revisions and issued snapshots stay in place until that apply.

## Saved waste wording

`10% waste is stated … once this area can be priced` on an estimate that already has priced laminate supply is historical output. It stays visible and is not treated as a missing price. A newly generated laminate estimate uses the supply formula and does not emit that warning. Stored historical text is not rewritten just to change the wording.

## Verified journey

On the isolated Preview organisation, the generated laminate estimate started at Difficult access and a carry over 30 m: 7.20 hours and $540, using 30 m² × 0.2 h/m² × 1.20. Accepting standard access and standard carry, then regenerating explicitly, changed that to 6.00 hours and $450 with no access/carry adjustment. Changing carry to over 30 m and regenerating again produced 6.60 hours and $495 (+10%).

Pricing was created at the 6-hour basis: 33 m² laminate, 30 m² underlay, 30 m² moisture barrier, 6 h installation, direct cost $2,100, sell $2,625. After the later regenerate, that draft stayed unchanged until Preview changes showed one labour update ($563 to $619, subtotal $2,625 to $2,681) and three unchanged material lines. Applying it, then reloading, showed 6.6 h at $618.75, direct cost $2,145 and sell $2,681.25. No quote was created or sent. The pricing document stayed a draft.

Hazardous-materials Not sure did not regenerate the estimate or add an allowance. Marking pricing reviewed was refused with “It is not treated as No, and no allowance has been added.” The estimate overview then showed Incomplete and “Known sell, not the complete price.” The new assumptions list shows the 10% laminate supply formula and does not show the obsolete unpriced-waste warning.

GST was left at the existing rules. Unknown showed “GST registration is not decided. No GST is added” and blocked a quote. Registered removed that block and did not rewrite the draft’s stored zero rate. Not registered showed “Not GST registered. No GST is added.” The isolated organisation was returned to unknown afterwards. Desktop and a 390 px layout both kept the condition questions usable.
