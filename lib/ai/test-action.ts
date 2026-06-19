"use server";

import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic";

export type ClaudeConnectionTestResult = {
  success: boolean;
  model?: string;
  responseText?: string;
  error?: string;
};

export async function testClaudeConnection(): Promise<ClaudeConnectionTestResult> {
  if (process.env.NODE_ENV === "production") {
    return {
      success: false,
      error: "AI smoke test is disabled in production.",
    };
  }

  const model = getAnthropicModel();

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with only the word: ok" }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const responseText =
      textBlock?.type === "text" ? textBlock.text.trim() : "";

    return {
      success: true,
      model,
      responseText,
    };
  } catch (error) {
    return {
      success: false,
      model,
      error: error instanceof Error ? error.message : "Unknown error.",
    };
  }
}
