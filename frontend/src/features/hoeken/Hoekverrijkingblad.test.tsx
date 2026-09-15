import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hoekverrijkingblad } from "./Hoekverrijkingblad";
import type { SubthemaperiodeVerrijkingen } from "./gegevens";
import type { Verrijkingenweek } from "./verrijkingenweek";
import type { Subthemareeks } from "../plan/subthemareeksen";
import { t } from "../../i18n";
import { periode } from "../../lib/datum";

/**
 * The sheet a hoek in the side panel opens (FB-038, ADR-0044): one field per subthema running in the agenda's week,
 * each saved to its own subthemaperiode, naming this hoek alone. A run with no stored window says before the save that
 * saving stores one (owner, 2026-09-15).
 */
const herfst: Subthemareeks = {
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  themaId: "t-seizoenen",
  themaNaam: "Seizoenen",
  van: "2026-09-14",
  tot: "2026-09-25",
  aantalDagen: 4,
  periodeId: "p-herfst",
};

// Drawn from its activiteiten alone: no stored window yet.
const winter: Subthemareeks = {
  subthemaId: "s-winter",
  subthemaNaam: "De winter",
  themaId: "t-seizoenen",
  themaNaam: "Seizoenen",
  van: "2026-09-17",
  tot: "2026-10-02",
  aantalDagen: 2,
};

const opgeslagen: SubthemaperiodeVerrijkingen = {
  subthemaperiodeId: "p-herfst",
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  van: "2026-09-14",
  tot: "2026-09-25",
  verrijkingen: [
    { id: "v-1", hoekId: "h-boek", tekst: "prentenboeken" },
    // Another corner's text in the same window: a save for the boekenhoek must not send it.
    { id: "v-2", hoekId: "h-bouw", tekst: "blokken" },
  ],
};

const klaar = (reeksen: Subthemareeks[] = [herfst]): Verrijkingenweek => ({
  status: "klaar",
  reeksen,
  periodes: [opgeslagen],
});

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

function toon(opties: Partial<Parameters<typeof Hoekverrijkingblad>[0]> = {}) {
  const onSluit = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Hoekverrijkingblad
        klasId="k-1"
        hoek={{ id: "h-boek", naam: "boekenhoek" }}
        week={klaar()}
        magPlannen
        onSluit={onSluit}
        {...opties}
      />
    </QueryClientProvider>,
  );
  return { onSluit };
}

const verzonden = (i: number) => JSON.parse(String(fetchMock.mock.calls[i][1].body));

