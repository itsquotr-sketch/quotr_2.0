import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import "@/lib/env";

/**
 * Request-scoped Supabase server client.
 *
 * Wrapped in React.cache() so layout, pages, and nested helpers in the same
 * Next.js request share one cookie-bound client. The cache is discarded when
 * the request ends — this is not a process-global client and must never be
 * used as cross-request session state.
 */
function bindAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      } catch {
        // Called from a Server Component — middleware refreshes sessions.
      }
    },
  };
}

export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: bindAuthCookies(cookieStore),
    }
  );
});

/**
 * Signup needs the GoTrue response body when Auth returns HTTP 500.
 * The shared client drops that body. This client keeps the latest 5xx body.
 */
export async function createAuthAttemptClient() {
  let failureBody = "";
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const response = await fetch(input, init);
          if (response.status >= 500) {
            try {
              failureBody = (await response.clone().text()).slice(0, 400);
            } catch {
              failureBody = "";
            }
          }
          return response;
        },
      },
      cookies: bindAuthCookies(cookieStore),
    }
  );
  return {
    supabase,
    failureBody: () => failureBody,
  };
}
