import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ONDERDELEN } from "./features/instellingen/onderdelen";
import { t } from "./i18n";

/**
 * Where the app opens, and where an address it does not know lands (owner, 2026-09-11: the agenda,
 * not Doelen).
 *
 * Rendered through the real route table, because that is the thing that can drift: a test with a
 * route table of its own would pass with `App.tsx` pointing anywhere.
 *
 * The network is stubbed with a promise that never settles, so every screen stays in its loading
 * state and nothing here depends on what an API would answer.
 *
 * **Except who is signed in** (E6-04). A part of Instellingen may be admin only, and its gate
 * waits for `useIk` before it shows the screen or sends the person elsewhere; with a network that
 * never answers it would wait forever. So `useIk` is replaced by a switch each test sets. Not by a
 * stubbed `/api/ik`: `App` keeps one query client for the whole file and `ik` never goes stale, so
 * the first answer would be the answer for every test after it.
 */
const aangemeld = vi.hoisted(() => ({ isAdmin: true, bekend: true }));

vi.mock("./lib/aanmelding", async (importOriginal) => {
  const echt = await importOriginal<typeof import("./lib/aanmelding")>();
  return {
    ...echt,
    // `bekend: false` is the moment before `/api/ik` answers, which the aanmeldpoort (TB-026) waits on.
    useIk: () => aangemeld.bekend ? {
      data: {
        id: "ik-1",
        naam: "Test",
        email: "test@school.be",
        isAdmin: aangemeld.isAdmin,
        heeftThemabeheer: false,
        hoofdleerkrachtLeeftijden: [],
        leerkrachtLeeftijden: [],
        eigenKlasIds: [],
        rapportklasIds: [],
        lopendeRapportklasIds: [],
      },
      isPending: false,
      isError: false,
    } : { data: undefined, error: null, isPending: true, isError: false, isFetching: true },
  };
});

beforeEach(() => {
  aangemeld.isAdmin = true;
  aangemeld.bekend = true;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const openOp = (pad: string) => {
  window.history.replaceState(null, "", pad);
  render(<App />);
};

describe("App", () => {
  it("toont alleen de tussenpagina zolang niet bekend is wie aangemeld is", () => {
    aangemeld.bekend = false;
    openOp("/agenda");

    expect(screen.getByRole("status")).toHaveTextContent(t("aanmelding.tussenpagina.openen"));
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  // The two pages a sign-in can end on stand outside the aanmeldpoort (TB-026). Inside it they would wait
  // on the tussenpagina for an answer that, for someone refused, only ever loops through the sign-in.
  it.each([
    ["/geen-toegang", "aanmelding.geenToegang.titel"],
    ["/aanmelden-mislukt", "aanmelding.mislukt.titel"],
  ] as const)("toont %s buiten de aanmeldpoort, zonder de API te vragen", async (pad, titel) => {
    aangemeld.bekend = false;
    openOp(pad);

    expect(await screen.findByRole("heading", { level: 1, name: t(titel) })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("opent op de agenda en niet op Doelen", async () => {
    openOp("/");
    await waitFor(() => expect(window.location.pathname).toBe("/agenda"));
  });

  it("stuurt een adres dat het niet kent naar de agenda", async () => {
    openOp("/bestaat-niet");
    await waitFor(() => expect(window.location.pathname).toBe("/agenda"));
  });

  it("opent Instellingen op het eerste onderdeel", async () => {
    openOp("/instellingen");
    await waitFor(() => expect(window.location.pathname).toBe("/instellingen/klassen"));
  });

  // One assertion per part, so a part that loses its screen fails here rather than falling into the
  // `*` route and redirecting to the agenda, which looks like a working app. Driven off `ONDERDELEN`
  // itself: a fifth part is covered the moment it is added, and cannot arrive untested the way
  // Weergave did. As admin, who may see every part, Gebruikers included (E6-04).
  it("stuurt wie geen admin is van Gebruikers naar het eerste onderdeel", async () => {
    aangemeld.isAdmin = false;
    openOp("/instellingen/gebruikers");
    await waitFor(() => expect(window.location.pathname).toBe("/instellingen/klassen"));
    expect(screen.queryByRole("heading", { level: 1, name: t("instellingen.gebruikers") })).not.toBeInTheDocument();
  });

  it.each(ONDERDELEN.map(({ deel, labelSleutel }) => [deel, labelSleutel] as const))(
    "toont het onderdeel %s op zijn eigen adres",
    async (deel, labelSleutel) => {
      openOp(`/instellingen/${deel}`);
      const titel = await screen.findByRole("heading", { level: 1, name: t(labelSleutel) });
      expect(titel).toBeInTheDocument();
      expect(window.location.pathname).toBe(`/instellingen/${deel}`);
    },
  );
});
