/**
 * Stable phrase embedded in each AI system prompt, used by
 * server/src/test/mockAi.ts to dispatch without depending on full prompt
 * wording. When editing a prompt, keep its tag substring; when adding a new
 * AI call, add a tag here and a matching branch in mockAi.ts.
 */
export const PROMPT_TAG = {
  classify: "helpdesk ticket classifier",
  resolve: "resolve support tickets using the knowledge base",
  summarize: "helpdesk summarization assistant",
  polish: "helpdesk agent assistant",
} as const;
