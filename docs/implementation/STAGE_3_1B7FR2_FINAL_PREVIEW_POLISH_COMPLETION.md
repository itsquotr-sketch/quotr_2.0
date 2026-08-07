# Stage 3.1B.7F-R2 — Final Preview Polish Completion

**Status:** Complete — Local, Preview Retest Pending  
**Date:** 2026-08-08  
**Deck Owner E2E:** Pending Retest  
**Stage 3.1B:** BLOCKED BY PREVIEW DEFECTS  
**Production:** Disabled  
**Stage 3.2:** Not Started  

## Summary

Targeted final integration batch after 7F-R1 Preview pass (minus owner
findings). No Assistant redesign. No commercial formula changes. No AI prompt
changes. No Company DNA / Builder Interview. No Production enablement.

## Delivered

1. **Scope Review / Scope Details semantics** — “Needs detail” replaced with
   “To confirm in Scope Details”; Review action scrolls to Scope Details;
   Scope Review may be Complete while details remain outstanding.
2. **Manual scope items** — `+ Add scope item` under confirmed Work Areas;
   truthful `origin=user` persistence via dedicated tables (migration 030).
3. **Estimate / Pricing boundary** — manual items appear in Estimate Review and
   breakdown; Final Pricing receives editable stubs labelled **Pricing required**
   (not fake calculated $0 display).
4. **Quick Estimate attention** — lists exact items with Work Area + “Review in
   Scope Details”.
5. **Generate / answer latency** — immediate Generating/Saving acknowledgement;
   ack/complete preview-perf marks; Saved before background refresh.
6. **Layout / banner / mobile header** — testing banner removed; shell height
   overflow adjusted; compact mobile project header; sticky QE offset unchanged
   at `lg:top-6` (banner height no longer consumed).
7. **Scope Review visual tidy** — lighter row separators; clearer hierarchy.

## Migration 030

- **Decision:** Option B — `work_area_scope_items` + decisions (see architecture
  doc).
- **Local:** apply via Docker reset through 030.
- **Remote / Preview:** **Applied and Verified** (Stage 3.1B.7F-R2.1) on linked
  `quotr_2.0` — `docs/implementation/STAGE_3_1B7FR21_REMOTE_030_APPLY_COMPLETION.md`.

## Verification

```bash
npx tsx scripts/verify-stage-3-1b7fr2-final-preview-polish.ts
```

Plus regression suite (3.1A → 7G, 7F-R1, RLS, 2B.10) and `tsc` / `lint` / `build` — **passed locally**.

### Local migration / RLS

- `supabase db reset` applied through **030_work_area_scope_items.sql** successfully.
- `scripts/verify-rls-coverage.ts` passed against local Docker (RLS + org-match triggers).

### Remote migration / RLS (7F-R2.1)

- `npx supabase migration list --linked` → **001–030** aligned.
- Remote tables + RLS + `auth_org_id()` policies verified via `db query --linked`.
- anon grants: none. Existing discovery / WA / pricing row counts unaffected.

## Preview retests required

See `docs/runbooks/STAGE_3_1B7FR2_DECK_PREVIEW_RETEST.md`.

## Boundaries confirmed

- Production — Disabled  
- Stage 3.2 — Not Started  
- Stage 3.1B — not marked complete  
