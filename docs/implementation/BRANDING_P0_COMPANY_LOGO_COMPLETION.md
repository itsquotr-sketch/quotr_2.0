# BRANDING-P0 — Company logo upload + quote rendering

**Status:** Complete Local / Owner Preview Pending  
**Date:** 2026-08-14  
**Migration:** `supabase/migrations/034_organisation_branding_storage.sql` (required before upload works on Preview/remote)  
**Verify:** `npx tsx scripts/verify-branding-p0-company-logo.ts`

**Does not:** MaterialRequirement, Deck takeoff, catalogue, 3.2.3, DNA, PERF-FUTURE-01, Production SD, quote logo snapshot migration.

## Root cause

Company Settings accepted arbitrary `logo_url` strings. Webpage URLs (e.g. Imgur gallery pages) were saved and rendered with a raw `<img>`, producing broken images on quotes.

## Architecture

1. Upload to public bucket `organisation-branding` at `{org_id}/branding/logo-<unique>.<ext>`
2. Persist public URL in existing `organisation_settings.logo_url`
3. **Replace order (failure-safe):** list existing → upload new unique object → persist URL → only then delete obsolete objects. If upload/persist fails, the previous logo remains authoritative; orphan uploads are cleaned up.
4. Quotes read **live** company settings (unchanged). Future sent-quote immutability: **BRANDING-SNAPSHOT-01**
5. Legacy external image URLs retained under Advanced; Imgur-style page URLs rejected
6. Quote render uses `QuoteCompanyLogo` with `onError` → company name (no broken icon)

## Apply migration

```bash
# remote / Preview project
supabase db push
# or apply 034 via Supabase SQL editor / CI migration path
```
