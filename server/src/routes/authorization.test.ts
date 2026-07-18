import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { loginAsAgent, startTestServer } from "../test/helpers.js";

/**
 * Authorization matrix: an AGENT session must never reach admin-only
 * functionality. requireAdmin runs before body/param validation on every one
 * of these routes, so a 403 here should never depend on request payload
 * shape — a bogus id/body is enough to prove the check happens first.
 */
describe("Authorization matrix — AGENT vs admin-only routes", () => {
  let server: Server;
  let baseUrl: string;
  let agentCookie = "";

  beforeAll(async () => {
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    agentCookie = await loginAsAgent(baseUrl);
  });

  afterAll(() => {
    server?.close();
  });

  async function asAgent(path: string, method: string, body?: unknown) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Cookie: agentCookie,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  describe("/api/users (admin-only)", () => {
    it("returns 403 for GET /api/users", async () => {
      const res = await asAgent("/api/users", "GET");
      expect(res.status).toBe(403);
    });

    it("returns 403 for POST /api/users", async () => {
      const res = await asAgent("/api/users", "POST", {
        name: "Someone",
        email: "someone@example.com",
        password: "password123",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 for PATCH /api/users/:id", async () => {
      const res = await asAgent("/api/users/nonexistent-user-id", "PATCH", {
        name: "Someone",
        email: "someone@example.com",
        password: "",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 for DELETE /api/users/:id", async () => {
      const res = await asAgent("/api/users/nonexistent-user-id", "DELETE");
      expect(res.status).toBe(403);
    });
  });

  describe("/api/knowledge (admin-only)", () => {
    it("returns 403 for GET /api/knowledge", async () => {
      const res = await asAgent("/api/knowledge", "GET");
      expect(res.status).toBe(403);
    });

    it("returns 403 for POST /api/knowledge", async () => {
      const res = await asAgent("/api/knowledge", "POST", {
        text: "Some knowledge base text.",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 for DELETE /api/knowledge/:id", async () => {
      const res = await asAgent("/api/knowledge/nonexistent-id", "DELETE");
      expect(res.status).toBe(403);
    });
  });
});
