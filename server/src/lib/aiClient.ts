import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { AI_BASE_URL, AI_MODEL } from "../config.js";

/** Message returned to agents when the AI credential is missing. */
export const AI_TOKEN_MISSING_MESSAGE = "GitHub Models token is not configured";

/**
 * Returns null when no API key is set, so callers pick their own failure mode
 * (500 in routes, throw-and-escalate in the worker). Built per call rather than
 * at module load, because mockAi.ts swaps the provider module at runtime.
 */
export function getAiModel(
  apiKey: string | undefined = process.env.GITHUB_MODELS_TOKEN,
): LanguageModel | null {
  if (!apiKey) return null;
  return createOpenAICompatible({
    name: "github-models",
    apiKey,
    baseURL: AI_BASE_URL,
  })(AI_MODEL);
}
