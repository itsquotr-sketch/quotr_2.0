import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic";

function getTextFromResponse(content: Anthropic.Message["content"]): string {
  const textBlock = content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic response did not contain text.");
  }
  return textBlock.text.trim();
}

/**
 * Local developer smoke test for Anthropic connectivity.
 * Not wired to routes or client code — invoke manually from a server script.
 */
export async function testAnthropicConnection(): Promise<string> {
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: getAnthropicModel(),
    max_tokens: 64,
    messages: [{ role: "user", content: "Reply with only: ok" }],
  });

  return getTextFromResponse(message.content);
}
