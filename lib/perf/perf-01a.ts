/**
 * PERFORMANCE-01A — lightweight Preview/dev timing helper.
 *
 * Observational only. No secrets. No PII. No Production logging.
 * Easy to remove or keep gated. Labelled [perf-01a].
 */

export function isPerf01AInstrumentationEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return (
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "preview"
  );
}

export async function measurePerf01A<T>(
  label: string,
  loader: () => Promise<T>,
  meta?: { queries?: number; waves?: number; duplicates?: number }
): Promise<T> {
  if (!isPerf01AInstrumentationEnabled()) {
    return loader();
  }

  const start = performance.now();
  try {
    return await loader();
  } finally {
    const durationMs = Math.round(performance.now() - start);
    const extras = [
      meta?.queries != null ? `queries=${meta.queries}` : null,
      meta?.waves != null ? `waves=${meta.waves}` : null,
      meta?.duplicates != null ? `dups=${meta.duplicates}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    console.info(
      `[perf-01a] ${label}: ${durationMs}ms${extras ? ` ${extras}` : ""}`
    );
  }
}
