import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { doelenSleutels } from "../../lib/queries";
import type { LeerplandoelDetail, SubdoelWeergave } from "../../lib/types";
import type { Ik } from "../../lib/aanmelding";
import { ikMet, metIk } from "../../test/rechten";
import { Activiteitformulier, type ActiviteitMetKleur } from "./Activiteitformulier";

/**
 * The activiteit sheet's two rights (E6-02 slice 4, ADR-0030 §3): its content, and its goals.
 *
 * The goal picker on a CREATE is the case slice 3 named: goal codes on a new activiteit need the goal-link right
 * (R19), so a leerkracht who may make an activiteit gets no picker, and the create does not carry the field at all.
 *
 * And what the sheet says (TB-025): a goal by its text, opening its detail, and the length in lesuren.
 */

const ACTIVITEIT: ActiviteitMetKleur = {
  id: "a-1",
  naam: "Bladeren sorteren",
  activiteitType: "Spel",
  hoek: null,
  verwachteUitkomsten: "Ze sorteren op kleur.",
  onderzoeksvraagId: null,
  kleur: "Olijf",
  lengteInLesuren: 2,
  doelkoppelingen: [{ id: "k-1", leerplandoelCode: "WO-2", status: "Manueel", aiMotivatie: null }],
};

const DOEL: LeerplandoelDetail = {
  code: "WO-2",
  doelsoort: "Gemeenschappelijk",
  jaarFase: "K3",
  disciplineNummer: "6",
  disciplineNaam: null,
  domein: "Natuur",
  subdomein: "Planten",
  cluster: null,
  tekst: "De kleuters verkennen bladeren en ordenen ze volgens een zelfgekozen kenmerk.",
  voorbeelden: null,
  toelichting: null,
  woordenschat: null,
  minimumdoelRef: null,
  minimumdoel: null,
  nietMeerInOpstap: false,
  koppelingen: [],
  gerelateerdeDoelen: [],
};

