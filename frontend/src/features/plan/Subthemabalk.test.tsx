import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Subthemabalk } from "./Subthemabalk";
import type { Subthemareeks } from "./subthemareeksen";
import type { SubthemaperiodeVerrijkingen } from "../hoeken/gegevens";
import { t } from "../../i18n";
import { periode } from "../../lib/datum";

/**
 * The subthemabalk above the grid (FB-020): one button per subthema on screen, with a one-line preview of what the
 * hoeken hold while it runs. The preview's branches are pinned, because each may only say what its data proves.
 */
const HOEKEN = [
  { id: "h-boek", naam: "boekenhoek" },
  { id: "h-bouw", naam: "bouwhoek" },
  { id: "h-zand", naam: "zandtafel" },
];

const herfst: Subthemareeks = {
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  van: "2026-09-14",
  tot: "2026-09-25",
  aantalDagen: 3,
  periodeId: "p-herfst",
};

// Drawn from its activiteiten alone: no stored window, so it cannot have a verrijking yet.
const winter: Subthemareeks = {
  subthemaId: "s-winter",
  subthemaNaam: "De winter",
  van: "2026-09-21",
  tot: "2026-10-02",
  aantalDagen: 2,
};

const gevuld: SubthemaperiodeVerrijkingen = {
  subthemaperiodeId: "p-herfst",
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  van: "2026-09-14",
  tot: "2026-09-25",
  // Listed out of the klas's order on purpose: the preview names the first CORNER, not the first row.
  verrijkingen: [
    { id: "v-2", hoekId: "h-bouw", tekst: "kastanjes en dennenappels" },
    { id: "v-1", hoekId: "h-boek", tekst: "prentenboeken over de herfst" },
  ],
};

function toon(opties: Partial<Parameters<typeof Subthemabalk>[0]> = {}) {
  const onOpen = vi.fn();
  render(
    <Subthemabalk
      reeksen={[herfst, winter]}
      verrijkingen={[gevuld]}
      geladen
      hoeken={HOEKEN}
      magPlannen
      onOpen={onOpen}
      {...opties}
    />,
  );
  return { onOpen };
}

describe("Subthemabalk", () => {
  it("toont elk subthema met zijn dagen, en het voorbeeld van de verrijkte hoeken in de volgorde van de klas", () => {
    toon();

    const lijst = screen.getByRole("list", { name: t("subthemabalk.label") });
    expect(lijst).toBeInTheDocument();
    expect(screen.getByText(periode("2026-09-14", "2026-09-25"))).toBeInTheDocument();
    expect(screen.getByText(t("subthemabalk.verrijktAantal", { aantal: 2 }))).toBeInTheDocument();
    expect(screen.getByText("boekenhoek: prentenboeken over de herfst")).toBeInTheDocument();
  });

  it("biedt wie mag plannen bij een subthema zonder verrijking aan om ze in te vullen", () => {
    toon();

    expect(screen.getByRole("button", { name: new RegExp(`De winter.*${t("subthemabalk.invullen")}`) }))
      .toBeInTheDocument();
  });

  it("zegt aan wie alleen mag bekijken pas dat er niets is als dat zeker is", () => {
    // Read and empty: then it is true there is none.
    const { onOpen } = toon({ magPlannen: false, verrijkingen: [{ ...gevuld, verrijkingen: [] }] });
    expect(screen.getAllByText(t("subthemabalk.geen"))).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /De winter/ }));
    expect(onOpen).toHaveBeenCalledWith(winter);
  });

  it("zegt niet dat er geen verrijking is terwijl die nog gelezen wordt", () => {
    toon({ magPlannen: false, verrijkingen: [], geladen: false });

    // De herfst has a window whose verrijkingen are still out; De winter has no window, so none is certain.
    expect(screen.getByRole("button", { name: new RegExp(`De herfst.*${t("subthemabalk.bekijken")}`) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`De winter.*${t("subthemabalk.geen")}`) })).toBeInTheDocument();
  });

  it("tekent niets als er in beeld geen subthema loopt", () => {
    toon({ reeksen: [] });

    expect(screen.queryByRole("list")).toBeNull();
  });
});
