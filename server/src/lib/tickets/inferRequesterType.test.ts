import { describe, expect, it } from "bun:test";
import { inferRequesterType } from "./inferRequesterType.js";

describe("inferRequesterType", () => {
  it("infers STUDENT from a batch-year address on a mrt.ac.lk subdomain", () => {
    expect(inferRequesterType("kavindut.22@cse.mrt.ac.lk")).toBe("STUDENT");
  });

  it("infers ADMINISTRATIVE_STAFF from a known unit mailbox", () => {
    expect(inferRequesterType("registrar@uom.lk")).toBe("ADMINISTRATIVE_STAFF");
    expect(inferRequesterType("exams@uom.lk")).toBe("ADMINISTRATIVE_STAFF");
  });

  it("infers TECHNICAL_STAFF from a known technical mailbox, including lab* prefixes", () => {
    expect(inferRequesterType("cites@uom.lk")).toBe("TECHNICAL_STAFF");
    expect(inferRequesterType("lab1@uom.lk")).toBe("TECHNICAL_STAFF");
  });

  it("infers ACADEMIC_STAFF for any other uom.lk or mrt.ac.lk address", () => {
    expect(inferRequesterType("jsmith@uom.lk")).toBe("ACADEMIC_STAFF");
    expect(inferRequesterType("lecturer@cse.mrt.ac.lk")).toBe("ACADEMIC_STAFF");
  });

  it("returns null for addresses outside the university domains", () => {
    expect(inferRequesterType("someone@gmail.com")).toBeNull();
  });

  it("returns null when there is no email address", () => {
    expect(inferRequesterType(null)).toBeNull();
    expect(inferRequesterType(undefined)).toBeNull();
  });
});
