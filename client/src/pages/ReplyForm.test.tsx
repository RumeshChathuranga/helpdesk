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
};

function renderReplyForm(id = ticketId) {
  return renderWithProviders(<ReplyForm ticketId={id} />);
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

  it("submits valid values via POST with credentials", async () => {
    mockedPost.mockResolvedValue({ data: { reply: createdReply } });

    renderReplyForm();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Thanks for reaching out." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/tickets/t1/replies",
        { body: "Thanks for reaching out." },
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
