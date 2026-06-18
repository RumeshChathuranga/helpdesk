import { fireEvent, screen, waitFor } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/render";
import { TicketDetailPage } from "./TicketDetailPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign(actual.default, {
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
    }),
  };
});

const mockedGet = vi.mocked(axios.get);
const mockedPatch = vi.mocked(axios.patch);
const mockedPost = vi.mocked(axios.post);

const agentsList = [
  { id: "agent-1", name: "Support Agent", email: "agent@example.com" },
];

const detailTicket = {
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
  body: "I forgot my password and need help resetting it.",
  externalMessageId: null,
  aiSummary: null,
  assignedTo: null,
  replies: [
    {
      id: "r1",
      body: "We sent reset instructions.",
      isAi: false,
      sentEmail: true,
      externalMessageId: null,
      createdAt: "2024-06-03T12:00:00.000Z",
    },
  ],
};

function mockTicketDetailResponses(
  ticket = detailTicket,
  agents = agentsList,
) {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/api/tickets/t1") {
      return Promise.resolve({ data: { ticket } });
    }
    if (url === "/api/users/agents") {
      return Promise.resolve({ data: { users: agents } });
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

function renderDetailPage(route = "/tickets/t1") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedPatch.mockReset();
  mockedPost.mockReset();
  mockTicketDetailResponses();
});

describe("TicketDetailPage", () => {
  it("shows loading skeleton while request is pending", () => {
    mockedGet.mockImplementation(() => new Promise(() => {}));

    renderDetailPage();

    expect(
      screen.getByRole("status", { name: "Loading ticket" }),
    ).toBeInTheDocument();
  });

  it("renders ticket details when API succeeds", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Cannot reset password" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Jane Customer")).toBeInTheDocument();
    expect(screen.getByText("jane.customer@gmail.com")).toBeInTheDocument();
    expect(
      screen.getByText("I forgot my password and need help resetting it."),
    ).toBeInTheDocument();
    expect(screen.getByText("We sent reset instructions.")).toBeInTheDocument();
    expect(screen.getByText("Replies (1)")).toBeInTheDocument();
  });

  it('shows "Ticket not found" when API returns 404', async () => {
    const err = new AxiosError("Not found");
    err.response = {
      status: 404,
      statusText: "Not Found",
      data: { error: "Ticket not found" },
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };
    mockedGet.mockImplementation((url: string) => {
      if (url === "/api/tickets/t1") {
        return Promise.reject(err);
      }
      if (url === "/api/users/agents") {
        return Promise.resolve({ data: { users: agentsList } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    renderDetailPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Ticket not found" }),
      ).toBeInTheDocument();
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
    mockedGet.mockImplementation((url: string) => {
      if (url === "/api/tickets/t1") {
        return Promise.reject(err);
      }
      if (url === "/api/users/agents") {
        return Promise.resolve({ data: { users: agentsList } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Could not load ticket")).toBeInTheDocument();
    });
    expect(screen.getByText("Forbidden")).toBeInTheDocument();
  });

  it("saves ticket edits via PATCH", async () => {
    mockedPatch.mockResolvedValue({
      data: {
        ticket: {
          ...detailTicket,
          status: "IN_PROGRESS",
          category: "GENERAL",
          assignedToId: "agent-1",
        },
      },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Cannot reset password" }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "IN_PROGRESS" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "GENERAL" },
    });
    fireEvent.change(screen.getByLabelText("Assignee"), {
      target: { value: "agent-1" },
    });

    mockedPatch.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith(
        "/api/tickets/t1",
        {
          status: "IN_PROGRESS",
          category: "GENERAL",
          assignedToId: "agent-1",
        },
        { withCredentials: true },
      );
    });
  });

  it("shows empty replies state when there are no replies", async () => {
    mockTicketDetailResponses({ ...detailTicket, replies: [] });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Replies (0)")).toBeInTheDocument();
    });
    expect(screen.getByText("No replies yet.")).toBeInTheDocument();
  });

  it("renders the reply form", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Message")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Send reply" }),
    ).toBeInTheDocument();
  });

  it("submits a reply via POST and refetches the ticket", async () => {
    mockTicketDetailResponses({ ...detailTicket, replies: [] });

    mockedPost.mockResolvedValue({
      data: {
        reply: {
          id: "r2",
          body: "Thanks for reaching out.",
          isAi: false,
          sentEmail: false,
          externalMessageId: null,
          createdAt: "2024-06-04T12:00:00.000Z",
        },
      },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Message")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Thanks for reaching out." },
    });

    mockTicketDetailResponses({
      ...detailTicket,
      replies: [
        {
          id: "r2",
          body: "Thanks for reaching out.",
          isAi: false,
          sentEmail: false,
          externalMessageId: null,
          createdAt: "2024-06-04T12:00:00.000Z",
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/tickets/t1/replies",
        { body: "Thanks for reaching out." },
        { withCredentials: true },
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Thanks for reaching out.")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });
});
