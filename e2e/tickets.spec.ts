import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsAgent } from "./helpers/auth";
import {
  createTicketViaPage,
  deleteTicketsViaPage,
  openTicketsPage,
  uniqueTicketSubject,
  updateTicketViaPage,
  waitForTicketAgentVisible,
  waitForTicketsTable,
} from "./helpers/tickets";

test.describe("Ticket list — access control", () => {
  test("unauthenticated user visiting /tickets is redirected to login", async ({
    page,
  }) => {
    await page.goto("/tickets");
    await expect(page).toHaveURL("/login");
  });

  test("agent can navigate to tickets via the sidebar", async ({ page }) => {
    await loginAsAgent(page);
    await page.getByRole("link", { name: "Tickets" }).click();
    await expect(page).toHaveURL("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
  });

  test("admin can view the tickets page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/tickets");
    await expect(page).toHaveURL("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
  });
});

test.describe.serial("Ticket list — table", () => {
  const createdTicketIds: string[] = [];

  test.afterEach(async ({ page }) => {
    if (createdTicketIds.length === 0) {
      return;
    }

    const ids = createdTicketIds.splice(0);
    await loginAsAgent(page);
    await deleteTicketsViaPage(page, ids);
  });

  test("shows column headers and a ticket created via the API", async ({
    page,
  }) => {
    await loginAsAgent(page);

    const subject = uniqueTicketSubject("API");
    const ticket = await createTicketViaPage(page, {
      subject,
      body: "Created from E2E test",
      category: "NETWORK",
    });
    createdTicketIds.push(ticket.id);
    // Ticket is NEW/PROCESSING until the AI worker finishes (or fails open).
    await waitForTicketAgentVisible(page.request, ticket.id);

    await page.goto("/tickets");
    await waitForTicketsTable(page);

    for (const column of [
      "Subject",
      "Status",
      "Category",
      "Requester",
      "Created",
    ]) {
      await expect(
        page.getByRole("columnheader", { name: column }),
      ).toBeVisible();
    }

    const row = page.getByRole("row").filter({ hasText: subject });
    await expect(row.getByText("Open")).toBeVisible();
    await expect(row.getByText("Network")).toBeVisible();
    await expect(row.getByText("—")).toBeVisible();
  });

  test("shows seeded ticket with requester name", async ({ page }) => {
    await openTicketsPage(page);
    await waitForTicketsTable(page);

    const row = page
      .getByRole("row")
      .filter({ hasText: "Cannot reset my UoM account password" });
    await expect(row.getByText("Kavindu Thennakoon")).toBeVisible();
    await expect(row.getByText("Open")).toBeVisible();
    await expect(row.getByText("Account & access")).toBeVisible();
  });

  test("lists tickets newest first", async ({ page }) => {
    await loginAsAgent(page);

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const olderSubject = uniqueTicketSubject(`Older ${runId}`);
    const newerSubject = uniqueTicketSubject(`Newer ${runId}`);

    const olderTicket = await createTicketViaPage(page, {
      subject: olderSubject,
      body: "Older ticket body",
    });
    createdTicketIds.push(olderTicket.id);

    const newerTicket = await createTicketViaPage(page, {
      subject: newerSubject,
      body: "Newer ticket body",
    });
    createdTicketIds.push(newerTicket.id);

    await waitForTicketAgentVisible(page.request, olderTicket.id);
    await waitForTicketAgentVisible(page.request, newerTicket.id);

    await page.goto("/tickets");
    await waitForTicketsTable(page);

    const newerCell = page.getByRole("cell", {
      name: newerSubject,
      exact: true,
    });
    const olderCell = page.getByRole("cell", {
      name: olderSubject,
      exact: true,
    });

    await expect(newerCell).toBeVisible();
    await expect(olderCell).toBeVisible();

    const newerRow = page.getByRole("row").filter({ has: newerCell });
    const olderRow = page.getByRole("row").filter({ has: olderCell });

    const newerY = (await newerRow.boundingBox())!.y;
    const olderY = (await olderRow.boundingBox())!.y;
    expect(newerY).toBeLessThan(olderY);
  });

  test("filters tickets by status and category", async ({ page }) => {
    await loginAsAgent(page);

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const openSubject = uniqueTicketSubject(`Filter open ${runId}`);
    const resolvedSubject = uniqueTicketSubject(`Filter resolved ${runId}`);

    const openTicket = await createTicketViaPage(page, {
      subject: openSubject,
      body: "Open filter ticket",
      category: "OTHER",
    });
    createdTicketIds.push(openTicket.id);

    const resolvedTicket = await createTicketViaPage(page, {
      subject: resolvedSubject,
      body: "Resolved filter ticket",
      category: "ACCOUNT_ACCESS",
    });
    createdTicketIds.push(resolvedTicket.id);

    await waitForTicketAgentVisible(page.request, openTicket.id);
    await waitForTicketAgentVisible(page.request, resolvedTicket.id);
    await updateTicketViaPage(page, resolvedTicket.id, { status: "RESOLVED" });

    await page.goto("/tickets");
    await waitForTicketsTable(page);

    await page.getByLabel("Status").selectOption("Open");
    await waitForTicketsTable(page);

    await expect(page.getByRole("cell", { name: openSubject })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: resolvedSubject }),
    ).not.toBeVisible();

    await page.getByLabel("Status").selectOption("All statuses");
    await page.getByLabel("Category").selectOption("Account & access");
    await waitForTicketsTable(page);

    await expect(
      page.getByRole("cell", { name: resolvedSubject }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: openSubject }),
    ).not.toBeVisible();
  });

  test("searches tickets by subject", async ({ page }) => {
    await loginAsAgent(page);

    const searchToken = `search-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const matchingSubject = uniqueTicketSubject(`Match ${searchToken}`);
    const otherSubject = uniqueTicketSubject(`Other ${searchToken}`);

    const matchingTicket = await createTicketViaPage(page, {
      subject: matchingSubject,
      body: "Find me by subject",
    });
    createdTicketIds.push(matchingTicket.id);

    const otherTicket = await createTicketViaPage(page, {
      subject: otherSubject,
      body: "Different ticket body",
    });
    createdTicketIds.push(otherTicket.id);

    await waitForTicketAgentVisible(page.request, matchingTicket.id);
    await waitForTicketAgentVisible(page.request, otherTicket.id);

    await page.goto("/tickets");
    await waitForTicketsTable(page);

    await page.getByLabel("Search").fill(`Match ${searchToken}`);

    await expect(
      page.getByRole("cell", { name: matchingSubject }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("cell", { name: otherSubject }),
    ).not.toBeVisible();
  });
});
