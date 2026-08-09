# Stage 3.1C.2B — Account Recovery Preview E2E

**Status:** Pending owner after Preview deploy  
**Depends on:** Owner completes `docs/runbooks/STAGE_3_1C2B_AUTH_URL_CONFIGURATION.md` (Preview `NEXT_PUBLIC_SITE_URL` = stable branch origin; Supabase redirect allow-list includes local + stable Preview callbacks).

## A. NEW ACCOUNT

1. New signup (confirmation off) → provision → Dashboard.  
2. New signup (confirmation on) → Check your email (not an error).  
3. Resend confirmation (if used) → non-enumerating ack.

## B. EMAIL CONFIRMATION

4. Valid confirmation link → session → Dashboard or setup-required.  
5. Invalid/expired/reused link → safe copy; Return to login.  
6. setup-required → Finish account setup → Dashboard.

## C. LOGIN

7. Valid login.  
8. Wrong password → generic credentials message.  
9. Logged-in `/login` or `/signup` → dashboard (or setup-required).

## D. PASSWORD RECOVERY

10. Forgot password → non-enumerating success.  
11. Reset email received.  
12. Recovery link → Set new password.  
13. Submit new password → Dashboard (session kept).  
14. Old password rejected on login.  
15. New password accepted.

## E. DEEP LINK

16. Logged-out `/app/projects/:id` → login with `next`.  
17. Login → return to same project (when provisioned).

## F. ACCOUNT REPAIR

18. Authenticated missing-profile → setup-required.  
19. Finish setup → Dashboard.

## G. MOBILE (~390×844 / 393×852)

20. Login / Signup / Forgot / Reset usable; CTA reachable; no horizontal overflow.

## H. SECURITY

21. No raw provider/SQL/token/code in UI.  
22. `https://evil.com` / `//evil.com` as `next` fall back to dashboard.  
23. No account-enumeration copy on forgot/resend.

## Pass criteria

- [ ] A–H pass  
- [ ] Production Scope Discovery still disabled  
- [ ] Stage 3.2 not started  
- [ ] 3.1C.3 not started in this deploy
