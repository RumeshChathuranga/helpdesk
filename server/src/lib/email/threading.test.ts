import { describe, expect, it } from "bun:test";
import { buildReplySubject, buildThreadHeaders } from "./threading.js";

describe("buildReplySubject", () => {
  it("adds a Re: prefix to a plain subject", () => {
    expect(buildReplySubject("Billing question")).toBe("Re: Billing question");
  });

  it("collapses a repeated Re: Re: prefix to one", () => {
    expect(buildReplySubject("Re: Re: Billing question")).toBe("Re: Billing question");
  });

  it("collapses RE: (any case) and Re[2]: forms", () => {
    expect(buildReplySubject("RE: Billing question")).toBe("Re: Billing question");
    expect(buildReplySubject("Re[2]: Billing question")).toBe("Re: Billing question");
    expect(buildReplySubject("re : Billing question")).toBe("Re: Billing question");
  });

  it("falls back to a placeholder for an empty subject", () => {
    expect(buildReplySubject("")).toBe("Re: (no subject)");
    expect(buildReplySubject("Re:")).toBe("Re: (no subject)");
  });
});

describe("buildThreadHeaders", () => {
  it("returns no headers when there is no ticket message id and no prior replies", () => {
    expect(buildThreadHeaders(null, [])).toEqual({});
  });

  it("threads against the ticket's message id when there are no prior replies", () => {
    expect(buildThreadHeaders("<t0>", [])).toEqual({
      inReplyTo: "<t0>",
      references: ["<t0>"],
    });
  });

  it("threads In-Reply-To against the last inbound message, not the last outbound one", () => {
    // <t0> inbound (ticket), <r1> inbound, <r2> outbound, <r3> inbound
    const prior = [
      { externalMessageId: "<r1>", direction: "INBOUND" as const },
      { externalMessageId: "<r2>", direction: "OUTBOUND" as const },
      { externalMessageId: "<r3>", direction: "INBOUND" as const },
    ];
    expect(buildThreadHeaders("<t0>", prior)).toEqual({
      inReplyTo: "<r3>",
      references: ["<t0>", "<r1>", "<r2>", "<r3>"],
    });
  });

  it("falls back to the ticket message id when no prior reply is inbound, referencing only its own ancestor chain", () => {
    const prior = [{ externalMessageId: "<r1>", direction: "OUTBOUND" as const }];
    expect(buildThreadHeaders("<t0>", prior)).toEqual({
      inReplyTo: "<t0>",
      references: ["<t0>"],
    });
  });

  it("omits both headers when every id is null", () => {
    const prior = [{ externalMessageId: null, direction: "OUTBOUND" as const }];
    expect(buildThreadHeaders(null, prior)).toEqual({});
  });

  it("deduplicates and always ends References with In-Reply-To", () => {
    const prior = [
      { externalMessageId: "<t0>", direction: "INBOUND" as const }, // duplicate of the ticket id
      { externalMessageId: "<r1>", direction: "INBOUND" as const },
    ];
    const result = buildThreadHeaders("<t0>", prior);
    expect(result.inReplyTo).toBe("<r1>");
    expect(result.references).toEqual(["<t0>", "<r1>"]);
  });

  it("caps References to the first element plus the most recent entries", () => {
    const prior = Array.from({ length: 15 }, (_, i) => ({
      externalMessageId: `<r${i}>`,
      direction: "INBOUND" as const,
    }));
    const result = buildThreadHeaders("<t0>", prior);
    expect(result.inReplyTo).toBe("<r14>");
    expect(result.references).toHaveLength(10);
    expect(result.references![0]).toBe("<t0>");
    expect(result.references![result.references!.length - 1]).toBe("<r14>");
  });
});
