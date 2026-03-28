import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { UsersPage } from "./UsersPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign(actual.default, {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    }),
  };
});

const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);
const mockedPatch = vi.mocked(axios.patch);
const mockedDelete = vi.mocked(axios.delete);

const listUsers = [
  {
    id: "u1",
    name: "Alice Admin",
    email: "alice@example.com",
    role: "ADMIN" as const,
    emailVerified: true,
    createdAt: "2024-06-01T12:00:00.000Z",
  },
  {
    id: "u2",
    name: "Bob Agent",
    email: "bob@example.com",
    role: "AGENT" as const,
    emailVerified: true,
    createdAt: "2024-06-02T12:00:00.000Z",
  },
];

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  mockedPatch.mockReset();
  mockedDelete.mockReset();
  mockedGet.mockResolvedValue({ data: { users: listUsers } });
});

describe("UsersPage", () => {
  it("shows loading skeleton while request is pending", () => {
    mockedGet.mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<UsersPage />);

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    const status = screen.getByRole("status", { name: "Loading users" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(
      within(status).getByRole("columnheader", { name: "Name" }),
    ).toBeInTheDocument();
  });

  it("renders user rows when API succeeds", async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Agent")).toBeInTheDocument();
    expect(screen.getAllByText("ADMIN").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show delete for ADMIN rows but shows delete for agents", async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Bob Agent")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "Delete user Alice Admin" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete user Bob Agent" }),
    ).toBeInTheDocument();
  });

  it('shows "No users found" when the list is empty', async () => {
    mockedGet.mockResolvedValue({ data: { users: [] } });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("No users found.")).toBeInTheDocument();
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

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Could not load users")).toBeInTheDocument();
    });
    expect(screen.getByText("Forbidden")).toBeInTheDocument();
  });

  it("opens the edit-user dialog when the row edit button is clicked", async () => {
    mockedPatch.mockResolvedValue({ data: { user: listUsers[0] } });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("dialog", { name: "Edit user" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit user Alice Admin" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Edit user" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Alice Admin");
    expect(within(dialog).getByLabelText("Email")).toHaveValue(
      "alice@example.com",
    );
  });

  it("opens the create-user dialog when the toolbar button is clicked", async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("dialog", { name: "Create user" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByRole("dialog", { name: "Create user" }),
    ).toBeInTheDocument();
  });

  it("closes the create-user dialog when the overlay is clicked", async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    const dialog = await screen.findByRole("dialog", { name: "Create user" });
    const overlay = dialog.previousElementSibling;
    expect(overlay).toBeTruthy();

    fireEvent.pointerDown(overlay!, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.click(overlay!);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create user" }),
      ).not.toBeInTheDocument();
    });
  });

  it("closes the create-user dialog when Escape is pressed", async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    await screen.findByRole("dialog", { name: "Create user" });

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create user" }),
      ).not.toBeInTheDocument();
    });
  });

  it("validates name and password length in the create form", async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    const dialog = await screen.findByRole("dialog", { name: "Create user" });

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "ab" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "x@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Password"), {
      target: { value: "longenough" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await within(dialog).findByText("Name must be at least 3 characters"),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(within(dialog).getByLabelText("Password"), {
      target: { value: "short" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await within(dialog).findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
  });

  it("submits create user via POST and closes the dialog on success", async () => {
    mockedPost.mockResolvedValue({
      data: {
        user: {
          id: "u-new",
          name: "New Agent",
          email: "new@example.com",
          role: "AGENT",
          emailVerified: false,
          createdAt: "2024-07-01T10:00:00.000Z",
        },
      },
    });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    const dialog = await screen.findByRole("dialog", { name: "Create user" });

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
        "/api/users",
        {
          name: "New Agent",
          email: "new@example.com",
          password: "password123",
        },
        { withCredentials: true },
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create user" }),
      ).not.toBeInTheDocument();
    });

    expect(mockedGet.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("opens delete confirmation and closes on cancel", async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Bob Agent")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete user Bob Agent" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete user",
    });
    expect(within(dialog).getByText(/Bob Agent/)).toBeInTheDocument();
    expect(within(dialog).getByText(/bob@example\.com/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("alertdialog", { name: "Delete user" }),
      ).not.toBeInTheDocument();
    });
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it("calls DELETE and invalidates list when delete is confirmed", async () => {
    mockedDelete.mockResolvedValue({ data: undefined, status: 204 });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Bob Agent")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete user Bob Agent" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete user",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith("/api/users/u2", {
        withCredentials: true,
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("alertdialog", { name: "Delete user" }),
      ).not.toBeInTheDocument();
    });

    expect(mockedGet.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
