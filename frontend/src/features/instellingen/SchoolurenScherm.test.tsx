import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { Ik } from "../../lib/aanmelding";
import { DIRECTIE, ikMet, metIk } from "../../test/rechten";
import type { Schooldaguren, Schooluren } from "../schooluren/gegevens";
import { SchoolurenScherm } from "./SchoolurenScherm";

/**
 * Instellingen, Schooluren (FB-023): directie fills in the week and saves it whole; everyone else reads it.
 */
function json(inhoud: unknown, status = 200) {
  return new Response(JSON.stringify(inhoud), { status, headers: { "Content-Type": "application/json" } });
}

const MAANDAG: Schooldaguren = {
  weekdag: 1,
  begin: "08:30:00",
  einde: "15:30:00",
  middagpauzeBegin: "12:00:00",
  middagpauzeEinde: "13:15:00",
};

function toon(ik: Ik, uren: Schooluren, opPut?: (body: Schooluren) => Response) {
  const fetchMock = vi.fn(async (pad: string, init?: RequestInit) => {
    if (pad.endsWith("/api/schooluren") && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as Schooluren;
      return opPut ? opPut(body) : json(body);
    }
    if (pad.endsWith("/api/schooluren")) return json(uren);
    if (pad.endsWith("/api/ik")) return json(ik);
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);

  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), ik);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/instellingen/schooluren"]}>
        <SchoolurenScherm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return fetchMock;
}

function verstuurd(fetchMock: ReturnType<typeof toon>): Schooluren[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)) as Schooluren);
}

const vul = (label: string, waarde: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: waarde } });

afterEach(() => vi.unstubAllGlobals());

describe("SchoolurenScherm", () => {
  it("toont directie de uren van de school en bewaart de hele week in een keer", async () => {
    const fetchMock = toon(DIRECTIE, { dagen: [MAANDAG] });

    // Every field is named by its day, its group and its edge, so five rows are not five fields called "van".
    expect(await screen.findByLabelText("Maandag Schooldag van")).toHaveValue("08:30");
    expect(screen.getByLabelText("Maandag Middagpauze tot")).toHaveValue("13:15");

    vul("Dinsdag Schooldag van", "08:30");
    vul("Dinsdag Schooldag tot", "15:30");
    vul("Dinsdag Middagpauze van", "12:00");
    vul("Dinsdag Middagpauze tot", "13:15");

    // Wednesday without an afternoon: no middagpauze.
    vul("Woensdag Schooldag van", "08:30");
    vul("Woensdag Schooldag tot", "12:00");
    fireEvent.click(screen.getByRole("checkbox", { name: "Woensdag Middagpauze" }));
    expect(screen.queryByLabelText("Woensdag Middagpauze van")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t("schooluren.bewaar") }));

    expect(await screen.findByText(t("schooluren.bewaard"))).toBeInTheDocument();
    expect(verstuurd(fetchMock)).toEqual([
      {
        dagen: [
          MAANDAG,
          { ...MAANDAG, weekdag: 2 },
          { weekdag: 3, begin: "08:30:00", einde: "12:00:00", middagpauzeBegin: null, middagpauzeEinde: null },
        ],
      },
    ]);
  });

  it("weigert een halve dag zelf, met de dag erbij, en stuurt niets", async () => {
    const fetchMock = toon(DIRECTIE, { dagen: [] });

    await screen.findByLabelText("Dinsdag Schooldag van");
    vul("Dinsdag Schooldag van", "08:30");
    fireEvent.click(screen.getByRole("button", { name: t("schooluren.bewaar") }));

    expect(await screen.findByText(t("schooluren.onvolledig", { dag: "dinsdag" }))).toBeInTheDocument();
    expect(verstuurd(fetchMock)).toEqual([]);
  });

  it("toont de Nederlandse zin van de server wanneer die de uren weigert", async () => {
    const zin = "Op maandag moet de middagpauze binnen de schooldag vallen, tussen 8:30 en 15:30.";
    toon(DIRECTIE, { dagen: [MAANDAG] }, () => json({ title: "Ongeldige aanvraag", status: 400, detail: zin }, 400));

    await screen.findByLabelText("Maandag Schooldag van");
    fireEvent.click(screen.getByRole("button", { name: t("schooluren.bewaar") }));

    expect(await screen.findByText(zin)).toBeInTheDocument();
    expect(screen.getByText(t("schooluren.bewaarMislukt"))).toBeInTheDocument();
    expect(screen.queryByText(t("schooluren.bewaard"))).not.toBeInTheDocument();
  });

  it("laat wie geen directie is de uren lezen, zonder veld of knop", async () => {
    toon(ikMet({ eigenKlasIds: ["k1"], leerkrachtLeeftijden: ["K3"] }), { dagen: [MAANDAG] });

    expect(await screen.findByText("8:30 - 15:30")).toBeInTheDocument();
    expect(screen.getByText(t("schooluren.pauzeLijst", { bereik: "12:00 - 13:15" }))).toBeInTheDocument();
    // Tuesday to Friday have no hours in this school.
    expect(screen.getAllByText(t("schooluren.nietIngesteld"))).toHaveLength(4);

    expect(screen.queryByRole("button", { name: t("schooluren.bewaar") })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Maandag Schooldag van")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
