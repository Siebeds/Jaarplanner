import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { Nieuweactiviteitregel } from "./Nieuweactiviteitregel";

/**
 * The register's quick "new activiteit" row starts without a soort, and makes one without a soort (FB-050): a
 * preselected soort was saved as Experiment without anyone choosing it.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

function toon() {
  const aanvraag = vi.fn(
    async () =>
      new Response(JSON.stringify({ id: "a-1" }), { status: 201, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", aanvraag);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Nieuweactiviteitregel subthemaId="sub-1" subthemaNaam="Bladeren" code="WO-2" klasId="klas-1" magMaken />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: t("koppelen.nieuweActiviteitUitleg", { subthema: "Bladeren" }) }));
  return aanvraag;
}

function verstuurd(aanvraag: ReturnType<typeof toon>) {
  const [, init] = aanvraag.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(String(init.body));
}

describe("Nieuweactiviteitregel", () => {
  it("start zonder soort en maakt een activiteit zonder soort", async () => {
    const aanvraag = toon();

    expect(screen.getByLabelText(t("koppelen.activiteitType"))).toHaveValue("");

    fireEvent.change(screen.getByLabelText(t("koppelen.activiteitNaam")), { target: { value: "Bladeren rapen" } });
    fireEvent.click(screen.getByRole("button", { name: t("koppelen.maakEnKoppel") }));

    await waitFor(() => expect(aanvraag).toHaveBeenCalled());
    expect(verstuurd(aanvraag)).toMatchObject({ naam: "Bladeren rapen", activiteitType: null, leerplandoelCodes: ["WO-2"] });
  });

  it("stuurt een gekozen soort mee", async () => {
    const aanvraag = toon();

    fireEvent.change(screen.getByLabelText(t("koppelen.activiteitNaam")), { target: { value: "Bladeren rapen" } });
    fireEvent.change(screen.getByLabelText(t("koppelen.activiteitType")), { target: { value: "Uitstap" } });
    fireEvent.click(screen.getByRole("button", { name: t("koppelen.maakEnKoppel") }));

    await waitFor(() => expect(aanvraag).toHaveBeenCalled());
    expect(verstuurd(aanvraag)).toMatchObject({ activiteitType: "Uitstap" });
  });
});
