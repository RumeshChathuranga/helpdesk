import { type Page } from "@playwright/test";

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
