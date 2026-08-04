/** Golden fixture support types — scenarios not migrated in 2B.3A. */

export type GoldenLineExpectation = {
  readonly scenario_id: string;
  readonly mode: "quantity_rate" | "productivity_labour" | "lump_sum";
  readonly expected_cost: number;
  readonly expected_sell: number;
  readonly expected_gross_profit: number;
  readonly expected_gross_margin_percent: number;
  readonly expected_markup_percent?: number;
  readonly tolerance?: number;
};

export type GoldenCompareReport = {
  readonly scenario_id: string;
  readonly pass: boolean;
  readonly differences: readonly {
    readonly field: string;
    readonly expected: number;
    readonly actual: number;
    readonly delta: number;
  }[];
};
