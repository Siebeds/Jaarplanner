import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { GeplandeActiviteit } from "../../lib/types";
import { Weekvoorstel } from "./Weekvoorstel";

/**
 * The weekvoorstel in the agenda toolbar (FB-027, ADR-0067, TB-081): asking, the count and the panel behind it, what an
 * open proposal shows, and what accepting, rejecting and accepting all send.
 */

/** Opens the panel through the count beside the AI button. */
function openPaneel() {
  fireEvent.click(screen.getByRole("button", { name: /voorstel$/ }));
}

function blok(delen: Partial<GeplandeActiviteit>): GeplandeActiviteit {
  return {
    plaatsingId: "p-1",
    activiteitId: "a-1",
    activiteitNaam: "Bladeren stempelen",
    activiteitType: "Experiment",
    subthemaId: "s-1",
    subthemaNaam: "Bladeren",
    themaId: "t-1",
    themaNaam: "Herfst",
    begin: "09:00:00",
    einde: "09:50:00",
    status: "Manueel",
    kleur: null,
    doelcodes: [],
    valtBuitenThemaperiode: false,
    aiMotivatie: null,
    ...delen,
  };
}

const VOORSTEL = blok({ plaatsingId: "p-2", activiteitNaam: "Bladerenrace", status: "Voorgesteld", aiMotivatie: "Past bij de start van de week." });

type Oproep = { methode: string; pad: string; lichaam: unknown };

function toon(
  activiteiten: GeplandeActiviteit[],
  antwoord: unknown = { aantalVoorgesteld: 2, pastNiet: ["Kastanjes tellen"], aantalOvergeslagen: 0 },
  /** A problem detail that refuses every decision, as the server does for a stale proposal. */
  beslisWeigering?: string,
) {
  const oproepen: Oproep[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const pad = String(url);
      const methode = init?.method ?? "GET";
      oproepen.push({ methode, pad, lichaam: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (pad.endsWith("/weekvoorstel")) return new Response(JSON.stringify(antwoord), { status: 200 });
      if (beslisWeigering && pad.endsWith("/beslissing")) {
        return new Response(JSON.stringify({ detail: beslisWeigering }), {
          status: 400,
          headers: { "Content-Type": "application/problem+json" },
        });
      }
      return new Response(JSON.stringify({ dagen: [] }), { status: 200 });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Weekvoorstel
        klasId="k-1"
        datum="2026-09-28"
        dagen={[
          { datum: "2026-09-28", activiteiten },
          { datum: "2026-09-29", activiteiten: [] },
        ]}
      />
    </QueryClientProvider>,
  );
  return oproepen;
}

afterEach(() => vi.unstubAllGlobals());

describe("Weekvoorstel", () => {
  it("vraagt de week van de gekozen dag en opent het paneel met wat er voorgesteld is en wat nergens past", async () => {
    const oproepen = toon([]);

    fireEvent.click(screen.getByRole("button", { name: t("weekvoorstel.vraag") }));

    const paneel = await screen.findByRole("dialog");
    expect(within(paneel).getByText(/2 activiteiten voorgesteld\./)).toBeInTheDocument();
    expect(within(paneel).getByText(/Past nergens meer deze week: Kastanjes tellen\./)).toBeInTheDocument();
    expect(oproepen).toContainEqual({ methode: "POST", pad: "/api/klassen/k-1/jaarplan/weekvoorstel", lichaam: { datum: "2026-09-28" } });
  });

  it("toont een open voorstel met zijn moment en motivatie, en een gepland blok niet", () => {
    toon([blok({}), VOORSTEL]);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    openPaneel();

    const lijst = screen.getByRole("list");
    expect(within(lijst).getAllByRole("listitem")).toHaveLength(1);
    expect(within(lijst).getByText("Bladerenrace")).toBeInTheDocument();
    expect(within(lijst).getByText("Past bij de start van de week.")).toBeInTheDocument();
    expect(within(lijst).getByText(t("weekvoorstel.voorstel"))).toBeInTheDocument();
    expect(within(lijst).getByText(/maandag 28 september, 9:00/)).toBeInTheDocument();
    expect(screen.getByText("1 voorstel van de AI")).toBeInTheDocument();
  });

  it("aanvaardt en weigert een voorstel per blok", async () => {
    const oproepen = toon([VOORSTEL]);
    openPaneel();

    fireEvent.click(screen.getByRole("button", { name: "Aanvaard: Bladerenrace" }));
    await waitFor(() =>
      expect(oproepen).toContainEqual({
        methode: "PUT",
        pad: "/api/klassen/k-1/jaarplan/weekplanning/p-2/beslissing",
        lichaam: { aanvaard: true },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Weiger: Bladerenrace" }));
    await waitFor(() =>
      expect(oproepen).toContainEqual({
        methode: "PUT",
        pad: "/api/klassen/k-1/jaarplan/weekplanning/p-2/beslissing",
        lichaam: { aanvaard: false },
      }),
    );
  });

  it("een geweigerde beslissing staat in het paneel en wordt voorgelezen", async () => {
    toon([VOORSTEL], undefined, "Dit voorstel is al beslist.");
    openPaneel();

    fireEvent.click(screen.getByRole("button", { name: "Aanvaard: Bladerenrace" }));

    await waitFor(() =>
      expect(document.querySelector("[aria-live=polite]")).toHaveTextContent("Dit voorstel is al beslist."),
    );
    expect(within(screen.getByRole("dialog")).getByText("Dit voorstel is al beslist.")).toBeInTheDocument();
  });

  it("aanvaardt alles over de dagen die in beeld zijn", async () => {
    const oproepen = toon([VOORSTEL]);
    openPaneel();

    fireEvent.click(screen.getByRole("button", { name: t("weekvoorstel.allesAanvaarden") }));

    await waitFor(() =>
      expect(oproepen).toContainEqual({
        methode: "POST",
        pad: "/api/klassen/k-1/jaarplan/weekvoorstel/aanvaard",
        lichaam: { van: "2026-09-28", tot: "2026-09-29" },
      }),
    );
  });

  it("zonder open voorstel is er geen teller en niets om te aanvaarden", () => {
    toon([blok({})]);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: t("weekvoorstel.allesAanvaarden") })).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
