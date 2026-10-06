"use client";

import { AddressSearch } from "@/components/addresses/AddressSearch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addressCountryCode } from "@/lib/addresses/map-place";
import type { SubcontractorCountryCode } from "@/lib/subcontractors/types";

const fieldClass = "min-h-11";

export type BusinessLocationValue = {
  address_line_1: string;
  address_line_2: string;
  address_city: string;
  address_region: string;
  address_postcode: string;
};

type BusinessLocationFieldsProps = {
  country: SubcontractorCountryCode | null;
  value: BusinessLocationValue;
  onChange: (value: BusinessLocationValue) => void;
  disabled?: boolean;
  idPrefix?: string;
};

export function BusinessLocationFields({
  country,
  value,
  onChange,
  disabled = false,
  idPrefix = "business-address",
}: BusinessLocationFieldsProps) {
  const australia = country === "AU";

  function patch(partial: Partial<BusinessLocationValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-3" data-business-location>
      <p className="text-sm text-muted-foreground">
        This is the business location, not the area they travel to. Search for the address, or type it below if search is unavailable.
      </p>
      <AddressSearch
        countryCode={addressCountryCode(country)}
        disabled={disabled || !country}
        onAddress={(mapped) => {
          onChange({
            address_line_1: mapped.street,
            address_line_2: mapped.unit,
            address_city: mapped.suburbOrCity,
            address_region: mapped.region,
            address_postcode: mapped.postcode.slice(0, 12),
          });
        }}
      />
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-line-1`}>Street address</Label>
        <Input
          id={`${idPrefix}-line-1`}
          value={value.address_line_1}
          onChange={(event) => patch({ address_line_1: event.target.value })}
          className={fieldClass}
          autoComplete="address-line1"
          maxLength={200}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-line-2`}>Address line 2 (optional)</Label>
        <Input
          id={`${idPrefix}-line-2`}
          value={value.address_line_2}
          onChange={(event) => patch({ address_line_2: event.target.value })}
          className={fieldClass}
          autoComplete="address-line2"
          maxLength={200}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-city`}>{australia ? "Suburb or city" : "City or town"}</Label>
          <Input
            id={`${idPrefix}-city`}
            value={value.address_city}
            onChange={(event) => patch({ address_city: event.target.value })}
            className={fieldClass}
            autoComplete="address-level2"
            maxLength={80}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-region`}>{australia ? "State" : "Region"}</Label>
          <Input
            id={`${idPrefix}-region`}
            value={value.address_region}
            onChange={(event) => patch({ address_region: event.target.value })}
            className={fieldClass}
            autoComplete="address-level1"
            maxLength={80}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor={`${idPrefix}-postcode`}>Postcode</Label>
        <Input
          id={`${idPrefix}-postcode`}
          value={value.address_postcode}
          onChange={(event) => patch({ address_postcode: event.target.value })}
          className={fieldClass}
          autoComplete="postal-code"
          maxLength={12}
          disabled={disabled}
          inputMode="numeric"
        />
      </div>
    </div>
  );
}
