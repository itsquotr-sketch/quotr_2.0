"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  applyQuantityUnitCoherence,
  formatQuoteDisplayPreview,
  resolveQuoteDisplayOptions,
  type QuoteDisplayOptions,
} from "@/lib/quotes/display-options";
import type { Quote } from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

type QuoteDisplayControlProps = {
  quote: Pick<Quote, "display_options">;
  disabled?: boolean;
  onChange: (value: QuoteDisplayOptions) => void;
};

export function QuoteDisplayControl({
  quote,
  disabled,
  onChange,
}: QuoteDisplayControlProps) {
  const options = resolveQuoteDisplayOptions(quote);
  const unitDisabled = disabled || !options.show_quantity;

  const toggle = (patch: Partial<QuoteDisplayOptions>) => {
    if (disabled) return;
    onChange(applyQuantityUnitCoherence(options, patch));
  };

  return (
    <div
      className="space-y-2 sm:col-span-2"
      data-quote-display-control="true"
    >
      <div>
        <p className="text-xs font-medium">Client quote display</p>
        <p className="text-xs text-muted-foreground">
          Choose how much pricing detail your client will see.
        </p>
      </div>
      <fieldset
        className="space-y-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
        disabled={disabled}
      >
        <legend className="sr-only">Client quote display</legend>
        <DisplayToggle
          id="quote-display-description"
          label="Description"
          helper="Description is always shown."
          checked
          disabled
          locked
        />
        <DisplayToggle
          id="quote-display-quantity"
          label="Quantity"
          checked={options.show_quantity}
          disabled={disabled}
          onCheckedChange={(checked) => toggle({ show_quantity: checked })}
        />
        <DisplayToggle
          id="quote-display-unit"
          label="Unit"
          helper={
            !options.show_quantity
              ? "Unit is hidden when quantity is hidden."
              : undefined
          }
          checked={options.show_unit}
          disabled={unitDisabled}
          onCheckedChange={(checked) => toggle({ show_unit: checked })}
        />
        <DisplayToggle
          id="quote-display-unit-price"
          label="Unit price"
          checked={options.show_unit_price}
          disabled={disabled}
          onCheckedChange={(checked) => toggle({ show_unit_price: checked })}
        />
        <DisplayToggle
          id="quote-display-line-total"
          label="Line total"
          helper="The quote total stays visible."
          checked={options.show_line_total}
          disabled={disabled}
          onCheckedChange={(checked) => toggle({ show_line_total: checked })}
        />
      </fieldset>
      <p
        className="text-xs text-muted-foreground"
        data-quote-display-preview
      >
        Client will see: {formatQuoteDisplayPreview(options)}
      </p>
      <p className="text-xs text-muted-foreground">
        This changes the client quote only. Your Pricing and quote totals stay
        the same.
      </p>
    </div>
  );
}

function DisplayToggle({
  id,
  label,
  helper,
  checked,
  disabled,
  locked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  helper?: string;
  checked: boolean;
  disabled?: boolean;
  locked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        aria-disabled={disabled || locked ? true : undefined}
        onCheckedChange={(value) => {
          if (locked || disabled) return;
          onCheckedChange?.(value === true);
        }}
      />
      <label
        htmlFor={id}
        className={cn(
          "min-w-0 text-xs leading-snug",
          disabled && "cursor-not-allowed text-muted-foreground"
        )}
      >
        <span className="font-medium text-foreground">{label}</span>
        {locked ? (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            Always shown
          </span>
        ) : null}
        {helper ? (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {helper}
          </span>
        ) : null}
      </label>
    </div>
  );
}
