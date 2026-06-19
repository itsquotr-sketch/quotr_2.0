"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  testClaudeConnection,
  type ClaudeConnectionTestResult,
} from "@/lib/ai/test-action";

export function AiTestPanel() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ClaudeConnectionTestResult | null>(null);

  async function handleTest() {
    setPending(true);
    setResult(null);

    try {
      const testResult = await testClaudeConnection();
      setResult(testResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          AI connection test
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This page tests the server-side Anthropic connection. It is disabled
          in production.
        </p>
      </div>

      <Button type="button" onClick={handleTest} disabled={pending}>
        {pending ? "Testing…" : "Test Claude connection"}
      </Button>

      {result ? (
        <div
          className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm"
          role="status"
        >
          <p>
            <span className="font-medium">Success:</span>{" "}
            {result.success ? "Yes" : "No"}
          </p>
          {result.model ? (
            <p>
              <span className="font-medium">Model:</span> {result.model}
            </p>
          ) : null}
          {result.responseText ? (
            <p>
              <span className="font-medium">Response:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                {result.responseText}
              </code>
            </p>
          ) : null}
          {result.error ? (
            <p className="text-destructive">
              <span className="font-medium">Error:</span> {result.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
