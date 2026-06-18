export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyRange(low: number, high: number) {
  return `${formatCurrency(low)} – ${formatCurrency(high)}`;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
