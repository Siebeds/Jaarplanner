import type {
  OpstapImportAntwoord,
  SchoolcontentImportAntwoord,
  SchoolcontentImportDiff,
} from "./types";

/**
 * Fixtures for the import tests, plus the fetch fake that serves them.
 *
 * The fake answers at the **fetch boundary** (the convention `Jaarplankalender.test.tsx` set) and it **records
 * every request with its parsed multipart body**. That matters more here than on a read screen: half of what
 * this story has to get right is *what is sent* — the mode, and above all the Art. IV.2 opt-in, whose whole
 * point is that it is false unless a human said otherwise. A test that only asserted the rendered result would
 * pass just as happily if the flag were hard-coded to true.
 */

/** A stand-in `.xlsx`. Its bytes are never parsed: the server does that, and here the server is this file. */
export function maakBestand(naam = "themas.xlsx"): File {
  return new File(["niet echt een werkmap"], naam, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** A diff with nothing in it, as the sensible base for a fixture that varies one thing. */
export function leegDiff(overschrijf: Partial<SchoolcontentImportDiff> = {}): SchoolcontentImportDiff {
  const basis: SchoolcontentImportDiff = {
    modus: "Toevoegen",
    themas: [],
    subthemas: [],
    activiteiten: [],
    bedreigdeBeslissingen: [],
    overgeslagen: false,
    opmerkingen: [],
    isLeeg: true,
    vereistReview: false,
  };

  const samen = { ...basis, ...overschrijf };

  // `isLeeg` and `vereistReview` are *computed* server-side, so a fixture that set them by hand could describe
  // a payload the API cannot produce. Derived here from the same rules the C# properties use.
  const ongewijzigd =
    samen.themas.every((t) => t.soort === "Ongewijzigd") &&
    samen.subthemas.every((s) => s.soort === "Ongewijzigd") &&
    samen.activiteiten.every((a) => a.soort === "Ongewijzigd");

  return {
    ...samen,
    isLeeg: ongewijzigd,
    vereistReview: samen.overgeslagen || samen.bedreigdeBeslissingen.length > 0 || !ongewijzigd,
  };
}

/** A clean run: the file parsed and nothing was dropped. Both verdicts good. */
export const SCHOON: SchoolcontentImportAntwoord = {
  isBestandGeldig: true,
  isVolledigVerwerkt: true,
  problemen: [],
  diff: leegDiff({
    themas: [{ naam: "Herfst", soort: "Toegevoegd" }],
    subthemas: [
      { themaNaam: "Herfst", naam: "Bladeren", klas: "K3 groen", leeftijd: "5-6", soort: "Toegevoegd" },
    ],
    activiteiten: [
      {
        themaNaam: "Herfst",
        subthemaNaam: "Bladeren",
        naam: "Bladeren zoeken in het bos",
        soort: "Toegevoegd",
      },
    ],
  }),
  toegepast: false,
};

/**
 * **The case clause 3 exists for**: the file parsed perfectly and content was still dropped.
 *
 * Reported as one "OK" this reads as a success, which is the defect E1-07's own audit rejected server-side.
 * Here it must read as a warning.
 */
export const GELDIG_MAAR_VERLIES: SchoolcontentImportAntwoord = {
  isBestandGeldig: true,
  isVolledigVerwerkt: false,
  problemen: [],
  diff: leegDiff({
    themas: [{ naam: "Herfst", soort: "Toegevoegd" }],
    opmerkingen: [
      "1 leerplandoelcode uit dit bestand is overgeslagen. Deze code staat niet in de ingelezen Op.stap-doelen: TYPO-999. Controleer de codes, of laad eerst de discipline in waar ze bij horen.",
    ],
  }),
  toegepast: false,
};

/** Per-row problems, including a **file-level** one whose `rijNummer` is 0. */
export const MET_PROBLEMEN: SchoolcontentImportAntwoord = {
  isBestandGeldig: false,
  isVolledigVerwerkt: false,
  problemen: [
    {
      rijNummer: 7,
      melding: "Verplicht veld 'Klas' ontbreekt.",
      kolom: "SubthemaKlas",
      kolomLabel: "Klas",
    },
    {
      rijNummer: 9,
      melding: "Onbekend activiteittype 'zwemmen'.",
      kolom: "ActiviteitType",
      kolomLabel: "Type",
    },
    {
      // Row 0 means "the file, not a row". Printed verbatim it reads "rij 0", which is a lie.
      rijNummer: 0,
      melding: "Het bestand bevat geen koprij; voeg een koprij met de kolomtitels toe.",
      kolom: null,
      kolomLabel: null,
    },
  ],
  diff: leegDiff({
    overgeslagen: true,
    opmerkingen: [
      "Er zijn geen bruikbare rijen ingelezen, dus er is niets geïmporteerd. Het bestand is misschien leeg of onvolledig, of het is niet het juiste bestand.",
    ],
  }),
  toegepast: false,
};

/**
 * A bad row among good ones: the file did not parse cleanly, yet nothing is reported as *dropped*.
 *
 * Realistic and worth its own fixture: the well-formed rows import, so there is no opmerking, while
 * `isVolledigVerwerkt` is still false because the rejected rows are themselves content that did not land.
 * That is the branch where a count-based sentence would read "0 stukken inhoud".
 */
export const MET_RIJPROBLEEM_ZONDER_VERLIES: SchoolcontentImportAntwoord = {
  isBestandGeldig: false,
  isVolledigVerwerkt: false,
  problemen: [
    {
      rijNummer: 4,
      melding: "'Thema duur (weken)' moet een positief geheel getal zijn (gevonden: 'vijf').",
      kolom: "ThemaDuurWeken",
      kolomLabel: "Thema duur (weken)",
    },
  ],
  diff: leegDiff({ themas: [{ naam: "Herfst", soort: "Toegevoegd" }] }),
  toegepast: false,
};

/** A `Bijwerken` preview that threatens four teacher decisions (Art. IV.2). */
export const MET_BEDREIGDE_BESLISSINGEN: SchoolcontentImportAntwoord = {
  isBestandGeldig: true,
  isVolledigVerwerkt: true,
  problemen: [],
  diff: leegDiff({
    modus: "Bijwerken",
    themas: [{ naam: "Herfst", soort: "Bijgewerkt" }],
    bedreigdeBeslissingen: [
      {
        niveau: "Themadoel",
        contentNaam: "Herfst",
        leerplandoelCode: "NC-1.1",
        status: "Aanvaard",
      },
      {
        niveau: "Subdoel",
        contentNaam: "Bladeren",
        leerplandoelCode: "WO-2.3",
        status: "Manueel",
      },
      {
        niveau: "Activiteit",
        contentNaam: "Bladeren zoeken",
        leerplandoelCode: "WO-2.4",
        status: "Geweigerd",
      },
      {
        niveau: "Activiteit",
        contentNaam: "Bladeren persen",
        leerplandoelCode: "WO-2.5",
        status: "Aanvaard",
      },
    ],
  }),
  toegepast: false,
};

/** 40 unchanged thema's and 1 added: the "Ongewijzigd is the majority" case. */
export const VEEL_ONGEWIJZIGD: SchoolcontentImportAntwoord = {
  isBestandGeldig: true,
  isVolledigVerwerkt: true,
  problemen: [],
  diff: leegDiff({
    themas: [
      { naam: "Nieuw thema", soort: "Toegevoegd" },
      ...Array.from({ length: 40 }, (_, i) => ({
        naam: `Bestaand thema ${i + 1}`,
        soort: "Ongewijzigd" as const,
      })),
    ],
  }),
  toegepast: false,
};

/** The same answer as a commit: `toegepast` true, which is what flips the copy into the past tense. */
export function alsDoorgevoerd(antwoord: SchoolcontentImportAntwoord): SchoolcontentImportAntwoord {
  return { ...antwoord, toegepast: true };
}

/** One recorded upload: which endpoint, and what the multipart body carried. */
export interface Verzoek {
  pad: string;
  bestandsnaam?: string;
  modus?: string;
  beslissingenVerwijderen?: string;
  disciplineNummer?: string;
  /** The headers the client set, so a stray `Content-Type` on a multipart body is observable. */
  headers: Record<string, string>;
}

/**
 * `"hangt"` leaves the call in flight forever, which is how a test observes an in-flight state at all: with an
 * immediately-resolving fake the whole pending phase is over before an assertion can run, and a "frozen while
 * busy" guard would be untestable and therefore unnoticed when it broke.
 */
export type Antwoordkeuze<T> = T | Response | "hangt";

export interface ImportFakeOpties {
  /** The school-content preview answer, a `Response` to fail with, or `"hangt"`. */
  voorbeeld?: Antwoordkeuze<SchoolcontentImportAntwoord>;
  /** The school-content commit answer. Defaults to the preview answer with `toegepast: true`. */
  commit?: Antwoordkeuze<SchoolcontentImportAntwoord>;
  /** The Op.stap preview answer, a `Response` to fail with, or `"hangt"`. */
  opstapVoorbeeld?: Antwoordkeuze<OpstapImportAntwoord>;
  /** The Op.stap commit answer. Defaults to the preview answer with `toegepast: true`. */
  opstapCommit?: Antwoordkeuze<OpstapImportAntwoord>;
}

/**
 * Serves both importers and records every upload.
 *
 * `/api/schooljaren` is answered too, because the app shell's klas picker asks for it on every screen; leaving
 * it to 404 would put an unrelated error alert on the page under test.
 */
export function maakImportFetchFake(opties: ImportFakeOpties = {}) {
  const verzoeken: Verzoek[] = [];

  function antwoordVan(waarde: unknown): Response | Promise<Response> {
    if (waarde === "hangt") {
      return new Promise<Response>(() => {
        // Never settles, on purpose. See `Antwoordkeuze`.
      });
    }

    return waarde instanceof Response
      ? waarde
      : new Response(JSON.stringify(waarde), { status: 200 });
  }

  /** The fallback commit answer: the configured preview, marked as applied. */
  function commitVan<T extends { toegepast: boolean }>(
    basis: Antwoordkeuze<T> | undefined,
    standaard: T,
  ): Antwoordkeuze<T> {
    return basis instanceof Response || basis === undefined || basis === "hangt"
      ? { ...standaard, toegepast: true }
      : { ...basis, toegepast: true };
  }

  const fetchFake = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");

    if (url.pathname === "/api/schooljaren") {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    const formulier = init?.body instanceof FormData ? init.body : undefined;
    if (formulier) {
      const bestand = formulier.get("bestand");
      verzoeken.push({
        pad: url.pathname,
        bestandsnaam: bestand instanceof File ? bestand.name : undefined,
        modus: (formulier.get("modus") as string | null) ?? undefined,
        beslissingenVerwijderen:
          (formulier.get("menselijkeBeslissingenVerwijderen") as string | null) ?? undefined,
        disciplineNummer: (formulier.get("disciplineNummer") as string | null) ?? undefined,
        headers: { ...((init?.headers as Record<string, string>) ?? {}) },
      });
    }

    if (url.pathname === "/api/schoolcontent-import/voorbeeld") {
      return antwoordVan(opties.voorbeeld ?? SCHOON);
    }

    if (url.pathname === "/api/schoolcontent-import") {
      return antwoordVan(opties.commit ?? commitVan(opties.voorbeeld, SCHOON));
    }

    if (url.pathname === "/api/opstap-import/voorbeeld") {
      return antwoordVan(opties.opstapVoorbeeld ?? OPSTAP_SCHOON);
    }

    if (url.pathname === "/api/opstap-import") {
      return antwoordVan(opties.opstapCommit ?? commitVan(opties.opstapVoorbeeld, OPSTAP_SCHOON));
    }

    return new Response("unexpected request", { status: 404 });
  };

  return { fetchFake, verzoeken };
}

// ---------------------------------------------------------------------------------------------------
// Op.stap fixtures (clause 6)
// ---------------------------------------------------------------------------------------------------

/** A first import of a discipline: everything new, nothing to review. */
export const OPSTAP_SCHOON: OpstapImportAntwoord = {
  isBestandGeldig: true,
  isVolledigVerwerkt: true,
  problemen: [],
  diff: {
    disciplineNummer: "1",
    toegevoegd: ["NC-1.1", "NC-1.2"],
    gewijzigd: [],
    ongewijzigd: [],
    verdwenen: [],
    verdwenenMaarGekoppeld: [],
    overgeslagen: false,
    opmerkingen: [],
    isLeeg: false,
    vereistReview: false,
  },
  toegepast: false,
};

/** A re-import that must be reviewed: a reworded goal, and one that vanished while still linked. */
export const OPSTAP_TE_HERZIEN: OpstapImportAntwoord = {
  isBestandGeldig: true,
  isVolledigVerwerkt: true,
  problemen: [],
  diff: {
    disciplineNummer: "1",
    toegevoegd: ["NC-1.3"],
    gewijzigd: [
      {
        code: "NC-1.1",
        velden: [
          { veld: "Tekst", oudeWaarde: "De leerling luistert.", nieuweWaarde: "De leerling luistert actief." },
          { veld: "Cluster", oudeWaarde: null, nieuweWaarde: "Luisteren" },
        ],
      },
    ],
    ongewijzigd: Array.from({ length: 120 }, (_, i) => `NC-9.${i + 1}`),
    verdwenen: ["NC-8.1"],
    verdwenenMaarGekoppeld: [{ code: "NC-7.1", aantalKoppelingen: 3 }],
    overgeslagen: false,
    opmerkingen: [],
    isLeeg: false,
    vereistReview: true,
  },
  toegepast: false,
};

/** Rows of the official file that could not be mapped. Their `reden` is English on purpose. */
export const OPSTAP_MET_RIJPROBLEMEN: OpstapImportAntwoord = {
  isBestandGeldig: false,
  isVolledigVerwerkt: false,
  problemen: [
    { rijNummer: 12, reden: "Unknown doelsoort 'X'.", code: "NC-2.4" },
    { rijNummer: 13, reden: "Missing code.", code: null },
  ],
  diff: {
    ...OPSTAP_SCHOON.diff,
    toegevoegd: [],
    isLeeg: true,
    vereistReview: false,
  },
  toegepast: false,
};

/** The E1-12 refusal: the decreed minimumdoelen are not loaded, so the file cannot land at all. */
export function opstapOntbrekendeMinimumdoelen(): Response {
  return new Response(
    JSON.stringify({
      type: "https://tools.ietf.org/html/rfc9110#section-15.5.10",
      title: "Import niet doorgevoerd",
      status: 409,
      detail:
        "Deze leerplandoelen verwijzen naar minimumdoelen die nog niet ingeladen zijn: K-1, K-2. " +
        "Laad eerst de decretale minimumdoelen in. Er is niets gewijzigd aan de doelen die al in de toepassing staan.",
      traceId: "00-test-01",
    }),
    { status: 409 },
  );
}

/** The 400 for a discipline number Op.stap does not have. */
export function opstapOnbekendeDiscipline(): Response {
  return new Response(
    JSON.stringify({
      detail:
        "'42' is geen Op.stap-discipline. Gebruik het officiële disciplinenummer, bijvoorbeeld 1 voor " +
        "Nederlands en communicatie of 9.2 voor Leren leren.",
      status: 400,
      title: "Ongeldige aanvraag",
    }),
    { status: 400 },
  );
}
