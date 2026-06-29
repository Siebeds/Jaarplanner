import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";

function renderApp() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App skeleton", () => {
  it("renders the app title", () => {
    renderApp();
    expect(
      screen.getByRole("heading", { name: "Jaarplanner" }),
    ).toBeInTheDocument();
  });

  it("toggles the Zustand-backed UI state", () => {
    renderApp();
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("sidebar: closed");
    fireEvent.click(button);
    expect(button).toHaveTextContent("sidebar: open");
  });
});
