const isDev = process.env.NODE_ENV === "development";

export async function measureServerLoad<T>(
  label: string,
  loader: () => Promise<T>
): Promise<T> {
  if (!isDev) {
    return loader();
  }

  const start = performance.now();
  try {
    return await loader();
  } finally {
    const durationMs = Math.round(performance.now() - start);
    console.info(`[perf] ${label}: ${durationMs}ms`);
  }
}
