/**
 * Application Resend channels vs Auth SMTP.
 *
 * Auth (signup confirm, password reset):
 *   Supabase Auth SMTP → Resend SMTP → no-reply@get-quotr.com
 *   Not implemented in application send paths. Do not change Auth templates
 *   for Team/Quote From splits.
 *
 * Application Resend (Vercel env, sending-only API key):
 *   TEAM   RESEND_TEAM_FROM_EMAIL || RESEND_FROM_EMAIL
 *          Quotr <no-reply@get-quotr.com>
 *   QUOTE  RESEND_QUOTE_FROM_EMAIL || RESEND_FROM_EMAIL
 *          {Company} via Quotr <quotes@get-quotr.com>
 *   OTHER  RESEND_FROM_EMAIL
 *
 * Quote Reply-To is organisation contact email only. If missing, omit Reply-To.
 * Never use quotes@quotes.get-quotr.com.
 *
 * Canonical module: lib/email/application-email.ts
 * Canonical origin: lib/auth/site-url.ts resolveConfiguredSiteOrigin
 *   Preview: stable https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app
 *   (ignores localhost / ephemeral *.vercel.app when VERCEL_ENV=preview)
 *
 * Team From never uses quotes@get-quotr.com (Quote channel).
 * Resend webhooks match on provider message id, not From address.
 *
 * Account welcome (service mail after a new self-signup confirms):
 *   Same team From and Reply-To hello@get-quotr.com.
 *   Sends only when confirmation is at or after account_welcome_runtime.activated_at.
 *   Retry the same payload and idempotency key for 24 hours:
 *     npx tsx scripts/retry-preview-account-welcome.ts --yes
 *     npx tsx scripts/retry-production-account-welcome.ts --yes
 *   Each command refuses the other database. After 24 hours an uncertain
 *   send is left for operator reconciliation and is not sent again.
 */
