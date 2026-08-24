import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { t } from "../../i18n";
import { DoelsuggestieLijst } from "./DoelsuggestieLijst";
import type { Doelsuggestie } from "./types";

/**
 * Pins the E2-05 accept/reject/adjust review UI (FR-4.3, Art. IV.1/IV.3): the suggestion + its
 * motivation render, and a teacher decision sends the right PUT and reflects the persisted status.
 * The API is faked at the fetch boundary so the test needs no backend — the mutation → refetch cycle
 * is what proves the status change is driven by the server (the source of truth for coverage, E5).
 *
 * Extended by E2-08 with the two things that flow was missing: the leerplandoel's own text/doelsoort in the
 * row (FR-4.2 — a teacher cannot judge a bare code), and the substitution of a *different* doel, which is
 * what FR-4.3's third verb "aanpassen" asks for.
 */

const THEMA_ID = "11111111-1111-1111-1111-111111111111";
const SUGGESTIE_ID = "22222222-2222-2222-2222-222222222222";

/** A fetch fake with mutable server-side state, so the refetch after a PUT sees the new value. */
function maakFetchFake(vervangStatus = 200) {
  const suggestie: Doelsuggestie = {
    id: SUGGESTIE_ID,
    leerplandoelCode: "NAT-K3-01",
    status: "Voorgesteld",
    aiMotivatie: "past bij het observeren van bomen",
    tekst: "herkent bomen aan hun bladeren.",
    doelsoort: "Minimumdoel",
  };
  const putBodies: unknown[] = [];

  const fetchFake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT" && url.endsWith("/leerplandoel")) {
      const body = JSON.parse(String(init.body)) as { leerplandoelCode: string };
      putBodies.push({ url, leerplandoelCode: body.leerplandoelCode });
      if (vervangStatus !== 200) {
        return new Response("{}", { status: vervangStatus });
      }

      // The server's own semantics: the link becomes the teacher's manual choice, the AI motivation goes
      // with the code it described, and the new goal's text comes back.
      suggestie.leerplandoelCode = body.leerplandoelCode;
      suggestie.status = "Manueel";
      suggestie.aiMotivatie = null;
      suggestie.tekst = "observeert de natuur.";
      suggestie.doelsoort = "Gemeenschappelijk";
      return new Response(JSON.stringify(suggestie), { status: 200 });
    }

    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { status: Doelsuggestie["status"] };
      putBodies.push({ url, status: body.status });
      suggestie.status = body.status;
      return new Response(JSON.stringify(suggestie), { status: 200 });
    }
    // GET: list for the thema.
    return new Response(JSON.stringify([suggestie]), { status: 200 });
  });

  return { fetchFake, putBodies };
}

/** The client is returned so a test can read the cache a decision here reaches into (E4-01). */
function renderLijst() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <DoelsuggestieLijst themaId={THEMA_ID} />
      </QueryClientProvider>,
    ),
    queryClient,
  };
}

let putBodies: unknown[];

