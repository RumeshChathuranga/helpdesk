import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

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

/** Generates a normalized mean-pooled embedding for `text` using a process-wide cached pipeline. */
export async function embedText(text: string): Promise<EmbedTextResult> {
  const extractor = await getEmbedder();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  const embeddingArray = Array.from(output.tolist()[0] as number[]);
  const vectorString = `[${embeddingArray.join(",")}]`;
  return { embeddingArray, vectorString };
}
