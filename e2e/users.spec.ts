import { test, expect } from "@playwright/test";
import { openUsersPage, uniqueTestEmail } from "./helpers/users";

test.describe.serial("User management — CRUD happy path", () => {
  let createdEmail: string;
  let createdName: string;
  let updatedEmail: string;
  let updatedName: string;

  test.beforeEach(async ({ page }) => {
    await openUsersPage(page);
  });

  test("admin can list seeded users", async ({ page }) => {
    await expect(
      page.getByRole("status", { name: "Loading users" }),
    ).not.toBeVisible();

    await expect(
      page.getByRole("columnheader", { name: "Name" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Email" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Role" }),
    ).toBeVisible();

    const table = page.getByRole("table");
    await expect(
      table.getByRole("cell", { name: "Admin", exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole("cell", { name: "agent@example.com" }),
    ).toBeVisible();
    await expect(
      table.getByRole("cell", { name: "Agent", exact: true }),
    ).toBeVisible();
  });

  test("admin can create a new agent user", async ({ page }) => {
    createdName = `E2E Test Agent ${Date.now()}`;
    createdEmail = uniqueTestEmail();

    await page.getByRole("button", { name: "Create user" }).click();

    const dialog = page.getByRole("dialog", { name: "Create user" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Name").fill(createdName);
    await dialog.getByLabel("Email").fill(createdEmail);
    await dialog.getByLabel("Password").fill("password@123");
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(dialog).not.toBeVisible();

    const row = page.getByRole("row").filter({ hasText: createdEmail });
    await expect(
      row.getByRole("cell", { name: createdName, exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("cell", { name: createdEmail }),
    ).toBeVisible();
    await expect(row.getByText("AGENT", { exact: true })).toBeVisible();
  });

  test("admin can edit the created user", async ({ page }) => {
    updatedName = "E2E Updated Agent";
    updatedEmail = uniqueTestEmail("e2e-updated");

    await page
      .getByRole("button", { name: `Edit user ${createdName}` })
      .click();

    const dialog = page.getByRole("dialog", { name: "Edit user" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Name").fill(updatedName);
    await dialog.getByLabel("Email").fill(updatedEmail);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("cell", { name: createdEmail }),
    ).not.toBeVisible();

    const row = page.getByRole("row").filter({ hasText: updatedEmail });
    await expect(
      row.getByRole("cell", { name: updatedName, exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("cell", { name: updatedEmail }),
    ).toBeVisible();
  });

  test("admin can delete the created user", async ({ page }) => {
    await page
      .getByRole("button", { name: `Delete user ${updatedName}` })
      .click();

    const dialog = page.getByRole("alertdialog", { name: "Delete user" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(updatedName)).toBeVisible();
    await expect(dialog.getByText(updatedEmail)).toBeVisible();

    await dialog.getByRole("button", { name: "Delete user" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("cell", { name: updatedEmail }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("cell", { name: updatedName, exact: true }),
    ).not.toBeVisible();

    const table = page.getByRole("table");
    await expect(
      table.getByRole("cell", { name: "Admin", exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole("cell", { name: "agent@example.com" }),
    ).toBeVisible();
    await expect(
      table.getByRole("cell", { name: "Agent", exact: true }),
    ).toBeVisible();
  });
});
