import { mock } from "bun:test";

/**
 * Shared `@huggingface/transformers` mock — `mock.module` is global across the
 * whole `bun test` run, same hazard as mockAi.ts. Must export everything
 * embeddings.ts imports: a missing key is a link error, not an undefined, and
 * whether it bites depends on file order. Keep in sync with that import list.
 */

export const EMBED_DIM = 384;

/**
 * A normalized (magnitude 1) fixed vector, so cosine similarity against an
 * identical KnowledgeChunk row is exactly 1 — comfortably over the 0.75
 * resolution threshold — without needing a real embedding model.
 */
export const FIXED_EMBEDDING = Array(EMBED_DIM).fill(1 / Math.sqrt(EMBED_DIM));

/** pgvector literal for FIXED_EMBEDDING, ready for `${...}::vector`. */
export const FIXED_VECTOR_STRING = `[${FIXED_EMBEDDING.join(",")}]`;

/** One token per whitespace word — same convention as chunkText.test.ts. */
const fakeEncode = (text: string): string[] =>
  text.trim().split(/\s+/).filter(Boolean);

mock.module("@huggingface/transformers", () => ({
  // embeddings.ts writes to these at load.
  env: { cacheDir: undefined as string | undefined, allowRemoteModels: false },

  AutoTokenizer: {
    from_pretrained: async () => ({ encode: fakeEncode }),
  },

  pipeline: async () => async (texts: string | string[], _opts?: unknown) => {
    // embedTexts() feeds batches and reads one row per input text.
    const batch = Array.isArray(texts) ? texts : [texts];
    return { tolist: () => batch.map(() => FIXED_EMBEDDING) };
  },
}));
