import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { t } from "./i18n";

function renderApp() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App skeleton", () => {
  it("renders the app title (brand word)", () => {
    renderApp();
    expect(
      screen.getByRole("heading", { name: "Jaarplanner" }),
    ).toBeInTheDocument();
  });

  it("renders the subtitle from nl.json via t()", () => {
    renderApp();
    // Asserting against t() proves the copy comes from the catalogue, not a literal.
    expect(screen.getByText(t("app.ondertitel"))).toBeInTheDocument();
  });

  it("toggles the Zustand-backed UI state with i18n labels", () => {
    renderApp();
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent(t("zijbalk.gesloten"));
    expect(button).toHaveAttribute("aria-label", t("zijbalk.toggleOpenen"));
    fireEvent.click(button);
    expect(button).toHaveTextContent(t("zijbalk.open"));
    expect(button).toHaveAttribute("aria-label", t("zijbalk.toggleSluiten"));
  });
});
