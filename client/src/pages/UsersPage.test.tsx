import { screen, waitFor, within } from "@testing-library/react";
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
    }),
  };
});

const mockedGet = vi.mocked(axios.get);

beforeEach(() => {
  mockedGet.mockReset();
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
    mockedGet.mockResolvedValue({
      data: {
        users: [
          {
            id: "u1",
            name: "Alice Admin",
            email: "alice@example.com",
            role: "ADMIN",
            emailVerified: true,
            createdAt: "2024-06-01T12:00:00.000Z",
          },
          {
            id: "u2",
            name: "Bob Agent",
            email: "bob@example.com",
            role: "AGENT",
            emailVerified: false,
            createdAt: "2024-06-02T15:30:00.000Z",
          },
        ],
      },
    });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    });

    expect(screen.getByText("Bob Agent")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("ADMIN").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("AGENT")).toBeInTheDocument();
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
});
