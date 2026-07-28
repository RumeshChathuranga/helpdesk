import { describe, expect, it } from "bun:test";
import { chunkText, estimateTokens } from "./chunkText.js";

// One token per whitespace word keeps the arithmetic in these tests obvious and
// independent of the real tokenizer (which would need the model downloaded).
const countTokens = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

const words = (n: number, prefix = "w") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

const options = { countTokens, maxTokens: 10, overlapTokens: 3, minTokens: 2 };

describe("chunkText", () => {
  it("returns nothing for empty or whitespace-only input", () => {
    expect(chunkText("", options)).toEqual([]);
    expect(chunkText("   \n\n  \t ", options)).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    expect(chunkText("Reset your password from the login page.", options)).toEqual([
      "Reset your password from the login page.",
    ]);
  });

  it("never emits a chunk over maxTokens", () => {
    const chunks = chunkText(words(200), options);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(countTokens(chunk)).toBeLessThanOrEqual(options.maxTokens);
    }
  });

  it("carries overlap from the tail of the previous chunk", () => {
    const chunks = chunkText(words(40), options);

    expect(chunks.length).toBeGreaterThan(1);

    const firstWords = chunks[0]!.split(" ");
    const secondWords = chunks[1]!.split(" ");
    const tail = firstWords.slice(-1)[0]!;

    // The last word of chunk 1 reappears at the start of chunk 2.
    expect(secondWords).toContain(tail);
  });

  it("prefers paragraph boundaries when the text fits", () => {
    const text = `${words(6, "a")}\n\n${words(6, "b")}`;
    const chunks = chunkText(text, options);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(words(6, "a"));
    expect(chunks[1]).toContain(words(6, "b"));
  });

  it("splits an oversized paragraph on sentence boundaries", () => {
    const text = `${words(8, "a")}. ${words(8, "b")}. ${words(8, "c")}.`;
    const chunks = chunkText(text, options);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(countTokens(chunk)).toBeLessThanOrEqual(options.maxTokens);
    }
    // No content is lost.
    expect(chunks.join(" ")).toContain("c7");
  });

  it("hard-slices a single token that exceeds maxTokens", () => {
    // Counted as one word by our stub, so force the count to exceed the budget.
    const giant = "x".repeat(500);
    const chunks = chunkText(giant, {
      ...options,
      countTokens: (text) => Math.ceil(text.replace(/\s/g, "").length / 10),
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(giant);
  });

  it("merges a runt trailing chunk into its predecessor", () => {
    // 11 words with a 10-token budget would otherwise leave a 1-word tail.
    const chunks = chunkText(words(11), { ...options, overlapTokens: 0 });

    expect(chunks).toHaveLength(1);
    expect(countTokens(chunks[0]!)).toBe(11);
  });

  it("normalizes line endings and collapses blank runs", () => {
    const chunks = chunkText("alpha\r\n\r\n\r\n\r\nbeta", options);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("alpha\n\nbeta");
  });

  it("terminates and covers the input for long realistic text", () => {
    const paragraphs = Array.from(
      { length: 12 },
      (_, i) => `Paragraph ${i}. ${words(30, `p${i}w`)}.`,
    ).join("\n\n");

    const chunks = chunkText(paragraphs, options);
    const joined = chunks.join(" ");

    expect(chunks.length).toBeGreaterThan(1);
    expect(joined).toContain("p0w0");
    expect(joined).toContain("p11w29");
  });
});

describe("estimateTokens", () => {
  it("scales with word count and returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("one two three")).toBe(4); // ceil(3 * 1.3)
  });
});
