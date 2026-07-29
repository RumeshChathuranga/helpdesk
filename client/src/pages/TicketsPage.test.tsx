import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/render";
import { api } from "@/lib/api";
import { TicketsPage } from "./TicketsPage";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(api.get);

const listTickets = [
  {
    id: "t1",
    subject: "Cannot reset password",
    status: "OPEN" as const,
    category: "NETWORK" as const,
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
    category: "ACCOUNT_ACCESS" as const,
    fromEmail: "billing@example.com",
    fromName: null,
    assignedToId: null,
    createdById: null,
    createdAt: "2024-06-01T12:00:00.000Z",
    updatedAt: "2024-06-01T12:00:00.000Z",
  },
];

function ticketListResponse(
  tickets: typeof listTickets,
  overrides: Partial<{ total: number; page: number; pageSize: number }> = {},
) {
  return {
    data: {
      tickets,
      total: overrides.total ?? tickets.length,
      page: overrides.page ?? 1,
      pageSize: overrides.pageSize ?? 10,
    },
  };
}

function renderTicketsPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/tickets"]}>
      <Routes>
        <Route path="/tickets" element={<TicketsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedGet.mockResolvedValue(ticketListResponse(listTickets));
});

describe("TicketsPage", () => {
  it("shows loading skeleton while request is pending", () => {
    mockedGet.mockImplementation(() => new Promise(() => {}));

    renderTicketsPage();

    expect(screen.getByRole("heading", { name: "Tickets" })).toBeInTheDocument();
    const status = screen.getByRole("status", { name: "Loading tickets" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(
      within(status).getByRole("columnheader", { name: "Subject" }),
    ).toBeInTheDocument();
  });

  it("renders ticket rows when API succeeds", async () => {
    renderTicketsPage();

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

  it("links ticket subjects to their detail page", async () => {
    renderTicketsPage();

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: "Cannot reset password" });
    expect(link).toHaveAttribute("href", "/tickets/t1");
  });

  it('shows "No tickets found" when the list is empty', async () => {
    mockedGet.mockResolvedValue(ticketListResponse([], { total: 0 }));

    renderTicketsPage();

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

    renderTicketsPage();

    await waitFor(() => {
      expect(screen.getByText("Could not load tickets")).toBeInTheDocument();
    });
    expect(screen.getByText("Forbidden")).toBeInTheDocument();
  });

  it("requests tickets sorted newest first", async () => {
    renderTicketsPage();

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    expect(mockedGet).toHaveBeenCalledWith("/tickets", {
      params: { sort: "createdAt_desc", page: 1, pageSize: 10 },
    });
  });

  it("requests subject ascending when the Subject header is clicked", async () => {
    renderTicketsPage();

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Subject" }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/tickets", {
        params: { sort: "subject_asc", page: 1, pageSize: 10 },
      });
    });
  });

  it("toggles Created sort to ascending when the Created header is clicked", async () => {
    renderTicketsPage();

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Created" }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/tickets", {
        params: { sort: "createdAt_asc", page: 1, pageSize: 10 },
      });
    });
  });

  it("requests status filter when the Status dropdown changes", async () => {
    renderTicketsPage();

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "OPEN" },
    });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/tickets", {
        params: { sort: "createdAt_desc", status: "OPEN", page: 1, pageSize: 10 },
      });
    });
  });

  it("requests category filter when the Category dropdown changes", async () => {
    renderTicketsPage();

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "ACCOUNT_ACCESS" },
    });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/tickets", {
        params: {
          sort: "createdAt_desc",
          category: "ACCOUNT_ACCESS",
          page: 1,
          pageSize: 10,
        },
      });
    });
  });

  it("requests search term after the input is debounced", async () => {
    renderTicketsPage();

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
        expect(mockedGet).toHaveBeenCalledWith("/tickets", {
          params: {
            sort: "createdAt_desc",
            search: "password",
            page: 1,
            pageSize: 10,
          },
        });
      },
      { timeout: 1000 },
    );
  });

  it("requests the next page when Next is clicked", async () => {
    mockedGet.mockResolvedValue(
      ticketListResponse(listTickets, { total: 40, page: 1, pageSize: 10 }),
    );

    renderTicketsPage();

    await waitFor(() => {
      expect(screen.getByText("Cannot reset password")).toBeInTheDocument();
    });

    mockedGet.mockClear();
    mockedGet.mockResolvedValue(
      ticketListResponse(listTickets, { total: 40, page: 2, pageSize: 10 }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("/tickets", {
        params: { sort: "createdAt_desc", page: 2, pageSize: 10 },
      });
    });
  });
});
