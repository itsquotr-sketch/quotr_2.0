import { isPerf01AInstrumentationEnabled } from "@/lib/perf/perf-01a";

const isDev = process.env.NODE_ENV === "development";

function shouldLogServerLoad(): boolean {
  return isDev || isPerf01AInstrumentationEnabled();
}

export async function measureServerLoad<T>(
  label: string,
  loader: () => Promise<T>
): Promise<T> {
  if (!shouldLogServerLoad()) {
    return loader();
  }

  const start = performance.now();
  try {
    return await loader();
  } finally {
    const durationMs = Math.round(performance.now() - start);
    const prefix = isPerf01AInstrumentationEnabled() ? "[perf-01a]" : "[perf]";
    console.info(`${prefix} ${label}: ${durationMs}ms`);
  }
}
