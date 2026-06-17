import { type Page, expect } from "@playwright/test";
import { loginAsAgent } from "./auth";

export const E2E_TICKET_SUBJECT_PREFIX = "E2E ticket";

export function uniqueTicketSubject(label?: string): string {
  const tag = label
    ? `${E2E_TICKET_SUBJECT_PREFIX} ${label}`
    : E2E_TICKET_SUBJECT_PREFIX;
  return `${tag} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function openTicketsPage(page: Page) {
  await loginAsAgent(page);
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
}

export async function waitForTicketsTable(page: Page) {
  await expect(
    page.getByRole("status", { name: "Loading tickets" }),
  ).not.toBeVisible({ timeout: 10_000 });
}

export type CreatedTicket = {
  id: string;
  subject: string;
  createdAt: string;
};

/** Creates a ticket through the same /api proxy the browser uses. */
export async function createTicketViaPage(
  page: Page,
  data: { subject: string; body: string; category?: string },
): Promise<CreatedTicket> {
  const response = await page.request.post("/api/tickets", { data });

  if (!response.ok()) {
    throw new Error(
      `Create ticket failed: ${response.status()} ${await response.text()}`,
    );
  }

  const json = (await response.json()) as { ticket: CreatedTicket };
  return json.ticket;
}

/** Deletes a ticket through the same /api proxy the browser uses. */
export async function deleteTicketViaPage(page: Page, id: string) {
  const response = await page.request.delete(`/api/tickets/${id}`);
  if (!response.ok() && response.status() !== 404) {
    throw new Error(
      `Delete ticket failed: ${response.status()} ${await response.text()}`,
    );
  }
}

/** Best-effort cleanup for E2E — logs failures instead of failing the test run. */
export async function deleteTicketsViaPage(page: Page, ids: string[]) {
  for (const id of ids) {
    const response = await page.request.delete(`/api/tickets/${id}`);
    if (!response.ok() && response.status() !== 404) {
      console.warn(
        `[e2e cleanup] Failed to delete ticket ${id}: ${response.status()} ${await response.text()}`,
      );
    }
  }
}
