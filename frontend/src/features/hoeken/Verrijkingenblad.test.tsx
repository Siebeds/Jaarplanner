import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Verrijkingenblad } from "./Verrijkingenblad";
import type { HoekWeergave, SubthemaperiodeVerrijkingen } from "./gegevens";
import type { Subthemareeks } from "../plan/subthemareeksen";
import { t } from "../../i18n";
import { periode } from "../../lib/datum";

/**
 * The sheet a row of the subthemabalk opens (FB-020): one field per hoek of the klas, saved together, and a run with
 * no stored window says before the save that saving stores one (owner, 2026-09-15).
 */
const hoek = (id: string, naam: string): HoekWeergave => ({
  id,
  klasId: "k-1",
  naam,
  omschrijving: null,
  aantalPlaatsingen: 0,
  aantalVerrijkingen: 0,
});

const HOEKEN = [hoek("h-boek", "boekenhoek"), hoek("h-bouw", "bouwhoek"), hoek("h-zand", "zandtafel")];

const herfst: Subthemareeks = {
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  van: "2026-09-14",
  tot: "2026-09-25",
  aantalDagen: 4,
  periodeId: "p-herfst",
};

const opgeslagen: SubthemaperiodeVerrijkingen = {
  subthemaperiodeId: "p-herfst",
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  van: "2026-09-14",
  tot: "2026-09-25",
  verrijkingen: [{ id: "v-1", hoekId: "h-boek", tekst: "prentenboeken" }],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(
    async () => new Response(JSON.stringify(opgeslagen), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function toon(opties: Partial<Parameters<typeof Verrijkingenblad>[0]> = {}) {
  const onSluit = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Verrijkingenblad
          klasId="k-1"
          reeks={herfst}
          periode={opgeslagen}
          hoeken={HOEKEN}
          status="klaar"
          magPlannen
          onSluit={onSluit}
          {...opties}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onSluit };
}

describe("Verrijkingenblad", () => {
  it("geeft elke hoek een veld met wat er al staat, en bewaart ze samen bij de subthemaperiode", async () => {
    const { onSluit } = toon();

    expect(screen.getByRole("dialog", { name: t("verrijkingenblad.titel", { naam: "De herfst" }) })).toBeInTheDocument();
    expect(screen.getByLabelText("boekenhoek")).toHaveValue("prentenboeken");
    expect(screen.getByLabelText("bouwhoek")).toHaveValue("");
    // A window is stored, so nothing is said about storing one.
    expect(screen.queryByText(/nog geen vastgelegde periode/)).toBeNull();

    fireEvent.change(screen.getByLabelText("bouwhoek"), { target: { value: "  kastanjes  " } });
    fireEvent.click(screen.getByRole("button", { name: t("verrijkingenblad.bewaren") }));

    await waitFor(() => expect(onSluit).toHaveBeenCalled());
    const [pad, init] = fetchMock.mock.calls[0];
    expect(pad).toBe("/api/klassen/k-1/hoekverrijkingen");
    expect(init.method).toBe("PUT");
    // Every hoek of the klas, trimmed; a blank one tells the server that corner has nothing this time.
    expect(JSON.parse(init.body)).toEqual({
      subthemaperiodeId: "p-herfst",
      verrijkingen: [
        { hoekId: "h-boek", tekst: "prentenboeken" },
        { hoekId: "h-bouw", tekst: "kastanjes" },
        { hoekId: "h-zand", tekst: "" },
      ],
    });
  });

  it("zegt vooraf dat bewaren de periode vastlegt als het subthema er nog geen heeft, en stuurt dan de dagen mee", async () => {
    const zonderVenster: Subthemareeks = { ...herfst, periodeId: undefined };
    const { onSluit } = toon({ reeks: zonderVenster, periode: undefined });

    expect(
      screen.getByText(t("verrijkingenblad.periodeVastleggen", { periode: periode("2026-09-14", "2026-09-25") })),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("zandtafel"), { target: { value: "bladeren" } });
    fireEvent.click(screen.getByRole("button", { name: t("verrijkingenblad.bewaren") }));

    await waitFor(() => expect(onSluit).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      subthemaperiodeId: null,
      subthemaId: "s-herfst",
      van: "2026-09-14",
      tot: "2026-09-25",
    });
  });

  it("toont wie alleen mag bekijken wat erin zit, zonder veld of knop, en zonder de zin over vastleggen", () => {
    toon({ magPlannen: false, reeks: { ...herfst, periodeId: undefined } });

    expect(screen.getByText("prentenboeken")).toBeInTheDocument();
    expect(screen.getAllByText(t("verrijkingenblad.leeg"))).toHaveLength(2);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: t("verrijkingenblad.bewaren") })).toBeNull();
    expect(screen.queryByText(/nog geen vastgelegde periode/)).toBeNull();
  });

  it("stuurt een klas zonder hoeken naar Instellingen, en biedt niets aan om te bewaren", () => {
    toon({ hoeken: [] });

    expect(screen.getByText(t("verrijkingenblad.geenHoeken"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("verrijkingenblad.naarHoeken") })).toHaveAttribute(
      "href",
      "/instellingen/hoeken",
    );
    expect(screen.queryByRole("button", { name: t("verrijkingenblad.bewaren") })).toBeNull();
  });

  it("zegt dat het lezen mislukte in plaats van lege velden te tonen die bewaren zou wissen", () => {
    toon({ status: "mislukt" });

    expect(screen.getByRole("alert")).toHaveTextContent(t("verrijkingenblad.laadtMislukt"));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: t("verrijkingenblad.bewaren") })).toBeNull();
  });
});
