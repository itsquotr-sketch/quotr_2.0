import { cookies } from "next/headers";
import { z } from "zod";

/** Address entered at signup. Not derived from a confirmation token. */
export const PENDING_SIGNUP_EMAIL_COOKIE = "quotr_signup_email";

const emailSchema = z.email();

export function pendingSignupEmail(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") return null;
  const parsed = emailSchema.safeParse(value.trim());
  return parsed.success ? parsed.data : null;
}

export async function readPendingSignupEmail(): Promise<string | null> {
  const store = await cookies();
  return pendingSignupEmail(store.get(PENDING_SIGNUP_EMAIL_COOKIE)?.value);
}

export async function rememberPendingSignupEmail(email: string): Promise<void> {
  const parsed = pendingSignupEmail(email);
  if (!parsed) return;
  const store = await cookies();
  store.set(PENDING_SIGNUP_EMAIL_COOKIE, parsed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}
