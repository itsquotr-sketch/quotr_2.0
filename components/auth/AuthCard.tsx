import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

export function AuthCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      data-auth-card
      className={cn(
        "w-full border border-border/80 bg-card shadow-sm ring-0",
        className
      )}
    >
      {children}
    </Card>
  );
}

export function AuthCardHeader({
  title,
  description,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <CardHeader className="gap-2 pb-0">
      <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </CardHeader>
  );
}

export function AuthCardContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <CardContent className={cn("space-y-4", className)}>{children}</CardContent>;
}

export function AuthCardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <CardFooter className={cn("w-full flex-col items-stretch gap-4", className)}>
      {children}
    </CardFooter>
  );
}

export const authTextLinkClass =
  "rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2";
