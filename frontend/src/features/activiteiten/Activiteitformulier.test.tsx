import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { doelenSleutels } from "../../lib/queries";
import type { LeerplandoelDetail } from "../../lib/types";
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

function toon(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(doelenSleutels.detail("WO-2"), DOEL);
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Activiteitformulier", () => {
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
});
