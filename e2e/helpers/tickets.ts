import { type APIRequestContext, type Page, expect } from "@playwright/test";
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

const AGENT_VISIBLE_STATUSES = new Set([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

/**
 * New tickets start as NEW/PROCESSING (hidden from the agent list) until the
 * process-ticket worker finishes. Poll detail until the ticket is visible.
 *
 * Pass `baseUrl` when using a bare APIRequestContext against the E2E API
 * (e.g. `API_BASE_URL`). Leave it empty when using `page.request`, which goes
 * through the Vite `/api` proxy with the browser session cookie.
 */
export async function waitForTicketAgentVisible(
  request: APIRequestContext,
  ticketId: string,
  {
    baseUrl = "",
    timeoutMs = 15_000,
  }: { baseUrl?: string; timeoutMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `${baseUrl}/api/tickets/${ticketId}`;
  while (Date.now() < deadline) {
    const response = await request.get(url);
    if (response.ok()) {
      const json = (await response.json()) as {
        ticket: { status: string };
      };
      if (AGENT_VISIBLE_STATUSES.has(json.ticket.status)) {
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `Timed out waiting for ticket ${ticketId} to leave NEW/PROCESSING`,
  );
}

/** Updates a ticket through the same /api proxy the browser uses. */
export async function updateTicketViaPage(
  page: Page,
  id: string,
  data: { status?: string; category?: string },
) {
  const response = await page.request.patch(`/api/tickets/${id}`, { data });
  if (!response.ok()) {
    throw new Error(
      `Update ticket failed: ${response.status()} ${await response.text()}`,
    );
  }
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
