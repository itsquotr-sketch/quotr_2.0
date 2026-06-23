import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type QuotrLogoProps = {
  className?: string;
  href?: string;
  height?: number;
};

export function QuotrLogo({
  className,
  href = "/app/dashboard",
  height = 32,
}: QuotrLogoProps) {
  const image = (
    <Image
      src="/quotr-logo.svg"
      alt="Quotr"
      width={Math.round(height * 4.125)}
      height={height}
      className={cn("h-8 w-auto", className)}
      priority
    />
  );

  if (!href) {
    return image;
  }

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {image}
    </Link>
  );
}
