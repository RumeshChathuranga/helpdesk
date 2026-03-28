import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { EditUserDialog } from "./EditUserDialog";
import type { UserListItem } from "./UsersTable";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign(actual.default, {
      patch: vi.fn(),
    }),
  };
});

const mockedPatch = vi.mocked(axios.patch);

const sampleUser: UserListItem = {
  id: "u-edit",
  name: "Bob Agent",
  email: "bob@example.com",
  role: "AGENT",
  emailVerified: true,
  createdAt: "2024-06-01T12:00:00.000Z",
};

beforeEach(() => {
  mockedPatch.mockReset();
});

function renderOpenDialog(
  user: UserListItem | null = sampleUser,
  onOpenChange = vi.fn(),
) {
  return renderWithProviders(
    <EditUserDialog open={true} onOpenChange={onOpenChange} user={user} />,
  );
}

describe("EditUserDialog", () => {
  it("renders the edit form fields prefilled from user", () => {
    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Edit user" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Bob Agent");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("bob@example.com");
    expect(within(dialog).getByLabelText("New password")).toHaveValue("");
    expect(
      within(dialog).getByRole("button", { name: "Save" }),
    ).toBeInTheDocument();
  });

  it("shows Zod validation error when name is too short", async () => {
    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Edit user" });

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "ab" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(
      await within(dialog).findByText("Name must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it("shows validation when new password is non-empty but too short", async () => {
    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Edit user" });

    fireEvent.change(within(dialog).getByLabelText("New password"), {
      target: { value: "short" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(
      await within(dialog).findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it("submits PATCH without password when new password is left blank", async () => {
    mockedPatch.mockResolvedValue({
      data: {
        user: {
          ...sampleUser,
          name: "Bob Updated",
          email: "bob@example.com",
        },
      },
    });

    const onOpenChange = vi.fn();
    renderOpenDialog(sampleUser, onOpenChange);

    const dialog = screen.getByRole("dialog", { name: "Edit user" });

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Bob Updated" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith(
        "/api/users/u-edit",
        expect.objectContaining({
          name: "Bob Updated",
          email: "bob@example.com",
          password: "",
        }),
        { withCredentials: true },
      );
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("submits PATCH with password when a new password is provided", async () => {
    mockedPatch.mockResolvedValue({
      data: { user: sampleUser },
    });

    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Edit user" });

    fireEvent.change(within(dialog).getByLabelText("New password"), {
      target: { value: "newpass123" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith(
        "/api/users/u-edit",
        expect.objectContaining({
          password: "newpass123",
        }),
        { withCredentials: true },
      );
    });
  });

  it("shows API error message when PATCH fails", async () => {
    const err = new AxiosError("Conflict");
    err.response = {
      status: 409,
      statusText: "Conflict",
      data: { error: "User already exists" },
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };
    mockedPatch.mockRejectedValue(err);

    renderOpenDialog();

    const dialog = screen.getByRole("dialog", { name: "Edit user" });

    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "taken@example.com" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(
      await within(dialog).findByText("User already exists"),
    ).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    const onOpenChange = vi.fn();
    renderOpenDialog(sampleUser, onOpenChange);

    const dialog = screen.getByRole("dialog", { name: "Edit user" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
