# Stage 3.1B.7F-R2 — Deck Preview Retest

**Status:** Pending owner Preview retest  
**Prerequisite:** Local 7F-R2 complete; Preview deploy of app code  
**Migration 030:** **Applied and Verified** on linked remote Preview DB  
  (`quotr_2.0` / `lxvnylhsbvudzzupxeqr`) — see  
  `docs/implementation/STAGE_3_1B7FR21_REMOTE_030_APPLY_COMPLETION.md`  
**Remote history:** Local and remote aligned **001–030**  
**Production Scope Discovery:** Disabled (unchanged)

## Goal

Confirm Scope Review / Scope Details mental model, manual scope add, QE
attention clarity, latency polish, layout, and mobile header on Deck.

## Remote 030 readiness (7F-R2.1)

| Check | Status |
| --- | --- |
| Linked project is Preview `quotr_2.0` | Pass |
| History through 029 before apply | Pass |
| 030 absent before apply | Pass |
| No table/function name collision | Pass |
| Dry-run additive (030 only) | Pass |
| Applied via `db push --linked` | Pass |
| Tables + RLS + policies verified | Pass |
| anon grants | None |
| Existing WA / discovery / pricing counts | Unaffected |

Manual **Add scope item** can now persist on Preview against remote tables.
If add fails soft-empty, confirm the Preview deployment includes 7F-R2 app code.

## Checklist

### Scope semantics

- [ ] Confirmed scope shows Included / Not required / To confirm in Scope Details
- [ ] No lone “Needs detail” that implies fixing inside Scope Review
- [ ] Pending items show Included + reason + Review Scope Details
- [ ] Review scrolls/opens Scope Details
- [ ] Zero pending hides the section
- [ ] Scope Review can show Complete while Scope Details still has questions

### Manual scope item

- [ ] `+ Add scope item` under each confirmed Work Area
- [ ] Persists across refresh; appears under Included; “Added by you”
- [ ] Can mark Not required and re-include
- [ ] Does not create a Work Area / Fact / AI suggestion
- [ ] Appears on Estimate Review + breakdown as Pricing required
- [ ] Final Pricing carries stub labelled Pricing required (not fake free line)

### Quick Estimate

- [ ] Attention lists exact items + Work Area + Review in Scope Details
- [ ] Does not imply Scope Review failed when only details outstanding
- [ ] Generate Estimate shows Generating… immediately; no double-submit

### Answer save

- [ ] Selection feels immediate; Saving → Saved without snap-back
- [ ] Latest write wins

### Layout / mobile

- [ ] Testing banner gone (no leftover spacer)
- [ ] Top content not clipped; no artificial bottom whitespace trap
- [ ] Sticky QE still usable on desktop
- [ ] Mobile header compact (Back / title / Actions); desktop metadata retained

### Dimensions (browser zoom 100%)

- [ ] 1440×900, 1366×768, 1280×720
- [ ] 1024×768
- [ ] 768×1024
- [ ] 390×844, 393×852

## Out of scope

- Production enablement  
- Stage 3.2  
- Company DNA / Builder Interview  
- Commercial formula changes  

## Result

Record pass/fail against `docs/audits/STAGE_3_1B7F_OWNER_E2E_RESULTS.md` and
defect register after retest.
