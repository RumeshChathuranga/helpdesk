import { fireEvent, screen, waitFor } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ReplyForm } from "./ReplyForm";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign(actual.default, {
      post: vi.fn(),
    }),
  };
});

const mockedPost = vi.mocked(axios.post);

const ticketId = "t1";

const createdReply = {
  id: "r1",
  body: "Thanks for reaching out.",
  isAi: false,
  sentEmail: false,
  externalMessageId: null,
  createdAt: "2024-06-04T12:00:00.000Z",
  direction: "OUTBOUND" as const,
  approval: "NOT_REQUIRED" as const,
  deliveryState: "NOT_QUEUED" as const,
  sentAt: null,
  deliveryError: null,
};

function renderReplyForm(
  id = ticketId,
  customerEmail: string | null = "customer@example.com",
) {
  return renderWithProviders(<ReplyForm ticketId={id} customerEmail={customerEmail} />);
}

beforeEach(() => {
  mockedPost.mockReset();
});

describe("ReplyForm", () => {
  it("renders the reply form fields", () => {
    renderReplyForm();

    expect(
      screen.getByRole("heading", { name: "Add reply" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reply" }),
    ).toBeInTheDocument();
  });

  it("shows Zod validation error when message is empty", async () => {
    renderReplyForm();

    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    expect(await screen.findByText("Reply is required")).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("shows Zod validation error when message is only whitespace", async () => {
    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    expect(await screen.findByText("Reply is required")).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("submits valid values via POST with credentials, sendEmail true by default when the ticket has a customer email", async () => {
    mockedPost.mockResolvedValue({ data: { reply: createdReply } });

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Thanks for reaching out." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/tickets/t1/replies",
        { body: "Thanks for reaching out.", sendEmail: true },
        { withCredentials: true },
      );
    });
  });

  it("submits sendEmail: false when the customer-email checkbox is unchecked", async () => {
    mockedPost.mockResolvedValue({ data: { reply: createdReply } });

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Thanks for reaching out." },
    });
    fireEvent.click(
      screen.getByLabelText(/Also email this reply to customer@example.com/i),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/tickets/t1/replies",
        { body: "Thanks for reaching out.", sendEmail: false },
        { withCredentials: true },
      );
    });
  });

  it("disables and unchecks the email checkbox when the ticket has no customer email", async () => {
    mockedPost.mockResolvedValue({ data: { reply: createdReply } });

    renderReplyForm(ticketId, null);

    const checkbox = screen.getByLabelText(
      /No customer email on this ticket/i,
    ) as HTMLInputElement;
    expect(checkbox).toBeDisabled();
    expect(checkbox.checked).toBe(false);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Internal note." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/tickets/t1/replies",
        { body: "Internal note.", sendEmail: false },
        { withCredentials: true },
      );
    });
  });

  it("clears the message field after a successful submit", async () => {
    mockedPost.mockResolvedValue({ data: { reply: createdReply } });

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Thanks for reaching out." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Message")).toHaveValue("");
    });
  });

  it("shows API error message when POST fails", async () => {
    const err = new AxiosError("Not found");
    err.response = {
      status: 404,
      statusText: "Not Found",
      data: { error: "Ticket not found" },
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };
    mockedPost.mockRejectedValue(err);

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Hello there." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("Hello there.");
  });

  it("shows pending label while submit is in flight", async () => {
    mockedPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ data: { reply: createdReply } }),
            100,
          );
        }),
    );

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Thanks for reaching out." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    expect(
      await screen.findByRole("button", { name: "Sending…" }),
    ).toBeDisabled();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Send reply" }),
      ).toBeInTheDocument();
    });
  });
});

describe("ReplyForm — Polish button", () => {
  it("renders the Polish button", () => {
    renderReplyForm();

    expect(
      screen.getByRole("button", { name: /polish/i }),
    ).toBeInTheDocument();
  });

  it("Polish button is disabled when the message textarea is empty", () => {
    renderReplyForm();

    expect(screen.getByRole("button", { name: /polish/i })).toBeDisabled();
  });

  it("Polish button is enabled once the user types a message", () => {
    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "pleas help me" },
    });

    expect(screen.getByRole("button", { name: /polish/i })).toBeEnabled();
  });

  it("calls POST /api/tickets/:id/polish-reply with the draft text", async () => {
    mockedPost.mockResolvedValueOnce({ data: { polished: "Please help me." } });

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "pleas help me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /polish/i }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/tickets/t1/polish-reply",
        { draft: "pleas help me" },
        { withCredentials: true },
      );
    });
  });

  it("replaces the textarea content with the polished text on success", async () => {
    mockedPost.mockResolvedValueOnce({
      data: { polished: "Please help me." },
    });

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "pleas help me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /polish/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Message")).toHaveValue("Please help me.");
    });
  });

  it("shows 'Polishing…' label on the button while the request is in flight", async () => {
    mockedPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: { polished: "Please help me." } }), 100);
        }),
    );

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "pleas help me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /polish/i }));

    expect(
      await screen.findByRole("button", { name: "Polishing…" }),
    ).toBeDisabled();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^polish$/i }),
      ).toBeInTheDocument();
    });
  });

  it("disables the Send reply button while polishing is in flight", async () => {
    mockedPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: { polished: "Please help me." } }), 100);
        }),
    );

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "pleas help me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /polish/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Send reply" }),
      ).toBeDisabled();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Send reply" }),
      ).toBeEnabled();
    });
  });

  it("shows an error message when the polish API call fails", async () => {
    const err = new AxiosError("Server error");
    err.response = {
      status: 500,
      statusText: "Internal Server Error",
      data: { error: "GitHub Models token is not configured" },
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };
    mockedPost.mockRejectedValueOnce(err);

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "pleas help me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /polish/i }));

    expect(
      await screen.findByText(/github models token is not configured/i),
    ).toBeInTheDocument();
  });

  it("preserves the original draft text when polishing fails", async () => {
    const err = new AxiosError("Server error");
    err.response = {
      status: 500,
      statusText: "Internal Server Error",
      data: { error: "GitHub Models token is not configured" },
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };
    mockedPost.mockRejectedValueOnce(err);

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "pleas help me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /polish/i }));

    await screen.findByText(/github models token is not configured/i);

    expect(screen.getByLabelText("Message")).toHaveValue("pleas help me");
  });
});

