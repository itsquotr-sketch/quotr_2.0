export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** GST and GST-inclusive Estimate figures. Keeps cents so display rounding cannot diverge from F-GST. */
export function formatCurrencyCents(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrencyRange(low: number, high: number) {
  return `${formatCurrency(low)} – ${formatCurrency(high)}`;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
