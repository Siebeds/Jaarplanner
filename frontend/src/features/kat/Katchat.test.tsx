import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSelectie } from "../../state/selectie";
import type { Katantwoord } from "./chat";
import { uitlegblokken } from "./chatzinnen";
import { Gesprek, Vraagveld } from "./Katchat";
import { useKatchat } from "./useKatchat";

/**
 * FB-031: the chat in Chuck's window. What it sends, and how each kind of answer reads. The server is faked; what the
 * model says is the server's test (KatchatServiceTests).
 */

const LEEG: Omit<Katantwoord, "soort"> = { hoofdstukken: [], plekken: [], voorstellen: [], agenda: [], agendaTotaal: 0 };

let antwoorden: Katantwoord[] = [];
let status = 200;
const verzoeken: { pad: string; lichaam: unknown }[] = [];

beforeEach(() => {
  antwoorden = [];
  status = 200;
  verzoeken.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pad: string, init?: RequestInit) => {
      const json = (inhoud: unknown, code = 200) =>
        new Response(JSON.stringify(inhoud), { status: code, headers: { "Content-Type": "application/json" } });
      if (init?.method === "POST") {
        verzoeken.push({ pad, lichaam: JSON.parse(String(init.body)) });
        return status === 200 ? json(antwoorden.shift()) : json({ title: "Fout" }, status);
      }
      if (pad === "/api/schooljaren" || pad === "/api/klassen") return json([]);
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

function Proef({ onSluit }: { onSluit: () => void }) {
  const chat = useKatchat();
  return (
    <>
      <Gesprek chat={chat} onSluit={onSluit} />
      <Vraagveld chat={chat} />
    </>
  );
}

function toon(onSluit = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Proef onSluit={onSluit} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onSluit;
}

function vraag(tekst: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Vraag het Chuck" }), { target: { value: tekst } });
  fireEvent.click(screen.getByRole("button", { name: "Vraag" }));
}

describe("de chat van Chuck", () => {
  it("vraagt niets zolang het veld leeg is", () => {
    toon();
    expect(screen.getByRole("button", { name: "Vraag" })).toBeDisabled();
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
  });

  it("stuurt de vraag en toont de uitleg als stappen, met de hoofdstukken waarop ze steunt", async () => {
    antwoorden = [
      {
        ...LEEG,
        soort: "Uitleg",
        uitleg: "Zo plan je een fiche:\n1. Open het zijpaneel.\n2. Sleep de fiche naar een dag.",
        hoofdstukken: ["Een algemene fiche plannen"],
      },
    ];
    toon();
    vraag("Hoe plan ik een algemene fiche?");

    const gesprek = screen.getByRole("log", { name: "Gesprek met Chuck" });
    expect(within(gesprek).getByText("Hoe plan ik een algemene fiche?")).toBeInTheDocument();
    const stap = await within(gesprek).findByText("Sleep de fiche naar een dag.");
    expect(stap.tagName).toBe("LI");
    expect(stap.closest("ol")?.children).toHaveLength(2);
    expect(within(gesprek).getByText("Uit de handleiding: Een algemene fiche plannen")).toBeInTheDocument();
    expect(verzoeken[0]).toEqual({ pad: "/api/kat/chat", lichaam: { vraag: "Hoe plan ik een algemene fiche?", schooljaarId: null } });
    expect(screen.getByRole("textbox", { name: "Vraag het Chuck" })).toHaveValue("");
  });

  it("zegt dat hij het niet weet, zonder iets te verzinnen", async () => {
    antwoorden = [{ ...LEEG, soort: "Onbekend" }];
    toon();
    vraag("Wat is de hoofdstad van Peru?");

    expect(await screen.findByText(/^Dat weet ik niet\./)).toBeInTheDocument();
  });

  it("laat kiezen als meerdere doelen passen, en zoekt dan opnieuw zonder de AI", async () => {
    const opzoeking = { vraag: "DoelInThema" as const, doel: "hoeveelheden", thema: "Herfst" };
    antwoorden = [
      {
        ...LEEG,
        soort: "Kies",
        opzoeking,
        keuze: {
          wat: "Doel",
          term: "hoeveelheden",
          kandidaten: [
            { id: "G-WI-02", label: "G-WI-02", detail: "Hoeveelheden vergelijken." },
            { id: "G-WI-03", label: "G-WI-03", detail: "Hoeveelheden tellen." },
          ],
        },
      },
      {
        ...LEEG,
        soort: "DoelInThema",
        opzoeking: { ...opzoeking, doel: "G-WI-03" },
        doel: { code: "G-WI-03", soort: "Leerplandoel", tekst: "Hoeveelheden tellen." },
        thema: { id: "t1", naam: "Herfst" },
        ja: true,
        plekken: [
          { soort: "Subdoel", themaId: "t1", thema: "Herfst", subthemaId: "s1", subthema: "Bladeren", leeftijd: "K3", verwijzing: "/themas/t1?subthema=s1" },
        ],
        voorstellen: [{ soort: "Themadoel", themaId: "t1", thema: "Herfst", verwijzing: "/themas/t1" }],
      },
    ];
    toon();
    vraag("Zit het doel over hoeveelheden in Herfst?");

    expect(await screen.findByText('Meerdere doelen passen bij "hoeveelheden". Welk bedoel je?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kies G-WI-03: Hoeveelheden tellen." }));

    expect(await screen.findByText("Ja, G-WI-03 zit in thema Herfst.")).toBeInTheDocument();
    expect(verzoeken[1]).toEqual({
      pad: "/api/kat/chat/opzoeking",
      lichaam: { opzoeking: { ...opzoeking, doel: "G-WI-03" }, schooljaarId: null },
    });
    expect(screen.getByRole("link", { name: "Subdoel van Bladeren (K3), thema Herfst" })).toHaveAttribute(
      "href",
      "/themas/t1?subthema=s1",
    );
    // The proposal is named apart, with its status in words.
    expect(screen.getByText("Nog niet beslist")).toBeInTheDocument();
    expect(screen.getByText("Voorgesteld")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Themadoel van Herfst" })).toBeInTheDocument();
  });

  it("toont de agenda per klas, en een klik kiest die klas en sluit het venster", async () => {
    antwoorden = [
      {
        ...LEEG,
        soort: "WaarGebruikt",
        doel: { code: "MD-K-01", soort: "Minimumdoel", tekst: "Seizoenen herkennen." },
        agenda: [
          { klasId: "k1", klas: "K3 Blauw", soort: "Thema", naam: "Herfst", van: "2026-10-05", tot: "2026-10-30", voorstel: false, verwijzing: "/agenda/dag/2026-10-05" },
          { klasId: "k2", klas: "K3 Groen", soort: "Thema", naam: "Herfst", van: "2026-11-02", tot: "2026-11-27", voorstel: true, verwijzing: "/agenda/dag/2026-11-02" },
        ],
        agendaTotaal: 3,
      },
    ];
    const onSluit = toon();
    vraag("Waar wordt MD-K-01 gebruikt?");

    expect(await screen.findByText("Hier ligt MD-K-01 vast.")).toBeInTheDocument();
    expect(screen.getByText("K3 Blauw")).toBeInTheDocument();
    expect(screen.getByText("K3 Groen")).toBeInTheDocument();
    expect(screen.getByText("En nog 1 ander moment.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("link", { name: "Thema Herfst" })[1]);
    expect(useSelectie.getState().klasId).toBe("k2");
    expect(onSluit).toHaveBeenCalled();
  });

  it("zegt wat hij niet vindt", async () => {
    antwoorden = [{ ...LEEG, soort: "NietGevonden", nietGevonden: { wat: "Thema", term: "Ruimtevaart" } }];
    toon();
    vraag("Welke doelen horen bij Ruimtevaart?");

    expect(await screen.findByText('Ik vind geen thema dat past bij "Ruimtevaart".')).toBeInTheDocument();
  });

  it("zegt dat het nu niet lukt als de server faalt", async () => {
    status = 500;
    toon();
    vraag("Hoe werkt de agenda?");

    expect(await screen.findByText("Ik kon je vraag nu niet beantwoorden. Probeer het later opnieuw.")).toBeInTheDocument();
  });
});

describe("uitlegblokken", () => {
  it("maakt van genummerde regels één lijst en van de rest alinea's", () => {
    expect(uitlegblokken("Eerst dit.\n1. Een\n2) Twee\n\nTot slot.")).toEqual([
      { soort: "alinea", tekst: "Eerst dit." },
      { soort: "stappen", stappen: ["Een", "Twee"] },
      { soort: "alinea", tekst: "Tot slot." },
    ]);
  });
});