describe("Hoekverrijkingblad", () => {
  it("geeft elk subthema van de week een veld met wat de hoek er heeft, en bewaart alleen deze hoek bij die periode", async () => {
    const { onSluit } = toon();

    expect(screen.getByRole("dialog", { name: "boekenhoek" })).toBeInTheDocument();
    expect(screen.getByLabelText("De herfst")).toHaveValue("prentenboeken");
    expect(screen.getByText(periode("2026-09-14", "2026-09-25"))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("De herfst"), { target: { value: "  herfstboeken  " } });
    fireEvent.click(screen.getByRole("button", { name: t("hoekverrijkingblad.bewaren") }));

    await waitFor(() => expect(onSluit).toHaveBeenCalled());
    const [pad, init] = fetchMock.mock.calls[0];
    expect(pad).toBe("/api/klassen/k-1/hoekverrijkingen");
    expect(init.method).toBe("PUT");
    // This hoek alone, trimmed: the bouwhoek's text in the same window is not in the request, so it stays.
    expect(verzonden(0)).toEqual({ subthemaperiodeId: "p-herfst", verrijkingen: [{ hoekId: "h-boek", tekst: "herfstboeken" }] });
  });

  it("sluit zonder verzoek als niets veranderde, en stuurt een leeggemaakt veld als leeg mee", async () => {
    const { onSluit } = toon();

    fireEvent.click(screen.getByRole("button", { name: t("hoekverrijkingblad.bewaren") }));
    expect(onSluit).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("De herfst"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: t("hoekverrijkingblad.bewaren") }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(verzonden(0).verrijkingen).toEqual([{ hoekId: "h-boek", tekst: "" }]);
  });

  it("zegt vooraf dat bewaren de periode vastlegt als het subthema er nog geen heeft, en stuurt dan de dagen mee", async () => {
    const { onSluit } = toon({ week: klaar([herfst, winter]) });

    const zin = t("hoekverrijkingblad.periodeVastleggen", { periode: periode("2026-09-17", "2026-10-02") });
    expect(screen.getByText(zin)).toBeInTheDocument();
    // Tied to the field, so it is heard before typing; and only for the run that has no window.
    expect(screen.getByLabelText("De winter")).toHaveAccessibleDescription(expect.stringContaining(zin));
    expect(screen.getByLabelText("De herfst")).not.toHaveAccessibleDescription(expect.stringContaining(zin));

    fireEvent.change(screen.getByLabelText("De winter"), { target: { value: "sneeuwbollen" } });
    fireEvent.click(screen.getByRole("button", { name: t("hoekverrijkingblad.bewaren") }));

    await waitFor(() => expect(onSluit).toHaveBeenCalled());
    // Only the changed run: the herfst window is not written again.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(verzonden(0)).toEqual({
      subthemaperiodeId: null,
      subthemaId: "s-winter",
      van: "2026-09-17",
      tot: "2026-10-02",
      verrijkingen: [{ hoekId: "h-boek", tekst: "sneeuwbollen" }],
    });
  });

  it("bewaart twee veranderde subthema's als twee verzoeken, elk bij zijn eigen periode", async () => {
    const { onSluit } = toon({ week: klaar([herfst, winter]) });

    fireEvent.change(screen.getByLabelText("De herfst"), { target: { value: "herfstboeken" } });
    fireEvent.change(screen.getByLabelText("De winter"), { target: { value: "sneeuwbollen" } });
    fireEvent.click(screen.getByRole("button", { name: t("hoekverrijkingblad.bewaren") }));

    await waitFor(() => expect(onSluit).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(verzonden(0).subthemaperiodeId).toBe("p-herfst");
    expect(verzonden(1)).toMatchObject({ subthemaperiodeId: null, subthemaId: "s-winter" });
  });

  it("houdt het blad open met de reden als bewaren geweigerd wordt", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    const { onSluit } = toon();

    fireEvent.change(screen.getByLabelText("De herfst"), { target: { value: "herfstboeken" } });
    fireEvent.click(screen.getByRole("button", { name: t("hoekverrijkingblad.bewaren") }));

    expect(await screen.findByText(t("hoekverrijkingblad.mislukt"))).toBeInTheDocument();
    expect(onSluit).not.toHaveBeenCalled();
    // What she typed is still there to try again.
    expect(screen.getByLabelText("De herfst")).toHaveValue("herfstboeken");
  });

  it("toont wie alleen mag bekijken wat erin zit, zonder veld of knop, en zonder de zin over vastleggen", () => {
    toon({ magPlannen: false, week: klaar([herfst, winter]) });

    expect(screen.getByText("prentenboeken")).toBeInTheDocument();
    expect(screen.getByText(t("hoekverrijkingblad.leeg"))).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: t("hoekverrijkingblad.bewaren") })).toBeNull();
    expect(
      screen.queryByText(t("hoekverrijkingblad.periodeVastleggen", { periode: periode("2026-09-17", "2026-10-02") })),
    ).toBeNull();
  });

  it("zegt pas dat er deze week geen subthema loopt als dat gelezen is", () => {
    toon({ week: klaar([]) });
    expect(screen.getByText(t("hoekverrijkingblad.geenSubthema"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("hoekverrijkingblad.bewaren") })).toBeNull();
  });

  it("zegt niets over de week zolang die gelezen wordt", () => {
    toon({ week: { status: "laadt" } });
    expect(screen.queryByText(t("hoekverrijkingblad.geenSubthema"))).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("zegt dat het lezen mislukte in plaats van lege velden te tonen die bewaren zou wissen", () => {
    toon({ week: { status: "mislukt" } });

    expect(screen.getByRole("alert")).toHaveTextContent(t("hoekverrijkingblad.laadtMislukt"));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: t("hoekverrijkingblad.bewaren") })).toBeNull();
  });
});