function toon(ui: ReactElement, ik?: Ik) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(doelenSleutels.detail("WO-2"), DOEL);
  if (ik) metIk(qc, ik);
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Activiteitformulier", () => {
  it("toont AI-voorstellen apart van de gekoppelde doelen en beslist ze met vinkje en kruisje (FB-026)", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith("/doelsuggesties/genereer")
          ? new Response(JSON.stringify({ isGeslaagd: true, aantalVoorgesteld: 2, aantalOvergeslagen: 0, fout: null }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          : new Response(null, { status: 204 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const activiteit: ActiviteitMetKleur = {
        ...ACTIVITEIT,
        doelkoppelingen: [
          ...ACTIVITEIT.doelkoppelingen,
          { id: "k-2", leerplandoelCode: "WO-7", status: "Voorgesteld", aiMotivatie: "Sorteren is ordenen." },
          { id: "k-3", leerplandoelCode: "WO-9", status: "Geweigerd", aiMotivatie: "Afgewezen." },
        ],
      };
      toon(
        <Activiteitformulier
          open
          activiteit={activiteit}
          themaId="t-1"
          magDoelen
          onKoppel={vi.fn()}
          onOntkoppel={vi.fn()}
          onderzoeksvragen={[]}
          onBewaar={vi.fn()}
          onSluit={vi.fn()}
          bezig={false}
        />,
      );

      // One linked doel; the proposal waits in its own list with its motivation; the rejected one is not shown.
      const voorstellen = screen.getByRole("list", { name: t("doelvoorstel.lijst") });
      expect(within(voorstellen).getByText("WO-7")).toBeInTheDocument();
      expect(within(voorstellen).getByText("Sorteren is ordenen.")).toBeInTheDocument();
      expect(screen.queryByText("WO-9")).toBeNull();
      expect(screen.queryByText("Afgewezen.")).toBeNull();

      fireEvent.click(within(voorstellen).getByRole("button", { name: `${t("plaatsing.aanvaard")}: WO-7` }));
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/activiteiten/a-1/doelkoppelingen/k-2/status"),
          expect.objectContaining({ method: "PUT", body: JSON.stringify({ status: "Aanvaard" }) }),
        ),
      );

      fireEvent.click(screen.getByRole("button", { name: t("doelvoorstel.vraag") }));
      expect(await screen.findByText(t("doelvoorstel.voorstellen", { aantal: 2 }))).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/activiteiten/a-1/doelsuggesties/genereer"),
        expect.objectContaining({ method: "POST" }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("biedt geen AI-knop aan zonder het koppelrecht (FB-026)", () => {
    toon(
      <Activiteitformulier open activiteit={ACTIVITEIT} themaId="t-1" onderzoeksvragen={[]} onBewaar={vi.fn()} onSluit={vi.fn()} bezig={false} />,
    );

    expect(screen.queryByRole("button", { name: t("doelvoorstel.vraag") })).toBeNull();
  });

  it("biedt bij een nieuwe activiteit geen doelen aan zonder het koppelrecht, en stuurt er ook geen mee", () => {
    const bewaar = vi.fn();
    toon(<Activiteitformulier open onderzoeksvragen={[]} onBewaar={bewaar} onSluit={vi.fn()} bezig={false} />);

    expect(screen.queryByRole("button", { name: t("doelkiezer.koppel") })).toBeNull();
    expect(screen.queryByText(t("activiteit.doelenBijBewaren"))).toBeNull();

    fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Nieuw" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(bewaar).toHaveBeenCalledTimes(1);
    expect(bewaar.mock.calls[0][0]).not.toHaveProperty("leerplandoelCodes");
  });

  it("opent een nieuwe activiteit zonder soort, en bewaart ze zonder soort (FB-050)", () => {
    const bewaar = vi.fn();
    toon(<Activiteitformulier open onderzoeksvragen={[]} onBewaar={bewaar} onSluit={vi.fn()} bezig={false} />);

    const soort = screen.getByLabelText(t("activiteit.soort"));
    expect(soort).toHaveValue("");
    expect(screen.getByRole("option", { name: t("activiteit.geenSoort") })).toHaveProperty("selected", true);

    fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Nieuw" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(bewaar).toHaveBeenCalledTimes(1);
    expect(bewaar.mock.calls[0][0]).toMatchObject({ naam: "Nieuw", activiteitType: null, hoek: null });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("bewaart een gekozen soort (FB-050)", () => {
    const bewaar = vi.fn();
    toon(<Activiteitformulier open onderzoeksvragen={[]} onBewaar={bewaar} onSluit={vi.fn()} bezig={false} />);

    fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Bootjes" } });
    fireEvent.change(screen.getByLabelText(t("activiteit.soort")), { target: { value: "Hoek" } });
    fireEvent.change(screen.getByLabelText(t("activiteit.hoek")), { target: { value: "waterhoek" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(bewaar.mock.calls[0][0]).toMatchObject({ activiteitType: "Hoek", hoek: "waterhoek" });
  });

  it("toont bij het bewerken de eigen soort, en laat die weer leeg maken (FB-050)", () => {
    const bewaar = vi.fn();
    toon(
      <Activiteitformulier open activiteit={ACTIVITEIT} onderzoeksvragen={[]} onBewaar={bewaar} onSluit={vi.fn()} bezig={false} />,
    );

    const soort = screen.getByLabelText(t("activiteit.soort"));
    expect(soort).toHaveValue("Spel");

    fireEvent.change(soort, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));
    expect(bewaar.mock.calls[0][0]).toMatchObject({ activiteitType: null });
  });

  it("noemt geen soort in de feiten van een activiteit zonder soort (FB-050)", () => {
    toon(
      <Activiteitformulier
        open
        alleenLezen
        activiteit={{ ...ACTIVITEIT, activiteitType: null }}
        onderzoeksvragen={[]}
        onBewaar={vi.fn()}
        onSluit={vi.fn()}
        bezig={false}
      />,
    );

    const blad = screen.getByRole("dialog");
    expect(within(blad).queryByText(t("activiteit.soort"))).toBeNull();
    expect(within(blad).getByText(t("activiteit.kleur"))).toBeInTheDocument();
  });

  it("biedt ze wel aan wie op die leeftijd doelen mag koppelen", () => {
    toon(<Activiteitformulier open magDoelen onderzoeksvragen={[]} onBewaar={vi.fn()} onSluit={vi.fn()} bezig={false} />);

    expect(screen.getByRole("button", { name: t("doelkiezer.koppel") })).toBeInTheDocument();
  });

  it("toont een bestaande activiteit als feiten aan wie haar niet mag aanpassen", () => {
    toon(
      <Activiteitformulier
        open
        alleenLezen
        activiteit={ACTIVITEIT}
        onderzoeksvragen={[]}
        onBewaar={vi.fn()}
        onSluit={vi.fn()}
        bezig={false}
      />,
    );

    const blad = screen.getByRole("dialog");
    expect(within(blad).getByRole("heading", { name: "Bladeren sorteren" })).toBeInTheDocument();
    expect(within(blad).getByText(t("activiteitsoort.Spel"))).toBeInTheDocument();
    expect(within(blad).getByText("Ze sorteren op kleur.")).toBeInTheDocument();
    expect(within(blad).getByText("WO-2")).toBeInTheDocument();
    expect(within(blad).getByText(DOEL.tekst)).toBeInTheDocument();
    expect(
      within(blad).getByText(t("activiteit.duurFeit", { lesuren: t("activiteit.lesuren", { aantal: 2 }), minuten: 100 })),
    ).toBeInTheDocument();
    expect(within(blad).queryByRole("textbox")).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("activiteit.ontkoppel", { code: "WO-2" }) })).toBeNull();
  });

  it("toont bij een bestaande activiteit de doelen niet als te bewerken zonder het koppelrecht", () => {
    toon(
      <Activiteitformulier
        open
        activiteit={ACTIVITEIT}
        onderzoeksvragen={[]}
        onBewaar={vi.fn()}
        onSluit={vi.fn()}
        bezig={false}
        onKoppel={vi.fn()}
        onOntkoppel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: t("themabeheer.bewaar") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("activiteit.ontkoppel", { code: "WO-2" }) })).toBeNull();
    expect(screen.queryByRole("button", { name: t("doelkiezer.koppel") })).toBeNull();
  });

  it("toont een gekoppeld doel met zijn tekst, en opent er het doeldetail mee (TB-025)", async () => {
    const ontkoppel = vi.fn();
    toon(
      <Activiteitformulier
        open
        magDoelen
        activiteit={ACTIVITEIT}
        onderzoeksvragen={[]}
        onBewaar={vi.fn()}
        onSluit={vi.fn()}
        bezig={false}
        onKoppel={vi.fn()}
        onOntkoppel={ontkoppel}
      />,
    );

    const blad = screen.getByRole("dialog");
    expect(within(blad).getByText(DOEL.tekst)).toBeInTheDocument();

    // Removing stays its own control beside the row.
    fireEvent.click(within(blad).getByRole("button", { name: t("activiteit.ontkoppel", { code: "WO-2" }) }));
    expect(ontkoppel).toHaveBeenCalledWith("k-1");

    fireEvent.click(within(blad).getByRole("button", { name: new RegExp(DOEL.tekst) }));
    expect(await screen.findByRole("dialog", { name: t("doel.titel") })).toBeInTheDocument();
  });

  it("noemt de duur in lesuren, met de minuten eronder (TB-025)", () => {
    const bewaar = vi.fn();
    toon(
      <Activiteitformulier
        open
        activiteit={ACTIVITEIT}
        onderzoeksvragen={[]}
        onBewaar={bewaar}
        onSluit={vi.fn()}
        bezig={false}
      />,
    );

    const twee = screen.getByRole("button", { name: /2 lesuren/ });
    expect(twee).toHaveAttribute("aria-pressed", "true");
    expect(twee).toHaveTextContent(t("activiteit.minutenKort", { aantal: 100 }));

    const een = screen.getByRole("button", { name: new RegExp(t("activiteit.eenLesuur")) });
    expect(een).toHaveTextContent(t("activiteit.minutenKort", { aantal: 50 }));
    fireEvent.click(een);
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));
    expect(bewaar.mock.calls[0][0]).toMatchObject({ lengteInLesuren: 1 });
  });

  describe("eigen of gedeeld (ADR-0049)", () => {
    const leerkracht = ikMet({ leerkrachtLeeftijden: ["K3"] });
    const beide = ikMet({ leerkrachtLeeftijden: ["K3"], hoofdleerkrachtLeeftijden: ["K3"] });

    function bewaarNieuw(bewaar: ReturnType<typeof vi.fn>) {
      fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Nieuw" } });
      fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));
      return bewaar.mock.calls[0][0];
    }

    it("maakt voor een leerkracht zonder keuze een eigen activiteit, met de doelenkiezer", () => {
      const bewaar = vi.fn();
      toon(
        <Activiteitformulier open leeftijd="K3" onderzoeksvragen={[]} onBewaar={bewaar} onSluit={vi.fn()} bezig={false} />,
        leerkracht,
      );

      expect(screen.queryByRole("radiogroup", { name: t("activiteit.voorWie") })).toBeNull();
      expect(screen.getByText(t("activiteit.doelenBijBewaren"))).toBeInTheDocument();
      expect(bewaarNieuw(bewaar)).toMatchObject({ gedeeld: false, leerplandoelCodes: [] });
    });

    it("laat wie ook gedeelde mag maken kiezen, standaard alleen voor zichzelf", () => {
      const bewaar = vi.fn();
      toon(
        <Activiteitformulier open leeftijd="K3" onderzoeksvragen={[]} onBewaar={bewaar} onSluit={vi.fn()} bezig={false} />,
        beide,
      );

      const keuze = screen.getByRole("radiogroup", { name: t("activiteit.voorWie") });
      expect(within(keuze).getByRole("radio", { name: t("activiteit.alleenVoorMij") })).toHaveAttribute("aria-checked", "true");
      fireEvent.click(within(keuze).getByRole("radio", { name: t("activiteit.gedeeldMetSubthema") }));
      expect(bewaarNieuw(bewaar)).toMatchObject({ gedeeld: true });
    });

    it("toont bij een activiteit van een collega van wie ze is, en biedt Gebruiken", () => {
      const gebruik = vi.fn();
      toon(
        <Activiteitformulier
          open
          alleenLezen
          activiteit={{ ...ACTIVITEIT, eigenaarId: "ander", eigenaarNaam: "An" }}
          onderzoeksvragen={[]}
          onBewaar={vi.fn()}
          onSluit={vi.fn()}
          bezig={false}
          onGebruik={gebruik}
        />,
        leerkracht,
      );

      expect(screen.getByText(t("activiteit.vanCollega", { naam: "An" }))).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: t("activiteit.gebruik") }));
      expect(gebruik).toHaveBeenCalledTimes(1);
    });
  });

  describe("de subdoelen van het subthema bij een nieuwe activiteit (FB-051)", () => {
    const hoofdleerkracht = ikMet({ hoofdleerkrachtLeeftijden: ["K3"] });
    const subdoel = (code: string, status: "Manueel" | "Aanvaard" | "Voorgesteld" = "Manueel"): SubdoelWeergave => ({
      id: `s-${code}`,
      leeftijd: "K3",
      koppeling: { id: `k-${code}`, leerplandoelCode: code, status, aiMotivatie: null },
    });
    const VIER = [subdoel("WO-1"), subdoel("WO-2"), subdoel("WO-3", "Aanvaard"), subdoel("WO-4")];

    function metRegister<T>(test: () => Promise<T>) {
      const regel = (code: string) => ({ ...DOEL, code, domein: "Natuur", subdomein: "Planten" });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string) => {
          const code = decodeURIComponent(url.split("/api/leerplandoelen/")[1] ?? "");
          // The search, a doel's detail, and an empty list for anything else the form asks (the klassen).
          const body = url.includes("/api/leerplandoelen?")
            ? { regels: [regel("WO-2"), regel("MU-5")], totaal: 2, overslaan: 0, aantal: 8 }
            : code
              ? { ...DOEL, code, tekst: `Tekst van ${code}` }
              : [];
          return Promise.resolve(
            new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }),
          );
        }),
      );
      return test().finally(() => vi.unstubAllGlobals());
    }

    it("toont elk subdoel op één regel met een vinkje, en bewaart de aangevinkte samen met een ander doel", () =>
      metRegister(async () => {
        const bewaar = vi.fn();
        toon(
          <Activiteitformulier
            open
            leeftijd="K3"
            subdoelen={[...VIER, subdoel("WO-9", "Voorgesteld")]}
            onderzoeksvragen={[]}
            onBewaar={bewaar}
            onSluit={vi.fn()}
            bezig={false}
          />,
          hoofdleerkracht,
        );

        const lijst = screen.getByRole("group", { name: t("activiteit.subdoelenVanSubthema") });
        const vinkjes = within(lijst).getAllByRole("checkbox");
        // The four decided subdoelen; an undecided one is not a subdoel yet.
        expect(vinkjes).toHaveLength(4);
        expect(within(lijst).queryByText("WO-9")).toBeNull();
        expect(within(lijst).getAllByRole("listitem")).toHaveLength(4);
        expect(await within(lijst).findByText("Tekst van WO-1")).toBeInTheDocument();

        fireEvent.click(within(lijst).getByRole("checkbox", { name: /WO-1/ }));
        fireEvent.click(within(lijst).getByRole("checkbox", { name: /WO-3/ }));
        expect(within(lijst).getByRole("checkbox", { name: /WO-1/ })).toBeChecked();

        // Another doel from the register; the search does not offer a subdoel, which is a row above.
        fireEvent.click(screen.getByRole("button", { name: t("doelkiezer.koppel") }));
        fireEvent.change(screen.getByPlaceholderText(t("doelkiezer.zoek")), { target: { value: "bl" } });
        const ander = await screen.findByRole("button", { name: /MU-5/ });
        expect(within(ander.closest("ul")!).queryByRole("button", { name: /WO-2/ })).toBeNull();
        fireEvent.click(ander);
        expect(screen.getByRole("button", { name: t("activiteit.codeWeg", { code: "MU-5" }) })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Nieuw" } });
        fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));
        expect(bewaar.mock.calls[0][0].leerplandoelCodes).toEqual(["WO-1", "WO-3", "MU-5"]);
      }));

    it("haalt een uitgevinkt subdoel weer uit wat bewaard wordt", () =>
      metRegister(async () => {
        const bewaar = vi.fn();
        toon(
          <Activiteitformulier open leeftijd="K3" subdoelen={VIER} onderzoeksvragen={[]} onBewaar={bewaar} onSluit={vi.fn()} bezig={false} />,
          hoofdleerkracht,
        );

        const vinkje = screen.getByRole("checkbox", { name: /WO-2/ });
        fireEvent.click(vinkje);
        fireEvent.click(vinkje);
        expect(vinkje).not.toBeChecked();

        fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Nieuw" } });
        fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));
        expect(bewaar.mock.calls[0][0].leerplandoelCodes).toEqual([]);
      }));

    it("opent het volledige doel zonder het aan te vinken", () =>
      metRegister(async () => {
        toon(
          <Activiteitformulier open leeftijd="K3" subdoelen={VIER} onderzoeksvragen={[]} onBewaar={vi.fn()} onSluit={vi.fn()} bezig={false} />,
          hoofdleerkracht,
        );

        fireEvent.click(screen.getByRole("button", { name: t("activiteit.subdoelBekijk", { code: "WO-2" }) }));
        expect(await screen.findByRole("dialog", { name: t("doel.titel") })).toBeInTheDocument();
        // The form sits behind the detail now, so it is hidden from the accessibility tree.
        expect(screen.getByRole("checkbox", { name: /WO-2/, hidden: true })).not.toBeChecked();
      }));

    it("zegt het bij een subthema zonder subdoelen, en laat andere doelen toevoegen", () => {
      toon(
        <Activiteitformulier open leeftijd="K3" subdoelen={[]} onderzoeksvragen={[]} onBewaar={vi.fn()} onSluit={vi.fn()} bezig={false} />,
        hoofdleerkracht,
      );

      expect(screen.getByText(t("activiteit.geenSubdoelen"))).toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).toBeNull();
      expect(screen.getByText(t("activiteit.andereDoelen"))).toBeInTheDocument();
      expect(screen.getByRole("button", { name: t("doelkiezer.koppel") })).toBeInTheDocument();
    });

    it("toont de lijst niet aan wie geen doelen mag koppelen op die leeftijd", () => {
      // Themabeheer holds no row of R17 or R19 at K3, so the form offers no goal section at all, and sends no codes.
      const bewaar = vi.fn();
      toon(
        <Activiteitformulier open leeftijd="K3" subdoelen={VIER} onderzoeksvragen={[]} onBewaar={bewaar} onSluit={vi.fn()} bezig={false} />,
        ikMet({ heeftThemabeheer: true, leerkrachtLeeftijden: ["K2"], hoofdleerkrachtLeeftijden: ["K2"] }),
      );

      expect(screen.queryByRole("group", { name: t("activiteit.subdoelenVanSubthema") })).toBeNull();
      expect(screen.queryByRole("checkbox")).toBeNull();
      fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Nieuw" } });
      fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));
      expect(bewaar.mock.calls[0][0]).not.toHaveProperty("leerplandoelCodes");
    });

    it("toont de lijst niet bij het bewerken van een bestaande activiteit", () => {
      toon(
        <Activiteitformulier
          open
          activiteit={ACTIVITEIT}
          magDoelen
          onKoppel={vi.fn()}
          onOntkoppel={vi.fn()}
          subdoelen={VIER}
          onderzoeksvragen={[]}
          onBewaar={vi.fn()}
          onSluit={vi.fn()}
          bezig={false}
        />,
      );

      expect(screen.queryByRole("checkbox")).toBeNull();
    });
  });
});
