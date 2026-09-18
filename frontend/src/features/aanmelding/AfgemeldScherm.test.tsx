import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AfgemeldScherm } from "./AfgemeldScherm";
import { t } from "../../i18n";

/**
 * The signed-out page (TB-032). A read here would answer 401 and send the browser back to Microsoft, which signs a
 * known account in again without a password, so the sign-out would seem to do nothing. The page must render without
 * asking the API anything.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AfgemeldScherm", () => {
  it("zegt dat je afgemeld bent zonder de API te vragen", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<AfgemeldScherm />);

    expect(screen.getByRole("heading", { level: 1, name: t("aanmelding.afgemeld.titel") })).toBeInTheDocument();
    expect(screen.getByText(t("aanmelding.afgemeld.gedeeldeComputer"))).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("meldt opnieuw aan met terugkeer naar het begin", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<AfgemeldScherm />);

    expect(screen.getByRole("link", { name: t("aanmelding.afgemeld.opnieuw") })).toHaveAttribute(
      "href",
      "/api/aanmelden?terugNaar=%2F",
    );
  });
});
