"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { presentAuthError } from "@/lib/auth/errors";

function safeReturnPath(pathname: string | null): string {
  if (!pathname) return "/app/profile";
  if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) {
    return "/reset-password";
  }
  if (pathname === "/app" || pathname.startsWith("/app/")) return pathname;
  return "/app/profile";
}

export function LogoutForm({
  children,
  className,
  returnTo,
}: {
  children: React.ReactNode | ((pending: boolean) => React.ReactNode);
  className?: string;
  returnTo?: string;
}) {
  const pathname = usePathname();
  const lockRef = useRef(false);
  const [pending, setPending] = useState(false);
  const destination = returnTo || safeReturnPath(pathname);

  return (
    <form
      action="/auth/sign-out"
      method="post"
      className={className}
      onSubmit={(event) => {
        if (lockRef.current) {
          event.preventDefault();
          return;
        }
        lockRef.current = true;
        setPending(true);
      }}
    >
      <input type="hidden" name="return_to" value={destination} />
      {typeof children === "function" ? children(pending) : children}
    </form>
  );
}

export function LogoutFailureNotice() {
  const params = useSearchParams();
  if (params.get("logout") !== "failed") return null;
  return (
    <p role="alert" className="px-4 py-2 text-sm text-destructive">
      {presentAuthError("LOGOUT_FAILED")}
    </p>
  );
}
