import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import { PlanScherm } from "./PlanScherm";

/**
 * The jaarplan's header (FB-089): the agenda's own view switch with Jaar chosen, in place of the single link back.
 * Rendered without a klas, because the header is the same whatever the plan holds and needs no plan to load.
 */

vi.mock("../../lib/selectie", () => ({
  useActieveSelectie: () => ({
    klas: null,
    klasId: null,
    schooljaarId: null,
    schooljaar: null,
    schooljaren: [],
    klassen: [],
    laadt: false,
    kiesSchooljaar: () => {},
    kiesKlas: () => {},
  }),
}));

function Adres() {
  const { pathname, search } = useLocation();
  return <p data-testid="adres">{pathname + search}</p>;
}

function toon() {
  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ikMet({}));
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/agenda/periodes"]}>
        <Routes>
          <Route path="agenda/periodes" element={<PlanScherm />} />
          <Route path="agenda" element={<Adres />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PlanScherm: de weergavekeuze (FB-089)", () => {
  it("toont de weergavekeuze met Jaar gekozen, en geen losse knop naar de agenda", () => {
    toon();

    expect(screen.getByRole("radiogroup", { name: t("periode.weergave") })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: t("periode.jaar") })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("link", { name: t("navigatie.agenda") })).toBeNull();
  });

  it("opent de agenda in de gekozen weergave", () => {
    toon();

    fireEvent.click(screen.getByRole("radio", { name: t("periode.maand") }));

    expect(screen.getByTestId("adres")).toHaveTextContent("/agenda?weergave=maand");
  });

  it("opent de agenda zonder weergave in de URL voor de werkweek, de standaard", () => {
    toon();

    fireEvent.click(screen.getByRole("radio", { name: t("periode.werkweek") }));

    expect(screen.getByTestId("adres").textContent).toBe("/agenda");
  });
});
