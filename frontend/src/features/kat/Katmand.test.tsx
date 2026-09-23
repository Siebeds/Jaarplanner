import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Schermkop } from "../../app/Schermkop";
import { metIk, ikMet } from "../../test/rechten";
import type { Deurmat } from "./gegevens";
import { Weekhoek } from "./Weekhoek";

/**
 * FB-071: Chuck in the header. What a browser must show (the walk, the contrast, where he lies at 390px) is the browser
 * pass's; this pins what he says, when, and what the window does with focus and with the server.
 */

const LEEG: Deurmat = { signalen: [], voorstellen: [] };

const GEVAAR = {
  id: "s1",
  soort: "MinimumdoelInGevaar" as const,
  klasId: "klas-a",
  klasnaam: "K3 De Uilen",
  gegevens: { doelRef: "K-2.1.81", thema: "Herfst", themaLesweken: 4, vrijeLesweken: 3 },
  verwijzing: "/dekking",
  aangemaakt: "2026-11-16T07:00:00+01:00",
  gezien: false,
};

const KATVOORSTEL = {
  soort: "Activiteitvoorstel" as const,
  id: "v1",
  titel: "Kastanjes tellen",
  verwijzing: null,
  aiMotivatie: "Week 47 raakt nog geen doel uit Wiskunde.",
  klasnaam: "K3 De Uilen",
  datum: "2026-11-19",
  begin: "10:15:00",
  einde: "11:00:00",
};

let zichtbaar = true;
let deurmat: Deurmat = LEEG;
let minderBeweging = false;
const echteMatchMedia = window.matchMedia;

beforeEach(() => {
  zichtbaar = true;
  deurmat = LEEG;
  minderBeweging = false;
  const vorige = window.matchMedia;
  window.matchMedia = (query: string) =>
    query === "(prefers-reduced-motion: reduce)" ? ({ ...vorige(query), matches: minderBeweging } as MediaQueryList) : vorige(query);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pad: string, init?: RequestInit) => {
      const json = (inhoud: unknown) =>
        new Response(JSON.stringify(inhoud), { status: 200, headers: { "Content-Type": "application/json" } });
      if (init?.method === "POST") return new Response(null, { status: 204 });
      if (init?.method === "PUT") return json({ status: "Aanvaard", activiteitId: "a1" });
      if (pad === "/api/kat/instelling") return json({ isZichtbaar: zichtbaar });
      if (pad === "/api/deurmat") return json(deurmat);
      if (pad === "/api/schooljaren" || pad === "/api/klassen") return json([]);
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  window.matchMedia = echteMatchMedia;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function toon({ zonderKat = false, hoekKlasId }: { zonderKat?: boolean; hoekKlasId?: string } = {}) {
  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }), ikMet());
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Schermkop titel="Agenda" zonderKat={zonderKat} />
        {hoekKlasId ? (
          <Weekhoek klasId={hoekKlasId} actief>
            <div>weekstrook</div>
          </Weekhoek>
        ) : null}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const mandknop = () => screen.findByRole("button", { name: /venster van Chuck/ });
const fetchAanroepen = () => vi.mocked(fetch).mock.calls as [string, RequestInit?][];

