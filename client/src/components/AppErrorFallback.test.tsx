import { fireEvent, render, screen } from "@testing-library/react";
import * as Sentry from "@sentry/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorFallback } from "./AppErrorFallback";

function Boom(): never {
  throw new Error("Boom");
}

function renderBoundary(onReset?: () => void) {
  return render(
    <Sentry.ErrorBoundary
      fallback={(props) => <AppErrorFallback {...props} />}
      onReset={onReset}
    >
      <Boom />
    </Sentry.ErrorBoundary>,
  );
}

describe("AppErrorFallback", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the fallback screen instead of a blank tree when a child throws", () => {
    renderBoundary();

    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("calls resetError when Try again is clicked", () => {
    const onReset = vi.fn();
    renderBoundary(onReset);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
