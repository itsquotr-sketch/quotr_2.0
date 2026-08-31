/** Explicit opt-in for scripts that would otherwise call a paid model. */
export const RUN_LIVE_AI_TESTS_ENV = "RUN_LIVE_AI_TESTS";
export const RUN_LIVE_AI_TESTS_VALUE = "1";

export function shouldRunLiveAiTests(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return env[RUN_LIVE_AI_TESTS_ENV] === RUN_LIVE_AI_TESTS_VALUE;
}

export function logLiveAiSkip(scriptName: string, estimatedCalls: number): void {
  console.log(
    `${scriptName}: SKIP live AI (set ${RUN_LIVE_AI_TESTS_ENV}=${RUN_LIVE_AI_TESTS_VALUE} to enable). Estimated paid calls: ${estimatedCalls}.`
  );
}
