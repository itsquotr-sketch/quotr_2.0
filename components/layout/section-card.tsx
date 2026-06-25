import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  description,
  children,
  footer,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn("border-border/60 shadow-none", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {footer ? (
        <CardFooter className="border-t border-border/60">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}
