export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Unit rates keep cents. $2.50 stays $2.50; a whole-dollar rate stays $40. */
export function formatUnitRate(value: number) {
  const cents = Math.round(value * 100) / 100;
  const hasCents = Math.abs(cents - Math.trunc(cents)) >= 0.001;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents);
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