describe("Chuck in the header", () => {
  it("is not there while the school has not turned him on", async () => {
    zichtbaar = false;
    toon();
    await waitFor(() => expect(fetchAanroepen().some(([pad]) => pad === "/api/kat/instelling")).toBe(true));
    expect(screen.queryByRole("button", { name: /venster van Chuck/ })).not.toBeInTheDocument();
    // And a school that keeps him off is not asked for a deurmat.
    expect(fetchAanroepen().some(([pad]) => pad === "/api/deurmat")).toBe(false);
  });

  it("sleeps with a visible label when nothing waits", async () => {
    toon();
    expect(await screen.findByRole("button", { name: "Chuck slaapt. Open het venster van Chuck." })).toBeInTheDocument();
    expect((await screen.findAllByText("Chuck slaapt")).length).toBeGreaterThan(0);
  });

  it("says in a balloon that something is ready", async () => {
    deurmat = { signalen: [], voorstellen: [KATVOORSTEL] };
    toon();
    expect(await screen.findByRole("button", { name: "Chuck heeft iets klaargezet. Open het venster van Chuck." })).toBeInTheDocument();
    expect((await screen.findAllByText("Ik heb iets voor je klaargezet.")).length).toBeGreaterThan(0);
  });

  it("names the browser tab after the screen (TB-073)", async () => {
    toon({ zonderKat: true });
    await screen.findByRole("heading", { name: "Agenda" });
    expect(document.title).toBe("Agenda · Vizier");
  });

  it("is absent from the ontwikkelingsrapport's screens", async () => {
    toon({ zonderKat: true });
    await screen.findByRole("heading", { name: "Agenda" });
    expect(screen.queryByRole("button", { name: /venster van Chuck/ })).not.toBeInTheDocument();
  });
});

