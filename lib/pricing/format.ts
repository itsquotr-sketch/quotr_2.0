export function formatPricingMoney(value: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPricingPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatPricingDate(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}