beforeEach(() => {
  const fake = maakFetchFake();
  putBodies = fake.putBodies;
  vi.stubGlobal("fetch", fake.fetchFake);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DoelsuggestieLijst", () => {
  it("shows the suggestion with its code, motivation and status", async () => {
    renderLijst();

    expect(await screen.findByText("NAT-K3-01")).toBeInTheDocument();
    expect(
      screen.getByText(/past bij het observeren van bomen/),
    ).toBeInTheDocument();
    // Colour is never the sole signal — the status label is present as text.
    expect(
      screen.getByText(t("suggestieStatus.voorgesteld")),
    ).toBeInTheDocument();
  });

  it("shows the leerplandoel's own text and doelsoort so it can be judged (FR-4.2)", async () => {
    renderLijst();

    expect(
      await screen.findByText("herkent bomen aan hun bladeren."),
    ).toBeInTheDocument();
    // The doelsoort is carried by its abbreviation + accessible label, never by colour alone (Art. XII).
    expect(
      screen.getByLabelText(t("doelsoort.md")),
    ).toBeInTheDocument();
    expect(screen.getByText(t("doelsoortAfkorting.md"))).toBeInTheDocument();
  });

  it("accepts a suggestion: sends the right PUT and reflects the persisted status", async () => {
    renderLijst();

    fireEvent.click(
      await screen.findByRole("button", {
        name: t("matching.aanvaardenAria", { code: "NAT-K3-01" }),
      }),
    );

    // The persisted status comes back via refetch and replaces the badge.
    expect(
      await screen.findByText(t("suggestieStatus.aanvaard")),
    ).toBeInTheDocument();
    expect(putBodies).toEqual([
      {
        url: `/api/themas/${THEMA_ID}/doelsuggesties/${SUGGESTIE_ID}/status`,
        status: "Aanvaard",
      },
    ]);
  });

  it("rejects a suggestion with the geweigerd status", async () => {
    renderLijst();

    fireEvent.click(
      await screen.findByRole("button", {
        name: t("matching.weigerenAria", { code: "NAT-K3-01" }),
      }),
    );

    expect(
      await screen.findByText(t("suggestieStatus.geweigerd")),
    ).toBeInTheDocument();
    expect(putBodies).toEqual([expect.objectContaining({ status: "Geweigerd" })]);
  });

  it("adjusts (manueel) a suggestion", async () => {
    renderLijst();

    fireEvent.click(
      await screen.findByRole("button", {
        name: t("matching.manueelAria", { code: "NAT-K3-01" }),
      }),
    );

    expect(
      await screen.findByText(t("suggestieStatus.manueel")),
    ).toBeInTheDocument();
    expect(putBodies).toEqual([expect.objectContaining({ status: "Manueel" })]);
  });

  it("substitutes a different leerplandoel and lands as manueel (FR-4.3 'aanpassen')", async () => {
    renderLijst();

    fireEvent.change(
      await screen.findByLabelText(
        t("matching.vervangenLabel", { code: "NAT-K3-01" }),
      ),
      { target: { value: " NAT-K3-02 " } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: t("matching.vervangenAria", { code: "NAT-K3-01" }),
      }),
    );

    // The refetched row now shows the substituted doel, its text, and the manual status.
    expect(await screen.findByText("NAT-K3-02")).toBeInTheDocument();
    expect(await screen.findByText("observeert de natuur.")).toBeInTheDocument();
    expect(
      await screen.findByText(t("suggestieStatus.manueel")),
    ).toBeInTheDocument();
    // The code is trimmed before it is sent, and it goes to the dedicated leerplandoel endpoint.
    expect(putBodies).toEqual([
      {
        url: `/api/themas/${THEMA_ID}/doelsuggesties/${SUGGESTIE_ID}/leerplandoel`,
        leerplandoelCode: "NAT-K3-02",
      },
    ]);
  });

  it("enables the substitution only once a real code is typed", async () => {
    renderLijst();
    await screen.findByText("NAT-K3-01");

    const veld = screen.getByLabelText(
      t("matching.vervangenLabel", { code: "NAT-K3-01" }),
    );
    const knop = screen.getByRole("button", {
      name: t("matching.vervangenAria", { code: "NAT-K3-01" }),
    });

    expect(knop).toBeDisabled();

    // Whitespace is not a code — the field is trimmed before the button unlocks, so a stray space cannot
    // produce a blank substitution. (The server refuses one as well; this is the visible half.)
    fireEvent.change(veld, { target: { value: "   " } });
    expect(knop).toBeDisabled();

    fireEvent.change(veld, { target: { value: "NAT-K3-02" } });
    expect(knop).toBeEnabled();
  });

  it("explains 'Manueel overnemen' and warns that a substitution is not reversible", async () => {
    renderLijst();
    await screen.findByText("NAT-K3-01");

    // Two of the four buttons land the row on the same visible `Manueel` badge, and for dekking `Aanvaard`
    // and `Manueel` count the same — so both need copy. Asserted on the substance, in literal Dutch.
    expect(
      screen.getByText(/telt dat even zwaar als “Aanvaarden”/),
    ).toBeInTheDocument();

    /*
      **The irreversibility warning is now at the action rather than above the list** (E9-08).

      It used to sit permanently above every suggestion; the field it warns about is rendered on EVERY row, so it could
      not simply move down without repeating itself down the whole list. It appears the moment a replacement code is
      typed, which is the first act that makes the button live and still strictly before the commit.

      Asserted in both directions on purpose. The first half is what CR1 asked for and the second is what must never be
      traded away for it: a warning that is quieter is fine, a warning that never arrives is not.
    */
    expect(screen.queryByText(/niet bewaard: je kan dit niet ongedaan maken/)).toBeNull();

    fireEvent.change(
      screen.getByLabelText(t("matching.vervangenLabel", { code: "NAT-K3-01" })),
      { target: { value: "WIS-L3-01" } },
    );

    const waarschuwing = screen.getByText(/niet bewaard: je kan dit niet ongedaan maken/);
    expect(waarschuwing).toBeInTheDocument();
    expect(waarschuwing).toHaveAttribute("role", "alert");
  });

  it("renders local Dutch copy when a substitution is refused, never the server message", async () => {
    vi.unstubAllGlobals();
    const fake = maakFetchFake(400);
    putBodies = fake.putBodies;
    vi.stubGlobal("fetch", fake.fetchFake);

    renderLijst();

    fireEvent.change(
      await screen.findByLabelText(
        t("matching.vervangenLabel", { code: "NAT-K3-01" }),
      ),
      { target: { value: "VERZONNEN-99" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: t("matching.vervangenAria", { code: "NAT-K3-01" }),
      }),
    );

    const melding = await screen.findByRole("alert");
    // Asserted as the literal Dutch, not as `t("matching.vervangenMislukt")`: comparing the render to the very
    // template it renders would pass for any wording at all, including one that omits a check. The server never
    // gets echoed (Art. II.3), so this one string is the teacher's whole route out — and it must name all three
    // things they can act on, the casing included (a mis-cased code that matches two goals is refused while
    // both other checks pass).
    expect(melding).toHaveTextContent(
      "Vervangen lukte niet. Controleer of de code bestaat in de geladen leerplandoelen, " +
        "of ze nog niet aan dit thema gekoppeld is, en of ze exact geschreven is zoals in Op.stap.",
    );
    expect(melding).toHaveTextContent(t("matching.vervangenMislukt"));
    // The row is unchanged: nothing is applied client-side (Art. IV.1).
    expect(screen.getByText("NAT-K3-01")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = renderLijst();
    await screen.findByText("NAT-K3-01");
    await waitFor(async () => {
      const list = within(container).getByRole("list");
      expect(await axe(list)).toHaveNoViolations();
    });
  });
});

