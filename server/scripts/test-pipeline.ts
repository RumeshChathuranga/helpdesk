import { pipeline } from "@huggingface/transformers";

async function run() {
  console.log("Starting pipeline download...");
  try {
    const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      progress_callback: (info: any) => {
        if (info.status === 'progress') {
          process.stdout.write(`\rDownloading ${info.file}: ${Math.round(info.progress)}%`);
        } else {
          console.log(`\n${info.status}: ${info.file || ''}`);
        }
      }
    });
    console.log("\nPipeline downloaded successfully.");
    const out = await extractor("Test");
    console.log("Extraction complete.", out.dims);
  } catch (err) {
    console.error("Pipeline failed:", err);
  }
}

run();
