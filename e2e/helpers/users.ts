import { type Page, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth";

export function uniqueTestEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

export async function openUsersPage(page: Page) {
  await loginAsAdmin(page);
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
}
