/**
 * Stable phrase in each AI system prompt so mockAi.ts can dispatch without
 * matching full wording. Keep the tag when editing a prompt; add one here plus
 * a mockAi branch when adding an AI call.
 */
export const PROMPT_TAG = {
  classify: "helpdesk ticket classifier",
  resolve: "resolve support tickets using the knowledge base",
  summarize: "helpdesk summarization assistant",
  polish: "helpdesk agent assistant",
} as const;
