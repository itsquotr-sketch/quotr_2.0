import Image from "next/image";
import Link from "next/link";
import {
  QUOTR_ICON_NATIVE,
  QUOTR_ICON_SRC,
  QUOTR_WORDMARK_NATIVE,
  QUOTR_WORDMARK_SRC,
} from "@/lib/branding/assets";
import { cn } from "@/lib/utils";

type QuotrLogoProps = {
  className?: string;
  href?: string | null;
  height?: number;
  variant?: "wordmark" | "icon";
  /** When true, hide from assistive tech (adjacent text already names Quotr). */
  decorative?: boolean;
};

export function QuotrLogo({
  className,
  href = "/app/dashboard",
  height = 32,
  variant = "wordmark",
  decorative = false,
}: QuotrLogoProps) {
  const native =
    variant === "icon" ? QUOTR_ICON_NATIVE : QUOTR_WORDMARK_NATIVE;
  const width = Math.round((height * native.width) / native.height);
  const image = (
    <Image
      src={variant === "icon" ? QUOTR_ICON_SRC : QUOTR_WORDMARK_SRC}
      alt={decorative ? "" : "Quotr"}
      width={width}
      height={height}
      className={cn("h-auto w-auto", className)}
      quality={100}
      priority
    />
  );

  if (!href) {
    return image;
  }

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center"
      aria-label={decorative ? undefined : "Quotr"}
    >
      {image}
    </Link>
  );
}
