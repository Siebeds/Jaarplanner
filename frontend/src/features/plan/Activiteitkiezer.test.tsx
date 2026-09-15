import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { t } from "../../i18n";
import { Activiteitkiezer } from "./Activiteitkiezer";

/**
 * The picker's title names where the activiteit is going (TB-014): the day and the quarter a click picked, or the
 * whole stretch a teacher dragged out. No thema's in the period, so nothing is fetched and only the title is under test.
 */
function toon(eindtijd?: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Activiteitkiezer
        datum="2026-09-08"
        tijd="9:00"
        eindtijd={eindtijd}
        klasId="k1"
        themaIds={[]}
        bezig={false}
        onKies={() => {}}
        onNieuw={() => {}}
        onSluit={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("Activiteitkiezer", () => {
  it("noemt het gesleepte bereik in zijn titel", () => {
    toon("10:30");

    expect(
      screen.getByRole("dialog", {
        name: t("tijdraster.kiezerTitelBereik", { dag: "dinsdag 8 september", begin: "9:00", einde: "10:30" }),
      }),
    ).toBeInTheDocument();
  });

  it("noemt enkel het beginuur als er geen bereik gesleept is", () => {
    toon();

    expect(
      screen.getByRole("dialog", { name: t("tijdraster.kiezerTitel", { dag: "dinsdag 8 september", tijd: "9:00" }) }),
    ).toBeInTheDocument();
  });
});
