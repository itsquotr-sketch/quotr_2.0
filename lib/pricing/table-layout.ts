export const PRICING_TABLE_GRID_COLS =
  "lg:grid-cols-[1.5rem_minmax(0,1.6fr)_minmax(4.5rem,0.7fr)_minmax(3.5rem,0.5fr)_minmax(4.5rem,0.65fr)_minmax(4.5rem,0.7fr)_minmax(4rem,0.55fr)_auto]";

export const PRICING_TABLE_GRID =
  `grid gap-x-3 gap-y-1 px-3 py-3 ${PRICING_TABLE_GRID_COLS} lg:items-center`;

export const PRICING_TABLE_HEADER_CLASS = `hidden gap-x-3 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid ${PRICING_TABLE_GRID_COLS} lg:items-center`;

export const PRICING_TABLE_GRID_COLS_READONLY =
  "lg:grid-cols-[minmax(0,1.6fr)_minmax(4.5rem,0.7fr)_minmax(3.5rem,0.5fr)_minmax(4.5rem,0.65fr)_minmax(4.5rem,0.7fr)_minmax(4rem,0.55fr)]";

export const PRICING_TABLE_GRID_READONLY =
  `grid gap-x-3 gap-y-1 px-3 py-3 ${PRICING_TABLE_GRID_COLS_READONLY} lg:items-center`;

export const PRICING_TABLE_HEADER_READONLY_CLASS = `hidden gap-x-3 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid ${PRICING_TABLE_GRID_COLS_READONLY} lg:items-center`;
