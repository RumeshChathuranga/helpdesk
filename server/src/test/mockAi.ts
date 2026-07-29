import { mock } from "bun:test";
import { PROMPT_TAG } from "../lib/ai/promptTags.js";

/**
 * Single shared `ai` / `@ai-sdk/openai-compatible` mock, imported by every
 * test file that needs to stub `generateText` (tickets.test.ts,
 * processTicket.test.ts, ...).
 *
 * `bun test` runs all test files in one process and shares the module
 * registry, so if two files each called `mock.module("ai", ...)`
 * independently, whichever call happened to be "live" last would silently
 * win for every file's dynamic `await import(...)` — a real risk of one
 * suite's test bleeding into another's. Registering the mock exactly once
 * here (this module itself is only evaluated once, per normal ESM caching)
 * and dispatching by a recognizable substring of the `system` prompt keeps
 * every caller's mock behavior independent and deterministic regardless of
 * file load/run order.
 */

export const aiMockState = {
  polishedText: "Please assist me.",
  summaryText: "• Summary bullet.",
  classificationCategory: "OTHER" as string,
  resolution: { resolved: false as boolean, reply: undefined as string | undefined },
  resolutionCallCount: 0,
};

export function resetAiMockState(): void {
  aiMockState.polishedText = "Please assist me.";
  aiMockState.summaryText = "• Summary bullet.";
  aiMockState.classificationCategory = "OTHER";
  aiMockState.resolution = { resolved: false, reply: undefined };
  aiMockState.resolutionCallCount = 0;
}

mock.module("ai", () => ({
  generateText: async ({ system }: { system?: string }) => {
    if (system?.includes(PROMPT_TAG.classify)) {
      return {
        text: JSON.stringify({ category: aiMockState.classificationCategory }),
      };
    }
    if (system?.includes(PROMPT_TAG.resolve)) {
      aiMockState.resolutionCallCount += 1;
      return { text: JSON.stringify(aiMockState.resolution) };
    }
    if (system?.includes(PROMPT_TAG.summarize)) {
      return { text: aiMockState.summaryText };
    }
    if (system?.includes(PROMPT_TAG.polish)) {
      return { text: aiMockState.polishedText };
    }
    throw new Error(
      `mockAi: unrecognised system prompt — add a PROMPT_TAG branch. Got: ${system?.slice(0, 120)}`,
    );
  },
}));

mock.module("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: () => () => ({}),
}));
