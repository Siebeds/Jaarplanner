import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Activiteitplaatsingblad } from "./Activiteitplaatsingblad";
import { STANDAARDBEGIN, alsTijd } from "./tijd";
import { t } from "../../i18n";

/** The sheet a clicked activiteit card opens (FB-017): which day, from when, until when. */
function toon(startuur: number | null = null) {
  const onPlaats = vi.fn();
  render(
    <Activiteitplaatsingblad
      naam="Eikels rapen"
      startdag="2026-09-15"
      startuur={startuur}
      duur={50}
      vroegste="2026-09-01"
      laatste="2027-06-30"
      bezig={false}
      onPlaats={onPlaats}
      onSluit={vi.fn()}
    />,
  );
  return { onPlaats };
}

const veld = (label: Parameters<typeof t>[0]) => screen.getByLabelText(t(label)) as HTMLInputElement;
const plannen = () => screen.getByRole("button", { name: t("activiteitplaatsing.plaats") });

describe("Activiteitplaatsingblad", () => {
  it("begint op de dag van de agenda, op het gewone begin, met de lengte van de activiteit", () => {
    toon();

    expect(veld("activiteitplaatsing.dag").value).toBe("2026-09-15");
    expect(veld("activiteitplaatsing.van").value).toBe(alsTijd(STANDAARDBEGIN).slice(0, 5));
    expect(veld("activiteitplaatsing.tot").value).toBe(alsTijd(STANDAARDBEGIN + 50).slice(0, 5));
  });

  it("neemt het uur over dat de drop noemde", () => {
    toon(13 * 60);
    expect(veld("activiteitplaatsing.van").value).toBe("13:00");
    expect(veld("activiteitplaatsing.tot").value).toBe("13:50");
  });

  it("plant op de gekozen dag en uren", () => {
    const { onPlaats } = toon();

    fireEvent.change(veld("activiteitplaatsing.dag"), { target: { value: "2026-09-16" } });
    fireEvent.change(veld("activiteitplaatsing.van"), { target: { value: "09:00" } });
    fireEvent.change(veld("activiteitplaatsing.tot"), { target: { value: "09:50" } });
    fireEvent.click(plannen());

    expect(onPlaats).toHaveBeenCalledWith({ datum: "2026-09-16", begin: "09:00:00", einde: "09:50:00" });
  });

  it("zegt het wanneer het einde niet na het begin ligt, en plant dan niet", () => {
    const { onPlaats } = toon();

    fireEvent.change(veld("activiteitplaatsing.van"), { target: { value: "10:00" } });
    fireEvent.change(veld("activiteitplaatsing.tot"), { target: { value: "09:30" } });

    expect(screen.getByRole("alert")).toHaveTextContent(t("activiteitplaatsing.eindeVoorBegin"));
    expect(plannen()).toBeDisabled();
    fireEvent.click(plannen());
    expect(onPlaats).not.toHaveBeenCalled();
  });
});
