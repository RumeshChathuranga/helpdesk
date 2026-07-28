import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { api } from "@/lib/api";
import { CreateUserDialog } from "./CreateUserDialog";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

const mockedPost = vi.mocked(api.post);

beforeEach(() => {
  mockedPost.mockReset();
});

function renderOpenDialog(onOpenChange = vi.fn()) {
  return renderWithProviders(
    <CreateUserDialog open={true} onOpenChange={onOpenChange} />,
  );
}

describe("CreateUserDialog", () => {
  it("renders the create user form fields", () => {
    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Create user" });
    expect(within(dialog).getByLabelText("Name")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Email")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Password")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Create" }),
    ).toBeInTheDocument();
  });

  it("shows Zod validation error when name is too short", async () => {
    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Create user" });

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "ab" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "valid@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Password"), {
      target: { value: "password1" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await within(dialog).findByText("Name must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("shows Zod validation error when email is invalid", async () => {
    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Create user" });

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "not-a-valid-email" },
    });
    fireEvent.change(within(dialog).getByLabelText("Password"), {
      target: { value: "password1" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await within(dialog).findByText("Enter a valid email"),
    ).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("shows Zod validation error when password is too short", async () => {
    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Create user" });

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Password"), {
      target: { value: "short" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await within(dialog).findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("submits valid values via POST with credentials", async () => {
    mockedPost.mockResolvedValue({
      data: {
        user: {
          id: "u-new",
          name: "New Agent",
          email: "new@example.com",
          role: "AGENT" as const,
          emailVerified: false,
          createdAt: "2024-07-01T10:00:00.000Z",
        },
      },
    });

    const onOpenChange = vi.fn();
    renderOpenDialog(onOpenChange);

    const dialog = screen.getByRole("dialog", { name: "Create user" });

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "New Agent" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        "/users",
        {
          name: "New Agent",
          email: "new@example.com",
          password: "password123",
        },
      );
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows API error message when POST fails", async () => {
    const err = new AxiosError("Conflict");
    err.response = {
      status: 409,
      statusText: "Conflict",
      data: { error: "User already exists" },
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };
    mockedPost.mockRejectedValue(err);

    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Create user" });

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Someone" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "taken@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await within(dialog).findByText("User already exists"),
    ).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    const onOpenChange = vi.fn();
    renderOpenDialog(onOpenChange);

    const dialog = screen.getByRole("dialog", { name: "Create user" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
