import { type APIRequestContext, type Page } from "@playwright/test";

export const API_BASE_URL =
  process.env.E2E_API_URL ??
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3000";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
}

export async function loginAsAgent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("agent@example.com");
  await page.getByLabel("Password").fill("password@123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
}

export async function loginAgentViaApi(request: APIRequestContext) {
  const response = await request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
    data: {
      email: "agent@example.com",
      password: "password@123",
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Agent API login failed: ${response.status()} ${await response.text()}`,
    );
  }
}
