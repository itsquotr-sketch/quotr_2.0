import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function safeReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/app/profile";
  const path = value.split("#")[0]?.split("?")[0] ?? "";
  if (path.includes("\\") || path.includes("//") || path.includes("..")) {
    return "/app/profile";
  }
  if (path === "/reset-password") return path;
  if (path === "/app" || path.startsWith("/app/")) return path;
  return "/app/profile";
}

function alreadySignedOut(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("session missing") ||
    text.includes("session_not_found") ||
    text.includes("auth session missing")
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const returnTo = safeReturnPath(form.get("return_to"));
  const origin = request.nextUrl.origin;
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.splice(0, pendingCookies.length, ...cookiesToSet);
        },
      },
    }
  );

  const { error } = await supabase.auth.signOut();
  if (error && !alreadySignedOut(error.message)) {
    const failed = new URL(returnTo, origin);
    failed.searchParams.set("logout", "failed");
    return NextResponse.redirect(failed, 303);
  }

  const response = NextResponse.redirect(new URL("/login", origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
