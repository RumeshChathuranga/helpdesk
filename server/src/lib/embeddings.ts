import {
  AutoTokenizer,
  pipeline,
  type FeatureExtractionPipeline,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

/** Texts per forward pass. Bounds peak memory when embedding a chunked document. */
const EMBEDDING_BATCH_SIZE = 16;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
let tokenizerPromise: Promise<PreTrainedTokenizer> | null = null;

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline("feature-extraction", MODEL_NAME);
  }
  return pipelinePromise;
}

export interface EmbedTextResult {
  embeddingArray: number[];
  /** Postgres pgvector literal, e.g. "[0.1,0.2,...]" — ready for `${vectorString}::vector` in raw queries. */
  vectorString: string;
}

/**
 * Returns a token counter backed by the embedding model's own tokenizer, so
 * chunk sizing measures the same units the model truncates on. The tokenizer
 * loads from the same cached model repo as the pipeline; the promise is cached
 * process-wide the same way.
 */
export async function getTokenCounter(): Promise<(text: string) => number> {
  if (!tokenizerPromise) {
    tokenizerPromise = AutoTokenizer.from_pretrained(MODEL_NAME);
  }
  const tokenizer = await tokenizerPromise;
  return (text: string) => tokenizer.encode(text).length;
}

/** Generates normalized mean-pooled embeddings for `texts`, in batches. */
export async function embedTexts(texts: string[]): Promise<EmbedTextResult[]> {
  if (texts.length === 0) {
    return [];
  }

  const extractor = await getEmbedder();
  const results: EmbedTextResult[] = [];

  for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const output = await extractor(batch, { pooling: "mean", normalize: true });

    for (const row of output.tolist() as number[][]) {
      const embeddingArray = Array.from(row);
      results.push({
        embeddingArray,
        vectorString: `[${embeddingArray.join(",")}]`,
      });
    }
  }

  return results;
}

/** Generates a normalized mean-pooled embedding for `text`. */
export async function embedText(text: string): Promise<EmbedTextResult> {
  const [result] = await embedTexts([text]);
  if (!result) {
    throw new Error("Embedding pipeline returned no vector");
  }
  return result;
}
