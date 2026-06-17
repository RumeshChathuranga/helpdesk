import { screen, waitFor, within } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { TicketsPage } from "./TicketsPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign(actual.default, {
      get: vi.fn(),
    }),
  };
});

const mockedGet = vi.mocked(axios.get);

const listTickets = [
  {
    id: "t1",
    subject: "Cannot reset password",
    status: "OPEN" as const,
    category: "TECHNICAL" as const,
    priority: 0,
    fromEmail: "customer@example.com",
    fromName: "Jane Customer",
    assignedToId: null,
    createdById: null,
    createdAt: "2024-06-02T12:00:00.000Z",
    updatedAt: "2024-06-02T12:00:00.000Z",
  },
  {
    id: "t2",
    subject: "Invoice question",
    status: "IN_PROGRESS" as const,
    category: "BILLING" as const,
    priority: 0,
    fromEmail: "billing@example.com",
    fromName: null,
    assignedToId: null,
    createdById: null,
    createdAt: "2024-06-01T12:00:00.000Z",
    updatedAt: "2024-06-01T12:00:00.000Z",
  },
];

beforeEach(() => {
  mockedGet.mockReset();
  mockedGet.mockResolvedValue({ data: { tickets: listTickets } });
});

describe("TicketsPage", () => {
  it("shows loading skeleton while request is pending", () => {
    mockedGet.mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<TicketsPage />);

    expect(screen.getByRole("heading", { name: "Tickets" })).toBeInTheDocument();
    const status = screen.getByRole("status", { name: "Loading tickets" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(
      within(status).getByRole("columnheader", { name: "Subject" }),
    ).toBeInTheDocument();
  });

  it("renders ticket rows when API succeeds", async () => {
    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    expect(screen.getByText("Jane Customer")).toBeInTheDocument();
    expect(screen.getByText("Invoice question")).toBeInTheDocument();
    expect(screen.getByText("billing@example.com")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it('shows "No tickets found" when the list is empty', async () => {
    mockedGet.mockResolvedValue({ data: { tickets: [] } });

    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("No tickets found.")).toBeInTheDocument();
    });
  });

  it("shows API error message when the request fails", async () => {
    const err = new AxiosError("Forbidden");
    err.response = {
      status: 403,
      statusText: "Forbidden",
      data: { error: "Forbidden" },
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };
    mockedGet.mockRejectedValue(err);

    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Could not load tickets")).toBeInTheDocument();
    });
    expect(screen.getByText("Forbidden")).toBeInTheDocument();
  });

  it("requests tickets sorted newest first", async () => {
    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
      params: { sort: "createdAt_desc" },
      withCredentials: true,
    });
  });
});
