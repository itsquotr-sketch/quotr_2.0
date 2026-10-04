"use client";

import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAppUser } from "@/components/layout/app-user-context";
import {
  buildFeedbackMailtoHref,
  extractProjectIdFromPath,
} from "@/lib/feedback";
import { cn } from "@/lib/utils";

type FeedbackLinkProps = {
  className?: string;
  variant?: "menu" | "sidebar" | "sidebar-footer";
};

export function FeedbackLink({
  className,
  variant = "sidebar",
}: FeedbackLinkProps) {
  const pathname = usePathname();
  const { userEmail } = useAppUser();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.href = buildFeedbackMailtoHref({
      pageUrl: window.location.href,
      userEmail,
      projectId: extractProjectIdFromPath(pathname ?? window.location.pathname),
    });
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      className={cn(
        variant === "sidebar-footer"
          ? "flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-white/55 outline-none transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141311] print:hidden"
          : variant === "sidebar"
            ? "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            : "flex items-center gap-2",
        className
      )}
    >
      <MessageSquare className="size-3.5 opacity-70" />
      Report issue
    </a>
  );
}