describe("his window", () => {
  it("opens with what he brought, says the chat is not there yet, and takes no input", async () => {
    deurmat = { signalen: [GEVAAR], voorstellen: [KATVOORSTEL] };
    toon();
    fireEvent.click(await mandknop());

    const venster = await screen.findByRole("dialog", { name: "Chuck" }, { timeout: 2000 });
    expect(within(venster).getByText(/Minimumdoel K-2.1.81 raakt niet meer gedekt/)).toBeInTheDocument();
    expect(within(venster).getByText("Voor K3 De Uilen, 19 nov van 10.15 tot 11.00")).toBeInTheDocument();
    expect(within(venster).getByRole("link", { name: /^Bekijken: Minimumdoel/ })).toHaveAttribute("href");
    expect(within(venster).getByRole("button", { name: /^Later: Minimumdoel/ })).toBeInTheDocument();
    expect(within(venster).getByText("Met Chuck praten kan nog niet. Dat komt in een volgende versie.")).toBeInTheDocument();
    expect(within(venster).getByText("Namen en informatie over kinderen horen niet in dit venster.")).toBeInTheDocument();
    expect(within(venster).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("waits about 300 ms for the cat, never for the whole walk, and takes focus on its close button", async () => {
    vi.useFakeTimers();
    toon();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    fireEvent.click(screen.getByRole("button", { name: /venster van Chuck/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sluit het venster van Chuck" })).toHaveFocus();
  });

  it("closes on Escape and puts focus straight back on the cat", async () => {
    toon();
    const knop = await mandknop();
    fireEvent.click(knop);
    await screen.findByRole("dialog", {}, { timeout: 2000 });
    expect(knop).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(knop).toHaveFocus();
    expect(knop).toHaveAttribute("aria-expanded", "false");
  });

  it("with less motion, opens at once and the cat does not step out", async () => {
    minderBeweging = true;
    const { container } = toon();
    fireEvent.click(await mandknop());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const scene = container.querySelector("svg.chuck")!;
    for (const beweging of ["rijst", "uit", "loopt"]) expect(scene).not.toHaveClass(beweging);
  });

  it("links Bekijken, so Ctrl+click opens it in a new tab and leaves the window open (TB-073)", async () => {
    deurmat = { signalen: [GEVAAR], voorstellen: [] };
    toon();
    fireEvent.click(await mandknop());
    const link = await screen.findByRole("link", { name: /^Bekijken: Minimumdoel/ }, { timeout: 2000 });
    expect(link).toHaveAttribute("href", "/dekking");

    // Not prevented: the browser opens the address in a new tab. The signal still counts as seen.
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchAanroepen().some(([pad, init]) => pad === "/api/deurmat/signalen/s1/gezien" && init?.method === "POST")).toBe(true),
    );

    // A plain click stays in this tab: the router follows it and the window closes.
    expect(fireEvent.click(link)).toBe(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("puts a signal off until later through the deurmat", async () => {
    deurmat = { signalen: [GEVAAR], voorstellen: [] };
    toon();
    fireEvent.click(await mandknop());
    fireEvent.click(await screen.findByRole("button", { name: /^Later: Minimumdoel/ }, { timeout: 2000 }));
    await waitFor(() =>
      expect(fetchAanroepen().some(([pad, init]) => pad === "/api/deurmat/signalen/s1/later" && init?.method === "POST")).toBe(true),
    );
  });

  it("accepts a proposal the cat brought through the route every activiteitvoorstel is decided by", async () => {
    deurmat = { signalen: [], voorstellen: [KATVOORSTEL] };
    toon();
    fireEvent.click(await mandknop());
    fireEvent.click(await screen.findByRole("button", { name: "Aanvaard en plan in: Kastanjes tellen" }, { timeout: 2000 }));
    await waitFor(() => {
      const beslissing = fetchAanroepen().find(([pad]) => pad === "/api/activiteitvoorstellen/v1/beslissing");
      expect(beslissing?.[1]?.method).toBe("PUT");
      expect(JSON.parse(String(beslissing?.[1]?.body))).toEqual({ status: "Aanvaard" });
    });
  });
});

describe("what he asserts", () => {
  it("names the klas when he purrs, and says nothing of his posture when the deurmat did not load", async () => {
    deurmat = { signalen: [], voorstellen: [] };
    vi.mocked(fetch).mockImplementation(async (pad) =>
      String(pad) === "/api/kat/instelling"
        ? new Response(JSON.stringify({ isZichtbaar: true }), { status: 200, headers: { "Content-Type": "application/json" } })
        : new Response("{}", { status: 500 }),
    );
    toon();
    const knop = await screen.findByRole("button", { name: /venster van Chuck/ });
    await waitFor(() => expect(knop).toHaveAccessibleName("Chuck. Open het venster van Chuck."));
    expect(screen.queryByText("Chuck slaapt")).not.toBeInTheDocument();
  });
});

describe("on a phone, the window keeps focus inside", () => {
  it("wraps Tab from the last control to the first", async () => {
    minderBeweging = true;
    deurmat = { signalen: [GEVAAR], voorstellen: [] };
    toon();
    fireEvent.click(await mandknop());
    const venster = await screen.findByRole("dialog");
    const knoppen = within(venster).getAllByRole("button");
    await waitFor(() => expect(knoppen.length).toBeGreaterThan(1));
    const laatste = within(venster).getAllByRole("button").at(-1)!;
    laatste.focus();
    fireEvent.keyDown(laatste, { key: "Tab" });
    expect(within(venster).getByRole("button", { name: "Sluit het venster van Chuck" })).toHaveFocus();
  });
});

describe("a goal at risk: exactly one Chuck", () => {
  it("lies on the corner of the week strip of that klas, and his basket in the header is empty", async () => {
    deurmat = { signalen: [GEVAAR], voorstellen: [] };
    const { container } = toon({ hoekKlasId: "klas-a" });

    expect(await screen.findByText("Minimumdoel K-2.1.81 komt in gevaar in K3 De Uilen.")).toBeInTheDocument();
    const katten = [...container.querySelectorAll("svg.chuck")];
    expect(katten).toHaveLength(2);
    // The header's drawing is the empty basket; the one on the week strip is the cat.
    expect(katten[0]).toHaveClass("leeg");
    expect(katten[1]).not.toHaveClass("leeg");
    expect(await screen.findByRole("button", { name: "Chuck: een doel komt in gevaar. Open het venster van Chuck." })).toBeInTheDocument();
  });

  it("stays in his basket and says it there when the week strip on screen is another klas's", async () => {
    deurmat = { signalen: [GEVAAR], voorstellen: [] };
    const { container } = toon({ hoekKlasId: "klas-b" });
    expect((await screen.findAllByText("Minimumdoel K-2.1.81 komt in gevaar in K3 De Uilen.")).length).toBeGreaterThan(0);
    const katten = [...container.querySelectorAll("svg.chuck")];
    expect(katten).toHaveLength(1);
    expect(katten[0]).not.toHaveClass("leeg");
  });
});
