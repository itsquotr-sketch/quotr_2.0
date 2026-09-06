/**
 * Client quote display options — presentation only.
 *
 * Stored as `issuer_snapshot.display_options` on the quotes row (existing JSONB).
 * Draft-editable. Frozen with the issued snapshot. No schema migration.
 *
 * Description is always shown and is not stored as a toggle.
 */

export type QuoteDisplayOptions = {
  show_quantity: boolean;
  show_unit: boolean;
  show_unit_price: boolean;
  show_line_total: boolean;
};

export type QuoteDisplayColumn =
  | "description"
  | "quantity"
  | "unit"
  | "unit_price"
  | "line_total";

/** New Quote drafts. Not applied retroactively to issued Quotes without settings. */
export const NEW_QUOTE_DISPLAY_OPTIONS: QuoteDisplayOptions = {
  show_quantity: true,
  show_unit: true,
  show_unit_price: false,
  show_line_total: true,
};

/**
 * Issued Quotes without display_options keep today's renderer:
 * Description, Qty, Unit, Unit price, Line total.
 */
export const LEGACY_QUOTE_DISPLAY_OPTIONS: QuoteDisplayOptions = {
  show_quantity: true,
  show_unit: true,
  show_unit_price: true,
  show_line_total: true,
};

export const QUOTE_DISPLAY_COLUMN_LABELS: Record<QuoteDisplayColumn, string> = {
  description: "Description",
  quantity: "Quantity",
  unit: "Unit",
  unit_price: "Unit price",
  line_total: "Line total",
};

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeQuoteDisplayOptions(
  input: QuoteDisplayOptions
): QuoteDisplayOptions {
  const show_quantity = input.show_quantity === true;
  return {
    show_quantity,
    show_unit: show_quantity && input.show_unit === true,
    show_unit_price: input.show_unit_price === true,
    show_line_total: input.show_line_total === true,
  };
}

export function parseQuoteDisplayOptionsObject(
  value: unknown
): QuoteDisplayOptions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const hasKnownKey =
    "show_quantity" in row ||
    "show_unit" in row ||
    "show_unit_price" in row ||
    "show_line_total" in row;
  if (!hasKnownKey) return null;
  return normalizeQuoteDisplayOptions({
    show_quantity: asBoolean(row.show_quantity, NEW_QUOTE_DISPLAY_OPTIONS.show_quantity),
    show_unit: asBoolean(row.show_unit, NEW_QUOTE_DISPLAY_OPTIONS.show_unit),
    show_unit_price: asBoolean(
      row.show_unit_price,
      NEW_QUOTE_DISPLAY_OPTIONS.show_unit_price
    ),
    show_line_total: asBoolean(
      row.show_line_total,
      NEW_QUOTE_DISPLAY_OPTIONS.show_line_total
    ),
  });
}

/** Read display_options from raw issuer_snapshot JSON (or a direct options object). */
export function parseQuoteDisplayOptions(
  issuerSnapshot: unknown
): QuoteDisplayOptions | null {
  if (!issuerSnapshot || typeof issuerSnapshot !== "object" || Array.isArray(issuerSnapshot)) {
    return null;
  }
  const row = issuerSnapshot as Record<string, unknown>;
  if ("display_options" in row) {
    return parseQuoteDisplayOptionsObject(row.display_options);
  }
  return parseQuoteDisplayOptionsObject(row);
}

/**
 * Missing settings → historical renderer (unit price ON).
 * Present settings → stored snapshot, with Quantity/Unit coherence.
 */
export function resolveQuoteDisplayOptions(
  quote: { display_options?: QuoteDisplayOptions | null } | null | undefined
): QuoteDisplayOptions {
  if (!quote?.display_options) {
    return { ...LEGACY_QUOTE_DISPLAY_OPTIONS };
  }
  return normalizeQuoteDisplayOptions(quote.display_options);
}

export function visibleQuoteDisplayColumns(
  options: QuoteDisplayOptions
): QuoteDisplayColumn[] {
  const normalized = normalizeQuoteDisplayOptions(options);
  const columns: QuoteDisplayColumn[] = ["description"];
  if (normalized.show_quantity) columns.push("quantity");
  if (normalized.show_unit) columns.push("unit");
  if (normalized.show_unit_price) columns.push("unit_price");
  if (normalized.show_line_total) columns.push("line_total");
  return columns;
}

export function formatQuoteDisplayPreview(
  options: QuoteDisplayOptions
): string {
  return visibleQuoteDisplayColumns(options)
    .map((column) => QUOTE_DISPLAY_COLUMN_LABELS[column])
    .join(" · ");
}

export function applyQuantityUnitCoherence(
  options: QuoteDisplayOptions,
  next: Partial<QuoteDisplayOptions>
): QuoteDisplayOptions {
  const merged: QuoteDisplayOptions = {
    ...normalizeQuoteDisplayOptions(options),
    ...next,
  };
  if (next.show_quantity === false) {
    merged.show_unit = false;
  }
  if (merged.show_quantity === false) {
    merged.show_unit = false;
  }
  return normalizeQuoteDisplayOptions(merged);
}

export function issuerSnapshotWithDisplayOptions(
  issuer: Record<string, unknown> | null | undefined,
  options: QuoteDisplayOptions | null | undefined
): Record<string, unknown> {
  const row: Record<string, unknown> = issuer ? { ...issuer } : {};
  if (options) {
    row.display_options = normalizeQuoteDisplayOptions(options);
  }
  return row;
}

export function quoteDisplayOptionsEqual(
  a: QuoteDisplayOptions,
  b: QuoteDisplayOptions
): boolean {
  const left = normalizeQuoteDisplayOptions(a);
  const right = normalizeQuoteDisplayOptions(b);
  return (
    left.show_quantity === right.show_quantity &&
    left.show_unit === right.show_unit &&
    left.show_unit_price === right.show_unit_price &&
    left.show_line_total === right.show_line_total
  );
}
