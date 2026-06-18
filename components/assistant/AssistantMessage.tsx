import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BlockStatus } from "@/components/assistant/types";

type AssistantMessageProps = {
  title: string;
  subtitle?: string;
  status?: BlockStatus;
  badge?: string;
  children: React.ReactNode;
  className?: string;
};

export function AssistantMessage({
  title,
  subtitle,
  status = "active",
  badge,
  children,
  className,
}: AssistantMessageProps) {
  return (
    <Card
      className={cn(
        "transition-opacity",
        status === "submitted" && "opacity-80",
        status === "system" && "border-dashed bg-muted/30 opacity-70",
        status === "active" && "ring-1 ring-primary/10",
        className
      )}
    >
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle ? (
              <CardDescription>{subtitle}</CardDescription>
            ) : null}
          </div>
          {badge ? (
            <Badge
              variant="outline"
              className="shrink-0 border-transparent bg-muted/60 text-[10px] font-normal text-muted-foreground"
            >
              {badge}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
