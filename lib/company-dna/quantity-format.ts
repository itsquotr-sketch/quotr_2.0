/**
 * DNA-V2D — builder-facing quantity presentation.
 * Does not change authority quantities, benchmarks, or estimator math.
 */

export function formatDnaScenarioQuantity(value: number): {
  display: string;
  about: boolean;
} {
  if (!Number.isFinite(value)) {
    return { display: String(value), about: false };
  }
  const nearestInt = Math.round(value);
  if (Math.abs(value - nearestInt) < 1e-6) {
    return { display: String(nearestInt), about: false };
  }
  const oneDecimal = Math.round(value * 10) / 10;
  if (Math.abs(value - oneDecimal) < 1e-6) {
    return {
      display: Number.isInteger(oneDecimal)
        ? String(oneDecimal)
        : oneDecimal.toFixed(1),
      about: false,
    };
  }
  return { display: String(nearestInt), about: true };
}

export function formatDnaQuantityUnit(
  unit: string,
  plural: boolean
): string {
  if (unit === "lm") return plural ? "lineal metres" : "lineal metre";
  if (unit === "m2") return "m²";
  if (unit === "bag") return plural ? "bags" : "bag";
  if (unit === "post") return plural ? "posts" : "post";
  if (unit === "gate") return plural ? "gates" : "gate";
  if (unit === "section") return plural ? "fence sections" : "fence section";
  if (unit === "ea") return "each";
  return unit;
}

export function formatDnaScenarioMeasure(value: number, unit: string): string {
  const qty = formatDnaScenarioQuantity(value);
  const numeric = Number(qty.display);
  const plural = !Number.isFinite(numeric) || numeric !== 1;
  const measure = `${qty.display} ${formatDnaQuantityUnit(unit, plural)}`;
  return qty.about ? `about ${measure}` : measure;
}

export function formatDnaProductivityHours(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  const decimals = Math.abs(value) >= 0.1 ? 2 : 3;
  return String(Number(value.toFixed(decimals)));
}
