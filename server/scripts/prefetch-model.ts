import { warmEmbeddingModel } from "../src/lib/embeddings.js";

console.log("Prefetching embedding model into MODEL_CACHE_DIR...");
await warmEmbeddingModel();
console.log("Done.");
