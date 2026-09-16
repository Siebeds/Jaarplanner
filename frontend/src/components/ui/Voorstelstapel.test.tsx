import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { UITSTEL_MS, Voorstelstapel, type Besluit, type Voorstel } from "./Voorstelstapel";

const VOORSTELLEN: Voorstel[] = [
  { id: "v-1", naam: "wolk", inhoud: "wolk", motivatie: "Wolken brengen regen." },
  { id: "v-2", naam: "plas", inhoud: "plas", motivatie: "Na de regen." },
  { id: "v-3", naam: "donder", inhoud: "donder", motivatie: "Hoort bij onweer." },
];

const aanvaard = (naam: string) => screen.queryByRole("button", { name: t("voorstelstapel.aanvaardAria", { naam }) });
const weiger = (naam: string) => screen.queryByRole("button", { name: t("voorstelstapel.weigerAria", { naam }) });

function toon(onBeslis = vi.fn<(id: string, besluit: Besluit) => Promise<unknown>>(async () => undefined)) {
  const gevolg = render(<Voorstelstapel label="Voorstellen" voorstellen={VOORSTELLEN} onBeslis={onBeslis} />);
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

describe("Voorstelstapel", () => {
  it("toont één voorstel tegelijk, met zijn motivatie en de teller", () => {
    toon();

    expect(screen.getByText("Wolken brengen regen.")).toBeInTheDocument();
    expect(screen.getByText(t("voorstelstapel.teller", { nummer: 1, totaal: 3 }))).toBeInTheDocument();
    expect(aanvaard("wolk")).not.toBeNull();
    expect(aanvaard("plas")).toBeNull();
    expect(screen.queryByText("Na de regen.")).toBeNull();
  });

  it("bewaart een beslissing meteen en toont het volgende voorstel, ook met de sneltoetsen", async () => {
    const { onBeslis } = toon();

    fireEvent.click(aanvaard("wolk")!);
    expect(onBeslis).toHaveBeenCalledWith("v-1", "Aanvaard");
    expect(screen.getByText(t("voorstelstapel.teller", { nummer: 2, totaal: 3 }))).toBeInTheDocument();

    fireEvent.keyDown(weiger("plas")!, { key: "w" });
    expect(onBeslis).toHaveBeenCalledWith("v-2", "Geweigerd");

    fireEvent.keyDown(aanvaard("donder")!, { key: "A" });
    expect(onBeslis).toHaveBeenCalledWith("v-3", "Aanvaard");
    expect(await screen.findByText(t("voorstelstapel.klaar", { aanvaard: 2, geweigerd: 1 }))).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: t("voorstelstapel.restAanvaarden", { aantal: 3 }) }));

    expect(screen.getByRole("status")).toHaveTextContent(t("voorstelstapel.restWordtAanvaard", { aantal: 3 }));
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

    fireEvent.click(screen.getByRole("button", { name: t("voorstelstapel.restWeigeren", { aantal: 3 }) }));
    fireEvent.click(screen.getByRole("button", { name: t("voorstelstapel.ongedaan") }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UITSTEL_MS * 2);
    });

    expect(onBeslis).not.toHaveBeenCalled();
    expect(aanvaard("wolk")).toHaveFocus();
  });

  it("zet de focus op Ongedaan maken en wacht zolang de muis op de melding staat", async () => {
    vi.useFakeTimers();
    const { onBeslis } = toon();

    fireEvent.click(screen.getByRole("button", { name: t("voorstelstapel.restAanvaarden", { aantal: 3 }) }));
    const ongedaan = screen.getByRole("button", { name: t("voorstelstapel.ongedaan") });
    expect(ongedaan).toHaveFocus();
    gaVerder();

    fireEvent.pointerEnter(screen.getByRole("status"));
    expect(screen.getByText(t("voorstelstapel.gepauzeerd"))).toBeInTheDocument();
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

  it("zet een nieuwe reeks voorstellen niet in de plaats van beslissingen die nog bewaard worden", async () => {
    let klaar: () => void = () => {};
    const onBeslis = vi.fn(() => new Promise<void>((los) => (klaar = los)));
    const { rerender } = render(
      <Voorstelstapel label="Voorstellen" voorstellen={VOORSTELLEN.slice(0, 1)} onBeslis={onBeslis} />,
    );
    fireEvent.click(aanvaard("wolk")!);

    // The server has not answered yet, and a new AI run brings two more.
    rerender(<Voorstelstapel label="Voorstellen" voorstellen={VOORSTELLEN} onBeslis={onBeslis} />);

    expect(aanvaard("wolk")).toBeNull();
    expect(aanvaard("plas")).not.toBeNull();
    expect(screen.getByText(t("voorstelstapel.teller", { nummer: 2, totaal: 3 }))).toBeInTheDocument();
    await act(async () => klaar());
  });

  it("schrijft een wachtende beslissing meteen wanneer de stapel verdwijnt", () => {
    const { onBeslis, unmount } = toon();

    fireEvent.click(screen.getByRole("button", { name: t("voorstelstapel.restWeigeren", { aantal: 3 }) }));
    unmount();

    expect(onBeslis).toHaveBeenCalledWith("v-1", "Geweigerd");
  });

  it("biedt Alle aanvaarden niet aan voor één voorstel", () => {
    render(<Voorstelstapel label="Voorstellen" voorstellen={VOORSTELLEN.slice(0, 1)} onBeslis={async () => undefined} />);

    expect(aanvaard("wolk")).not.toBeNull();
    expect(screen.queryByRole("button", { name: t("voorstelstapel.restAanvaarden", { aantal: 1 }) })).toBeNull();
  });

  it("toont niets zonder voorstellen", () => {
    const { container } = render(<Voorstelstapel label="Voorstellen" voorstellen={[]} onBeslis={async () => undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
