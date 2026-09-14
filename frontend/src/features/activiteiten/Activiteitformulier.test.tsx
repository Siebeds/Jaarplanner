import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { Activiteitformulier, type ActiviteitMetKleur } from "./Activiteitformulier";

/**
 * The activiteit sheet's two rights (E6-02 slice 4, ADR-0030 §3): its content, and its goals.
 *
 * The goal picker on a CREATE is the case slice 3 named: goal codes on a new activiteit need the goal-link right
 * (R19), so a leerkracht who may make an activiteit gets no picker, and the create does not carry the field at all.
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

describe("Activiteitformulier", () => {
  it("biedt bij een nieuwe activiteit geen doelen aan zonder het koppelrecht, en stuurt er ook geen mee", () => {
    const bewaar = vi.fn();
    render(<Activiteitformulier open onderzoeksvragen={[]} onBewaar={bewaar} onSluit={vi.fn()} bezig={false} />);

    expect(screen.queryByRole("button", { name: t("doelkiezer.koppel") })).toBeNull();
    expect(screen.queryByText(t("activiteit.doelenBijBewaren"))).toBeNull();

    fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Nieuw" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(bewaar).toHaveBeenCalledTimes(1);
    expect(bewaar.mock.calls[0][0]).not.toHaveProperty("leerplandoelCodes");
  });

  it("biedt ze wel aan wie op die leeftijd doelen mag koppelen", () => {
    render(
      <Activiteitformulier open magDoelen onderzoeksvragen={[]} onBewaar={vi.fn()} onSluit={vi.fn()} bezig={false} />,
    );

    expect(screen.getByRole("button", { name: t("doelkiezer.koppel") })).toBeInTheDocument();
  });

  it("toont een bestaande activiteit als feiten aan wie haar niet mag aanpassen", () => {
    render(
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
    expect(within(blad).queryByRole("textbox")).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
    expect(within(blad).queryByRole("button", { name: t("activiteit.ontkoppel", { code: "WO-2" }) })).toBeNull();
  });

  it("toont bij een bestaande activiteit de doelen niet als te bewerken zonder het koppelrecht", () => {
    render(
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
});
