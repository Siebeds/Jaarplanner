import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeenToegangScherm } from "./GeenToegangScherm";
import { afmeldNavigatie } from "../../lib/aanmelding";
import { t } from "../../i18n";

/**
 * The refusal page (E6-01). The first test is the one that matters: a read on this page would be
 * answered 401, send the browser to the sign-in, have Microsoft sign the same account in again and
 * land here again, in a loop. So the page must render without asking the API anything.
 */
function renderScherm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GeenToegangScherm />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GeenToegangScherm", () => {
  it("vraagt de API niets wanneer het opent", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    renderScherm();

    expect(screen.getByRole("heading", { level: 1, name: t("aanmelding.geenToegang.titel") })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("probeert opnieuw via de aanmelding, terug naar het begin", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderScherm();

    expect(screen.getByRole("link", { name: t("aanmelding.geenToegang.opnieuw") })).toHaveAttribute(
      "href",
      "/api/aanmelden?terugNaar=%2F",
    );
  });

  it("meldt af bij Microsoft om een ander account te kunnen kiezen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ doorsturenNaar: "https://login.voorbeeld.test/logout" }), { status: 200 })),
    );
    const gaNaar = vi.spyOn(afmeldNavigatie, "gaNaar").mockImplementation(() => {});
    renderScherm();

    fireEvent.click(screen.getByRole("button", { name: t("aanmelding.geenToegang.anderAccount") }));

    await waitFor(() => expect(gaNaar).toHaveBeenCalledWith("https://login.voorbeeld.test/logout"));
  });
});
