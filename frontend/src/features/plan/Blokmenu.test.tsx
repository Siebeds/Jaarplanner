import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { Blokmenu } from "./Blokmenu";

/** The right-click menu on a block of the agenda (TB-030). */

function toon(magPlannen: boolean) {
  const onBewerk = vi.fn();
  const onVanDag = vi.fn();
  render(
    <Blokmenu naam="turnen" magPlannen={magPlannen} onBewerk={onBewerk} onVanDag={onVanDag}>
      <button type="button">turnen, 10:30 - 11:20</button>
    </Blokmenu>,
  );
  return { onBewerk, onVanDag, blok: screen.getByRole("button", { name: "turnen, 10:30 - 11:20" }) };
}

describe("Blokmenu", () => {
  it("opent op een rechterklik met bewerken en van deze dag halen, onder de naam van het blok", () => {
    const { blok } = toon(true);

    fireEvent.contextMenu(blok);

    const menu = screen.getByRole("menu", { name: "turnen" });
    expect(menu).toHaveTextContent("turnen");
    expect(screen.getByRole("menuitem", { name: t("blokmenu.bewerk") })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: t("blokmenu.vanDag") })).toBeInTheDocument();
  });

  it("voert de gekozen regel uit, en alleen die", async () => {
    const { blok, onBewerk, onVanDag } = toon(true);

    fireEvent.contextMenu(blok);
    fireEvent.click(screen.getByRole("menuitem", { name: t("blokmenu.vanDag") }));

    await waitFor(() => expect(onVanDag).toHaveBeenCalledTimes(1));
    expect(onBewerk).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.contextMenu(blok);
    fireEvent.click(screen.getByRole("menuitem", { name: t("blokmenu.bewerk") }));

    await waitFor(() => expect(onBewerk).toHaveBeenCalledTimes(1));
    expect(onVanDag).toHaveBeenCalledTimes(1);
  });

  it("geeft wie de klas alleen mag inkijken geen eigen menu", () => {
    const { blok } = toon(false);

    fireEvent.contextMenu(blok);

    expect(screen.queryByRole("menu")).toBeNull();
  });
});
