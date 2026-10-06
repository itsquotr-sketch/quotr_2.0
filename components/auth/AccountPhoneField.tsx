"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EXAMPLES = {
  NZ: { local: "021 123 4567", international: "+64 21 123 4567" },
  AU: { local: "0412 345 678", international: "+61 412 345 678" },
} as const;

type AccountPhoneCountry = keyof typeof EXAMPLES;

export function AccountPhoneField({
  defaultCountry = "NZ",
  defaultNumber = "",
  required = true,
  disabled = false,
  error,
}: {
  defaultCountry?: AccountPhoneCountry;
  defaultNumber?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  const [country, setCountry] = useState<AccountPhoneCountry>(
    defaultCountry === "AU" ? "AU" : "NZ"
  );
  const example = EXAMPLES[country];

  return (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor="phone_country">
        Phone number
      </Label>
      <div className="grid gap-2 sm:grid-cols-[9.5rem_1fr]">
        <select
          id="phone_country"
          name="phone_country"
          value={country}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value === "AU" ? "AU" : "NZ";
            setCountry(next);
          }}
          className="h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
        >
          <option value="NZ">New Zealand</option>
          <option value="AU">Australia</option>
        </select>
        <Input
          id="phone_number"
          name="phone_number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={example.local}
          defaultValue={defaultNumber}
          required={required}
          disabled={disabled}
          maxLength={40}
          aria-describedby="account-phone-hint"
          aria-invalid={error ? true : undefined}
          className="h-11"
        />
      </div>
      <p id="account-phone-hint" className="text-sm text-muted-foreground">
        Example: {example.local}. {example.international} is the same number.
        We will not text this number, and it is not used to sign in.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
