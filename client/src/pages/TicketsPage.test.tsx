import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
    fromEmail: "jane.customer@gmail.com",
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
    expect(screen.getByText("jane.customer@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("Invoice question")).toBeInTheDocument();
    expect(screen.getByText("billing@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();

    const invoiceRow = screen.getByRole("row", { name: /Invoice question/i });
    expect(within(invoiceRow).getByText("In progress")).toBeInTheDocument();
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

  it("requests subject ascending when the Subject header is clicked", async () => {
    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Subject" }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
        params: { sort: "subject_asc" },
        withCredentials: true,
      });
    });
  });

  it("toggles Created sort to ascending when the Created header is clicked", async () => {
    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Created" }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
        params: { sort: "createdAt_asc" },
        withCredentials: true,
      });
    });
  });

  it("requests status filter when the Status dropdown changes", async () => {
    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "OPEN" },
    });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
        params: { sort: "createdAt_desc", status: "OPEN" },
        withCredentials: true,
      });
    });
  });

  it("requests category filter when the Category dropdown changes", async () => {
    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "BILLING" },
    });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
        params: { sort: "createdAt_desc", category: "BILLING" },
        withCredentials: true,
      });
    });
  });

  it("requests search term after the input is debounced", async () => {
    renderWithProviders(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "password" },
    });

    expect(mockedGet).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
          params: { sort: "createdAt_desc", search: "password" },
          withCredentials: true,
        });
      },
      { timeout: 1000 },
    );
  });
});
