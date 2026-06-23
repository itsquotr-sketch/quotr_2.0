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
          ? "flex items-center gap-1.5 rounded-md px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          : variant === "sidebar"
            ? "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            : "flex items-center gap-2",
        className
      )}
    >
      <MessageSquare className="size-3.5 opacity-70" />
      Report issue
    </a>
  );
}
