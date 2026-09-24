import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { UITSTEL_MS, Voorstellijst, type Besluit, type Voorstel } from "./Voorstellijst";

const VOORSTELLEN: Voorstel[] = [
  { id: "v-1", naam: "wolk", inhoud: "wolk", motivatie: "Wolken brengen regen." },
  { id: "v-2", naam: "plas", inhoud: "plas", motivatie: "Na de regen." },
  { id: "v-3", naam: "donder", inhoud: "donder", motivatie: "Hoort bij onweer." },
];

const aanvaard = (naam: string) => screen.queryByRole("button", { name: `${t("plaatsing.aanvaard")}: ${naam}` });
const weiger = (naam: string) => screen.queryByRole("button", { name: `${t("plaatsing.weiger")}: ${naam}` });

function toon(onBeslis = vi.fn<(id: string, besluit: Besluit) => Promise<unknown>>(async () => undefined)) {
  const gevolg = render(<Voorstellijst label="Voorstellen" voorstellen={VOORSTELLEN} onBeslis={onBeslis} />);
  return { onBeslis, ...gevolg };
}

// The line takes focus on Ongedaan maken, and jsdom counts that focus as visible, which pauses the wait: a teacher
// who moves on lets it run.
function gaVerder() {
  act(() => (document.activeElement as HTMLElement | null)?.blur());
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Voorstellijst", () => {
  it("toont alle voorstellen tegelijk in één lijst, elk met zijn motivatie, het AI-merk en de beslisknoppen", () => {
    toon();

    const rijen = within(screen.getByRole("region", { name: "Voorstellen" })).getAllByRole("listitem");
    expect(rijen).toHaveLength(3);
    for (const [i, rij] of rijen.entries()) {
      expect(rij).toHaveClass("voorstel-ai");
      expect(within(rij).getByText(t("voorstellijst.aiVoorstel"))).toBeInTheDocument();
      expect(within(rij).getByText(VOORSTELLEN[i].motivatie!)).toBeInTheDocument();
    }
    expect(aanvaard("plas")).not.toBeNull();
    expect(weiger("donder")).not.toBeNull();
  });

  it("bewaart een beslissing meteen en haalt de rij weg", () => {
    const { onBeslis } = toon();

    fireEvent.click(weiger("plas")!);

    expect(onBeslis).toHaveBeenCalledWith("v-2", "Geweigerd");
    expect(screen.queryByText("Na de regen.")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("zet een voorstel terug wanneer het bewaren mislukt", async () => {
    toon(vi.fn(async () => Promise.reject(new Error("geweigerd"))));

    fireEvent.click(aanvaard("wolk")!);

    expect(await screen.findByText("Wolken brengen regen.")).toBeInTheDocument();
    expect(aanvaard("wolk")).not.toBeNull();
  });

  it("schrijft Alle aanvaarden pas na het wachten, één voor één", async () => {
    vi.useFakeTimers();
    const { onBeslis } = toon();

    fireEvent.click(screen.getByRole("button", { name: t("voorstellijst.alleAanvaarden", { aantal: 3 }) }));

    expect(screen.getByRole("status")).toHaveTextContent(t("voorstellijst.alleWordtAanvaard", { aantal: 3 }));
    expect(onBeslis).not.toHaveBeenCalled();
    gaVerder();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UITSTEL_MS);
    });

    expect(onBeslis.mock.calls).toEqual([
      ["v-1", "Aanvaard"],
      ["v-2", "Aanvaard"],
      ["v-3", "Aanvaard"],
    ]);
  });

  it("schrijft niets na Ongedaan maken, en toont de voorstellen weer", async () => {
    vi.useFakeTimers();
    const { onBeslis } = toon();

    fireEvent.click(screen.getByRole("button", { name: t("voorstellijst.alleWeigeren", { aantal: 3 }) }));
    fireEvent.click(screen.getByRole("button", { name: t("voorstellijst.ongedaan") }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UITSTEL_MS * 2);
    });

    expect(onBeslis).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(aanvaard("wolk")).toHaveFocus();
  });

  it("zet de focus op Ongedaan maken en wacht zolang de muis op de melding staat", async () => {
    vi.useFakeTimers();
    const { onBeslis } = toon();

    fireEvent.click(screen.getByRole("button", { name: t("voorstellijst.alleAanvaarden", { aantal: 3 }) }));
    const ongedaan = screen.getByRole("button", { name: t("voorstellijst.ongedaan") });
    expect(ongedaan).toHaveFocus();
    gaVerder();

    fireEvent.pointerEnter(screen.getByRole("status"));
    expect(screen.getByText(t("voorstellijst.gepauzeerd"))).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UITSTEL_MS * 3);
    });
    expect(onBeslis).not.toHaveBeenCalled();

    fireEvent.pointerLeave(screen.getByRole("status"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UITSTEL_MS);
    });
    expect(onBeslis).toHaveBeenCalledTimes(3);
  });

  it("toont een nieuwe reeks voorstellen naast een beslissing die nog bewaard wordt", async () => {
    let klaar: () => void = () => {};
    const onBeslis = vi.fn(() => new Promise<void>((los) => (klaar = los)));
    const { rerender } = render(
      <Voorstellijst label="Voorstellen" voorstellen={VOORSTELLEN.slice(0, 1)} onBeslis={onBeslis} />,
    );
    fireEvent.click(aanvaard("wolk")!);

    // The server has not answered yet, and a new AI run brings two more.
    rerender(<Voorstellijst label="Voorstellen" voorstellen={VOORSTELLEN} onBeslis={onBeslis} />);

    expect(aanvaard("wolk")).toBeNull();
    expect(aanvaard("plas")).not.toBeNull();
    expect(aanvaard("donder")).not.toBeNull();
    await act(async () => klaar());
  });

  it("schrijft een wachtende beslissing meteen wanneer de lijst verdwijnt", () => {
    const { onBeslis, unmount } = toon();

    fireEvent.click(screen.getByRole("button", { name: t("voorstellijst.alleWeigeren", { aantal: 3 }) }));
    unmount();

    expect(onBeslis).toHaveBeenCalledWith("v-1", "Geweigerd");
  });

  it("biedt Alle aanvaarden niet aan voor één voorstel", () => {
    render(<Voorstellijst label="Voorstellen" voorstellen={VOORSTELLEN.slice(0, 1)} onBeslis={async () => undefined} />);

    expect(aanvaard("wolk")).not.toBeNull();
    expect(screen.queryByRole("button", { name: t("voorstellijst.alleAanvaarden", { aantal: 1 }) })).toBeNull();
  });

  it("toont niets zonder voorstellen", () => {
    const { container } = render(<Voorstellijst label="Voorstellen" voorstellen={[]} onBeslis={async () => undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