/**
 * E4-01: accepting a suggestion is a link, and a link is coverage (Art. V.1).
 *
 * Pinned here rather than only in `useThemas.ts`'s neighbour test because this is the *other* mutation family that
 * writes a counted `DoelKoppeling`, and the two are wired independently: `useBeheerMutatie` shares one refresh
 * function, while these hooks each list their own keys. A rule that holds in one file and not the other is exactly
 * how the original omission survived.
 */
describe("DoelsuggestieLijst — een beslissing raakt de dekking (E4-01, Art. V.1)", () => {
  it("gooit de gecachte dekking van elke klas weg zodra een suggestie aanvaard is", async () => {
    const { queryClient } = renderLijst();

    const klasA = ["dekking", "klas-a", "EigenJaarFase", null];
    const klasB = ["dekking", "klas-b", "EigenJaarFase", null];
    queryClient.setQueryData(klasA, { aantalGedekt: 3, aantalLeerplandoelen: 12 });
    queryClient.setQueryData(klasB, { aantalGedekt: 5, aantalLeerplandoelen: 12 });

    fireEvent.click(
      await screen.findByRole("button", {
        name: t("matching.aanvaardenAria", { code: "NAT-K3-01" }),
      }),
    );

    // Both, because the thema this suggestion hangs on is school-wide.
    await waitFor(() => expect(queryClient.getQueryData(klasA)).toBeUndefined());
    expect(queryClient.getQueryData(klasB)).toBeUndefined();
  });
});
