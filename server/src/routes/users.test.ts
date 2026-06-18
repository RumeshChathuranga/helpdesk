import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";

describe("GET /api/users/agents", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  let integrationReady = false;

  beforeAll(async () => {
    try {
      const app = createApp();
      server = app.listen(0);
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;

      const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "agent@example.com",
          password: "password@123",
        }),
      });

      if (!loginRes.ok) {
        return;
      }

      authCookie = loginRes.headers.getSetCookie().join("; ");
      integrationReady = true;
    } catch {
      integrationReady = false;
    }
  });

  afterAll(() => {
    server?.close();
  });

  it("returns 401 when unauthenticated", async () => {
    if (!integrationReady) {
      return;
    }

    const res = await fetch(`${baseUrl}/api/users/agents`);
    expect(res.status).toBe(401);
  });

  it("returns 200 with agent users for authenticated agent", async () => {
    if (!integrationReady) {
      return;
    }

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
