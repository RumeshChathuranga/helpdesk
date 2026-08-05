import { mock } from "bun:test";

/**
 * Single shared `@huggingface/transformers` mock, imported by every test file
 * that would otherwise load the real MiniLM pipeline.
 *
 * Two reasons this lives here rather than inline in a test file:
 *
 * 1. `bun test` shares one module registry across files, so a `mock.module`
 *    call anywhere is global — the same hazard documented in mockAi.ts.
 * 2. The factory must export the *complete* surface src/lib/embeddings.ts
 *    imports (`pipeline`, `env`, `AutoTokenizer`). When the mock happens to
 *    register before any file has loaded the real module, Bun serves this
 *    object as the module itself, and a missing key is a hard link error
 *    ("Export named 'AutoTokenizer' not found") in every file that transitively
 *    imports embeddings.ts. Whether that happens depends on test file order,
 *    so an incomplete mock passes locally and fails in CI. Keep this in sync
 *    with embeddings.ts's import list.
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
  // embeddings.ts writes to these at module load; a plain mutable object is
  // all it needs.
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
