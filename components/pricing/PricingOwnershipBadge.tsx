import { Badge } from "@/components/ui/badge";
import {
  PRICING_OWNER_LABELS,
  type PricingOwner,
} from "@/lib/estimate/pricing-ownership";
import { cn } from "@/lib/utils";

const OWNER_VARIANTS: Record<
  PricingOwner,
  "default" | "secondary" | "outline" | "destructive"
> = {
  in_house_labour: "default",
  contractor_material: "secondary",
  subcontractor_allowance: "outline",
  client_supplied: "secondary",
  excluded: "destructive",
  internal_build_up: "outline",
};

type PricingOwnershipBadgeProps = {
  owner?: PricingOwner | null;
  includedInTotal?: boolean;
  className?: string;
};

export function PricingOwnershipBadge({
  owner,
  includedInTotal = true,
  className,
}: PricingOwnershipBadgeProps) {
  if (!owner && includedInTotal !== false) return null;

  const label = owner ? PRICING_OWNER_LABELS[owner] : "Not in total";
  const excluded = includedInTotal === false || owner === "excluded";

  return (
    <Badge
      variant={owner ? OWNER_VARIANTS[owner] : "outline"}
      className={cn(
        "text-[10px] font-normal",
        excluded && "opacity-70",
        className
      )}
    >
      {owner && excluded ? `${label} · not in total` : label}
    </Badge>
  );
}
