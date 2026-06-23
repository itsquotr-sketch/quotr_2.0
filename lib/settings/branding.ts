/** Validates and returns a safe CSS hex colour, or null if invalid. */
export function sanitizeBrandColour(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function getBrandColours(settings: {
  brandPrimaryColour?: string | null;
  brandAccentColour?: string | null;
} | null): {
  primary: string | null;
  accent: string | null;
} {
  if (!settings) {
    return { primary: null, accent: null };
  }
  return {
    primary: sanitizeBrandColour(settings.brandPrimaryColour),
    accent: sanitizeBrandColour(settings.brandAccentColour),
  };
}

/** Light tint for backgrounds/borders — falls back to neutral grey. */
export function brandColourTint(colour: string | null, alpha = "26"): string {
  if (!colour) return "rgb(0 0 0 / 0.08)";
  if (colour.length === 4) {
    const r = colour[1];
    const g = colour[2];
    const b = colour[3];
    return `#${r}${r}${g}${g}${b}${b}${alpha}`;
  }
  return `${colour}${alpha}`;
}
