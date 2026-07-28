import { KB_CHUNK_MAX_TOKENS, KB_CHUNK_OVERLAP_TOKENS } from "../config.js";

/**
 * Structure-aware text splitter for the knowledge base.
 *
 * The embedding model has a hard 256-token window: text beyond it is dropped at
 * embed time, so a long article stored as one row is mostly unretrievable. This
 * splits source text into overlapping passages that each fit the window.
 *
 * Splitting walks from the largest natural boundary down to the smallest, so a
 * chunk breaks between paragraphs where it can and only falls back to sentence,
 * word and finally character boundaries when a single unit is itself too big.
 *
 * Pure and synchronous — the token counter is injected so callers can pass the
 * real tokenizer (see `getTokenCounter`) while tests use a deterministic stub.
 */

export interface ChunkTextOptions {
  /** Hard upper bound per chunk. Defaults to KB_CHUNK_MAX_TOKENS. */
  maxTokens?: number;
  /** Tokens carried over from the previous chunk. Defaults to KB_CHUNK_OVERLAP_TOKENS. */
  overlapTokens?: number;
  /** A trailing chunk smaller than this is merged back into its predecessor. */
  minTokens?: number;
  /** Token counter. Defaults to a word-count heuristic. */
  countTokens?: (text: string) => number;
}

const DEFAULT_MIN_TOKENS = 20;

/**
 * Rough token estimate for callers that have no tokenizer — subword models emit
 * a bit more than one token per whitespace word.
 */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

/** A leaf of the split hierarchy, kept with its token count so packing is O(n). */
interface Unit {
  text: string;
  tokens: number;
  /** Separator to use when joining this unit to the previous one. */
  separator: string;
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits `text` into pieces that each fit `maxTokens`, trying coarse boundaries first. */
function splitToUnits(
  text: string,
  maxTokens: number,
  countTokens: (text: string) => number,
): Unit[] {
  const units: Unit[] = [];

  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    const separator = paragraphIndex === 0 ? "" : "\n\n";
    const tokens = countTokens(paragraph);

    if (tokens <= maxTokens) {
      units.push({ text: paragraph, tokens, separator });
      continue;
    }

    // Paragraph too large — break on sentence ends, keeping the punctuation.
    const sentences = paragraph.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g) ?? [paragraph];
    for (const [sentenceIndex, rawSentence] of sentences.entries()) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;

      const sentenceSeparator =
        paragraphIndex > 0 && sentenceIndex === 0 ? "\n\n" : sentenceIndex === 0 ? "" : " ";
      const sentenceTokens = countTokens(sentence);

      if (sentenceTokens <= maxTokens) {
        units.push({ text: sentence, tokens: sentenceTokens, separator: sentenceSeparator });
        continue;
      }

      // Sentence too large — drop to word units. Emitting individual words
      // (rather than pre-packed slices) keeps the packing loop below in charge
      // of both chunk size and overlap, so overlap still works mid-sentence,
      // which is exactly where a boundary is most arbitrary.
      let isFirstUnit = true;
      const pushUnit = (text: string) => {
        units.push({
          text,
          tokens: countTokens(text),
          separator: isFirstUnit ? sentenceSeparator : " ",
        });
        isFirstUnit = false;
      };

      for (const word of sentence.split(/\s+/).filter(Boolean)) {
        const wordTokens = countTokens(word);

        // A single word over the limit (a URL, a base64 blob) — hard-slice it so
        // the loop can always make progress.
        if (wordTokens > maxTokens) {
          const sliceLength = Math.max(
            1,
            Math.floor((word.length * maxTokens) / wordTokens),
          );
          for (let i = 0; i < word.length; i += sliceLength) {
            pushUnit(word.slice(i, i + sliceLength));
          }
          continue;
        }

        pushUnit(word);
      }
    }
  }

  return units;
}

function joinUnits(units: Unit[]): string {
  return units
    .map((unit, index) => (index === 0 ? unit.text : `${unit.separator}${unit.text}`))
    .join("")
    .trim();
}

/**
 * Splits `text` into overlapping chunks that each fit within `maxTokens`.
 * Returns `[]` for empty or whitespace-only input.
 */
export function chunkText(text: string, options: ChunkTextOptions = {}): string[] {
  const {
    maxTokens = KB_CHUNK_MAX_TOKENS,
    overlapTokens = KB_CHUNK_OVERLAP_TOKENS,
    minTokens = DEFAULT_MIN_TOKENS,
    countTokens = estimateTokens,
  } = options;

  const normalized = normalize(text);
  if (!normalized) {
    return [];
  }

  // Overlap must leave room for forward progress, otherwise a chunk could be
  // rebuilt entirely from the previous one's tail and the loop would stall.
  const effectiveOverlap = Math.min(overlapTokens, Math.floor(maxTokens / 2));

  const units = splitToUnits(normalized, maxTokens, countTokens);
  if (units.length === 0) {
    return [];
  }

  const chunks: Unit[][] = [];
  let current: Unit[] = [];
  let currentTokens = 0;

  for (const unit of units) {
    if (current.length > 0 && currentTokens + unit.tokens > maxTokens) {
      chunks.push(current);

      // Seed the next chunk with the tail of this one, up to the overlap budget.
      const carried: Unit[] = [];
      let carriedTokens = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const candidate = current[i]!;
        if (carriedTokens + candidate.tokens > effectiveOverlap) break;
        carried.unshift(candidate);
        carriedTokens += candidate.tokens;
      }

      current = [...carried];
      currentTokens = carriedTokens;
    }

    current.push(unit);
    currentTokens += unit.tokens;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  // A tiny trailing chunk carries no standalone meaning — fold it back in when
  // the merged chunk still fits.
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1]!;
    const previous = chunks[chunks.length - 2]!;
    const lastTokens = last.reduce((sum, unit) => sum + unit.tokens, 0);

    if (lastTokens < minTokens) {
      const newUnits = last.filter((unit) => !previous.includes(unit));
      const mergedTokens =
        previous.reduce((sum, unit) => sum + unit.tokens, 0) +
        newUnits.reduce((sum, unit) => sum + unit.tokens, 0);

      if (mergedTokens <= maxTokens + minTokens) {
        previous.push(...newUnits);
        chunks.pop();
      }
    }
  }

  return chunks.map(joinUnits).filter((chunk) => chunk.length > 0);
}
