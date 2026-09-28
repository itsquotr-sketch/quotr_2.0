"use client";

import { useState } from "react";
import { VariationPublicView } from "@/components/variations/VariationPublicView";
import type { VariationResponseDeliveryState } from "@/lib/variations/response-actions";
import type { VariationPublicView as PublicView } from "@/lib/variations/public-lookup";

export function VariationPublicExperience({ view }: { view: PublicView }) {
  const [clientEmail, setClientEmail] = useState<VariationResponseDeliveryState | null>(null);
  return <VariationPublicView view={view} clientEmail={clientEmail} onClientEmail={setClientEmail} />;
}
