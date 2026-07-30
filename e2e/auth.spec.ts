import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsAgent } from "./helpers/auth";

// ---------------------------------------------------------------------------
// 1. Login page — rendering
// ---------------------------------------------------------------------------

test.describe("Login page — rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows the Sign in heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("shows Email and Password fields", async ({ page }) => {
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("shows an enabled Sign in button", async ({ page }) => {
    const button = page.getByRole("button", { name: "Sign in" });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// 2. Successful login
// ---------------------------------------------------------------------------

test.describe("Successful login", () => {
  test("admin is redirected to /dashboard and sees the Users nav link", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  });

  test("agent is redirected to /dashboard and does not see the Users nav link", async ({
    page,
  }) => {
    await loginAsAgent(page);

    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();
  });

  // Visiting a protected route first bounces to /login via an SPA-internal
  // redirect (not a full page reload), leaving the client-side session store
  // already primed from that check. Logging in from that same page instance
  // must not require a second submit to reach the dashboard.
  test("logging in works on the first submit after being redirected from a protected route", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");

    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL!);
    await page.getByLabel("Password").fill(process.env.SEED_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 3000 });
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Failed login
// ---------------------------------------------------------------------------

test.describe("Failed login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows an error alert when the password is wrong", async ({ page }) => {
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL!);
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("shows an error alert when the email does not exist", async ({
    page,
  }) => {
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("password@123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });
});

// ---------------------------------------------------------------------------
// 4. Client-side validation
// ---------------------------------------------------------------------------

test.describe("Client-side validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows inline errors when submitting an empty form", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(
      page.getByText("Password must be at least 8 characters")
    ).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("shows an email validation error for an invalid email format", async ({
    page,
  }) => {
    await page.getByLabel("Email").fill("notanemail");
    await page.getByLabel("Password").fill("password@123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("shows a password validation error when password is too short", async ({
    page,
  }) => {
    await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL!);
    await page.getByLabel("Password").fill("12345");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByText("Password must be at least 8 characters")
    ).toBeVisible();
    await expect(page).toHaveURL("/login");
  });
});

// ---------------------------------------------------------------------------
// 5. Unauthenticated route protection
// ---------------------------------------------------------------------------

test.describe("Unauthenticated route protection", () => {
  test("visiting /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });

  test("visiting /users redirects to /login", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/login");
  });

  test("visiting / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });
});

// ---------------------------------------------------------------------------
// 6. Role-based access (authenticated)
// ---------------------------------------------------------------------------

test.describe("Role-based access", () => {
  test("agent visiting /users directly is redirected to /dashboard", async ({
    page,
  }) => {
    await loginAsAgent(page);
    await page.goto("/users");
    await expect(page).toHaveURL("/dashboard");
  });

  test("admin can access /users", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/users");
    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. Sign out
// ---------------------------------------------------------------------------

test.describe("Sign out", () => {
  test("clicking Sign out redirects to /login", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
  });

});
