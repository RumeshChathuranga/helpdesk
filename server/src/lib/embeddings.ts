import {
  env as transformersEnv,
  AutoTokenizer,
  pipeline,
  type FeatureExtractionPipeline,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";
import { ALLOW_REMOTE_MODELS, MODEL_CACHE_DIR } from "../config.js";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

// Must run before the first pipeline()/from_pretrained() call. Unset cache dir
// keeps the library default, which is what dev wants; the release image bakes
// weights in and sets ALLOW_REMOTE_MODELS=false so a missing bake fails loudly
// rather than silently pulling 87 MB from the HF Hub after every deploy.
if (MODEL_CACHE_DIR) transformersEnv.cacheDir = MODEL_CACHE_DIR;
transformersEnv.allowRemoteModels = ALLOW_REMOTE_MODELS;

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

/** Token counter backed by the model's own tokenizer, so chunk sizing measures
 *  the units the model actually truncates on. Cached process-wide. */
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

/** Loads tokenizer + pipeline into MODEL_CACHE_DIR. Run at image build time so
 *  no request pays the download. */
export async function warmEmbeddingModel(): Promise<void> {
  await getTokenCounter();
  await embedText("warmup");
}
