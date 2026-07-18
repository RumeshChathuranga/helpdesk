import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { loginAsAgent, startTestServer } from "../test/helpers.js";

describe("GET /api/users/agents", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";

  beforeAll(async () => {
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterAll(() => {
    server?.close();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${baseUrl}/api/users/agents`);
    expect(res.status).toBe(401);
  });

  it("returns 200 with agent users for authenticated agent", async () => {
    const res = await fetch(`${baseUrl}/api/users/agents`, {
      headers: { Cookie: authCookie },
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      users: { id: string; name: string; email: string }[];
    };

    expect(Array.isArray(json.users)).toBe(true);
    expect(json.users.length).toBeGreaterThan(0);
    expect(json.users[0]).toHaveProperty("id");
    expect(json.users[0]).toHaveProperty("name");
    expect(json.users[0]).toHaveProperty("email");
    expect(
      json.users.some((user) => user.email === "agent@example.com"),
    ).toBe(true);
  });
});
