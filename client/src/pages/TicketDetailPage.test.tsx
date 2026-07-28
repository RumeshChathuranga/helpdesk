import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/render";
import { api } from "@/lib/api";
import type { TicketDetail } from "@/lib/tickets";
import { TicketDetailPage } from "./TicketDetailPage";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(api.get);
const mockedPatch = vi.mocked(api.patch);
const mockedPost = vi.mocked(api.post);

const agentsList = [
  { id: "agent-1", name: "Support Agent", email: "agent@example.com" },
];

const detailTicket: TicketDetail = {
  id: "t1",
  subject: "Cannot reset password",
  status: "OPEN" as const,
  category: "TECHNICAL" as const,
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
      direction: "OUTBOUND" as const,
      approval: "NOT_REQUIRED" as const,
      deliveryState: "SENT" as const,
      sentAt: "2024-06-03T12:00:01.000Z",
      deliveryError: null,
    },
  ],
};

function mockTicketDetailResponses(
  ticket = detailTicket,
  agents = agentsList,
) {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/tickets/t1") {
      return Promise.resolve({ data: { ticket } });
    }
    if (url === "/users/agents") {
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
      if (url === "/tickets/t1") {
        return Promise.reject(err);
      }
      if (url === "/users/agents") {
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
      if (url === "/tickets/t1") {
        return Promise.reject(err);
      }
      if (url === "/users/agents") {
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
        "/tickets/t1",
        {
          status: "IN_PROGRESS",
          category: "GENERAL",
          assignedToId: "agent-1",
        },
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

  it("renders an approval panel for a pending-approval AI draft and approves it", async () => {
    const pendingReply = {
      id: "r2",
      body: "Here is a draft answer.",
      isAi: true,
      sentEmail: false,
      externalMessageId: null,
      createdAt: "2024-06-04T12:00:00.000Z",
      direction: "OUTBOUND" as const,
      approval: "PENDING_APPROVAL" as const,
      deliveryState: "NOT_QUEUED" as const,
      sentAt: null,
      deliveryError: null,
    };
    mockTicketDetailResponses({ ...detailTicket, replies: [pendingReply] });
    mockedPost.mockResolvedValue({
      data: {
        reply: { ...pendingReply, approval: "APPROVED", deliveryState: "QUEUED" },
      },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve & send" }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/tickets/t1/replies/r2/approve",
        {},
      );
    });
  });

  it("discards a pending-approval draft", async () => {
    const pendingReply = {
      id: "r2",
      body: "Here is a draft answer.",
      isAi: true,
      sentEmail: false,
      externalMessageId: null,
      createdAt: "2024-06-04T12:00:00.000Z",
      direction: "OUTBOUND" as const,
      approval: "PENDING_APPROVAL" as const,
      deliveryState: "NOT_QUEUED" as const,
      sentAt: null,
      deliveryError: null,
    };
    mockTicketDetailResponses({ ...detailTicket, replies: [pendingReply] });
    mockedPost.mockResolvedValue({
      data: { reply: { ...pendingReply, approval: "DISCARDED", deliveryState: "NOT_QUEUED" } },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/tickets/t1/replies/r2/discard",
        {},
      );
    });
  });

  it("renders a Send failed badge and Retry send button for a failed delivery, and retries it", async () => {
    const failedReply = {
      id: "r3",
      body: "Reply that failed to send.",
      isAi: false,
      sentEmail: false,
      externalMessageId: null,
      createdAt: "2024-06-04T12:00:00.000Z",
      direction: "OUTBOUND" as const,
      approval: "NOT_REQUIRED" as const,
      deliveryState: "FAILED" as const,
      sentAt: null,
      deliveryError: "SMTP timeout",
    };
    mockTicketDetailResponses({ ...detailTicket, replies: [failedReply] });
    mockedPost.mockResolvedValue({
      data: { reply: { ...failedReply, deliveryState: "QUEUED", deliveryError: null } },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Send failed")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry send" }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/tickets/t1/replies/r3/retry-send",
        {},
      );
    });
  });

  it("renders a discarded reply with no action buttons", async () => {
    const discardedReply = {
      id: "r4",
      body: "A discarded AI draft.",
      isAi: true,
      sentEmail: false,
      externalMessageId: null,
      createdAt: "2024-06-04T12:00:00.000Z",
      direction: "OUTBOUND" as const,
      approval: "DISCARDED" as const,
      deliveryState: "NOT_QUEUED" as const,
      sentAt: null,
      deliveryError: null,
    };
    mockTicketDetailResponses({ ...detailTicket, replies: [discardedReply] });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Discarded")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Approve & send" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry send" })).not.toBeInTheDocument();
  });
});

