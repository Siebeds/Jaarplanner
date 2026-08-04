import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { useSelectie } from "../../app/useSelectie";
import { t, tAantal } from "../../i18n";
import { ApiError } from "../../lib/api";
import { DoelsuggestieGeneratie } from "../matching/DoelsuggestieGeneratie";
import { DoelsuggestieLijst } from "../matching/DoelsuggestieLijst";
import { Doelkiezer } from "./Doelkiezer";
import { Klaslaag } from "./Klaslaag";
import { Themaformulier } from "./Themaformulier";
import {
  useThemaBibliotheek,
  useVerwijderThema,
  useVerwijderThemadoel,
  useVoegThemadoelToe,
  useWijzigThema,
} from "./useThemas";
import type { ThemaInvoer } from "./types";

/** The nested route the detail renders at, and the parameter it reads. */
export const THEMA_DETAIL_PAD = ":themaId";

/**
 * One thema in full (E1-14, FR-3.1/3.2/3.3, Art. IX.2).
 *
 * **The screen is built around the level boundary, because that is the thing a teacher can get wrong.** A
 * thema, its themadoelen and its woordenschat belong to the *school*: editing them changes what every
 * colleague sees. Subthema's and activiteiten belong to *one class and one age*. So the detail has two
 * sections, each stating whose it is once at the top rather than badging every row, and each reading its own
 * endpoint: the school-wide half comes from the bibliotheek (which contains no class's content at all), the
 * class half from `…/voor-klas/{klasId}`. The separation is enforced by *which request is made*, not by which
 * fields a component chooses to render.
 *
 * **The AI suggestions live here too**, per the owner's ruling of 2026-08-04. Before this story they sat
 * behind a thema-id typed into a text box on `/themas`, which E2-08 shipped as an admitted stopgap because no
 * thema list existed yet. Now the suggestions are about the thema already open, and the stopgap is gone.
 */
export function Themadetail() {
  const { themaId } = useParams<{ themaId: string }>();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { klasId } = useSelectie();

  const [wijzigen, setWijzigen] = useState(false);
  const [verwijderen, setVerwijderen] = useState(false);
  const [doelKiezen, setDoelKiezen] = useState(false);

  const bibliotheek = useThemaBibliotheek();
  const wijzigThema = useWijzigThema();
  const verwijderThema = useVerwijderThema();
  const voegThemadoelToe = useVoegThemadoelToe();
  const verwijderThemadoel = useVerwijderThemadoel();

  // The school-wide layer of this thema, taken from the list's own query: the same cache entry, so opening a
  // thema costs no second request, and the pane cannot show a field the bibliotheek does not carry.
  const thema = bibliotheek.data?.find((item) => item.id === themaId);

  if (bibliotheek.isPending) {
    return <p className="text-sm text-ink-zacht">{t("themabeheer.detailLaden")}</p>;
  }

  if (bibliotheek.isError) {
    return (
      <p role="alert" className="text-sm font-medium text-suggestie-geweigerd">
        {t("themabeheer.detailFout")}
      </p>
    );
  }

  if (!thema) {
    // A bookmark to a deleted thema, or a hand-edited URL. Named honestly, with the way back.
    return (
      <div className="rounded-lg border border-border bg-card px-5 py-6">
        <h2 className="text-lg font-bold text-ink">{t("themabeheer.onbekendTitel")}</h2>
        <p className="mt-1 text-sm text-ink-zacht">{t("themabeheer.onbekendUitleg")}</p>
        <Link
          to={{ pathname: "/themas", search }}
          className="mt-3 inline-block text-sm font-semibold text-petrol underline"
        >
          {t("themabeheer.terug")}
        </Link>
      </div>
    );
  }

  const gekoppeldeCodes = thema.themadoelen.map((themadoel) => themadoel.koppeling.leerplandoelCode);

  function bewaarWijziging(invoer: ThemaInvoer) {
    wijzigThema.mutate(
      { themaId: thema!.id, invoer },
      { onSuccess: () => setWijzigen(false) },
    );
  }

  function bevestigVerwijderen() {
    verwijderThema.mutate(thema!.id, {
      // Back to the list, because the thing this pane was showing no longer exists. The klas/schooljaar
      // choice travels along: deleting a thema is not a reason to reset which class a teacher is working on.
      onSuccess: () => navigate({ pathname: "/themas", search }, { replace: true }),
    });
  }

  const verwijderMelding =
    verwijderThema.error instanceof ApiError ? verwijderThema.error.detail : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to={{ pathname: "/themas", search }}
          className="text-sm font-semibold text-petrol underline lg:hidden"
        >
          {t("themabeheer.terug")}
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-2xl font-bold text-ink">{thema.naam}</h2>
          <span className="text-sm font-medium text-ink-zacht">
            {tAantal(thema.duurWeken, "themabeheer.duurEnkelvoud", "themabeheer.duur")}
          </span>
        </div>
      </header>

      {/* ---- The school-wide layer. Whose it is, said once, above everything it governs. ---- */}
      <section aria-labelledby="thema-school" className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="thema-school" className="text-sm font-bold uppercase tracking-wide text-petrol">
              {t("themabeheer.schoolTitel")}
            </h3>
            <p className="mt-0.5 max-w-prose text-sm text-ink-zacht">{t("themabeheer.schoolUitleg")}</p>
          </div>

          {wijzigen ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setWijzigen(true)}
                className="rounded-md border border-input px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-diep"
              >
                {t("themabeheer.wijzigActie")}
              </button>
              {/*
                Deliberately a weaker weight than "Wijzigen" and never adjacent to it as an identical twin.
                E4-06's owner ruling of 2026-07-31 was exactly this: two visually identical outline buttons, one
                reversible and one not, is a trap. Deleting also needs the confirmation below, which is the real
                protection; the weight is what stops the click happening by reflex.
              */}
              <button
                type="button"
                onClick={() => setVerwijderen(true)}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-suggestie-geweigerd underline hover:bg-paper-diep"
              >
                {t("themabeheer.verwijderActie")}
              </button>
            </div>
          )}
        </div>

        {wijzigen ? (
          <div className="mt-4">
            <Themaformulier
              thema={{
                id: thema.id,
                naam: thema.naam,
                duurWeken: thema.duurWeken,
                invalshoeken: thema.invalshoeken,
                kernwoordenschat: thema.kernwoordenschat,
                rijkeWoordenschat: thema.rijkeWoordenschat,
                heeftVoldoendeThemadoelen: thema.heeftVoldoendeThemadoelen,
                themadoelen: thema.themadoelen,
                // The form neither reads nor writes subthema's: they are another level with another owner.
                subthemas: [],
              }}
              onBewaar={bewaarWijziging}
              onAnnuleer={() => setWijzigen(false)}
              bezig={wijzigThema.isPending}
              fout={wijzigThema.error}
            />
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Veld label={t("themabeheer.invalshoekenLabel")} waarde={thema.invalshoeken} />
            <Veld
              label={t("themabeheer.kernwoordenschatLabel")}
              waarde={thema.kernwoordenschat.join(", ")}
            />
            <Veld
              label={t("themabeheer.rijkeWoordenschatLabel")}
              waarde={thema.rijkeWoordenschat.join(", ")}
            />
          </dl>
        )}

        {verwijderen ? (
          <div className="mt-4 rounded-md border border-suggestie-geweigerd/40 bg-card p-3.5">
            <h4 className="text-sm font-bold text-ink">{t("themabeheer.verwijderTitel")}</h4>
            {/*
              What is lost is stated as a count of classes, never as a list of their content: the count comes
              from the bibliotheek's own `aantalAfgeleideKlassen`, so the sentence is true without this screen
              ever reading another class's subthema's (Art. IX.2).
            */}
            <p className="mt-1 text-sm text-ink-zacht">
              {thema.aantalAfgeleideKlassen === 0
                ? t("themabeheer.verwijderGevolgLeeg")
                : tAantal(
                    thema.aantalAfgeleideKlassen,
                    "themabeheer.verwijderGevolgEnkelvoud",
                    "themabeheer.verwijderGevolg",
                  )}
            </p>

            {verwijderThema.isError ? (
              <div role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
                <p>{t("themabeheer.verwijderMislukt")}</p>
                {/*
                  The server's own sentence, when it sent one. This is the refusal path that matters: a thema
                  still placed in a jaarplan cannot be deleted, and only the server knows how many placements
                  there are and in which class. Art. II.3 (amended 2026-07-30) permits rendering it; the framing
                  above stays ours, and stands alone when a 500 carries no detail.
                */}
                {verwijderMelding ? (
                  <p className="mt-1 font-normal text-ink-zacht">
                    {t("themabeheer.serverReden", { melding: verwijderMelding })}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={bevestigVerwijderen}
                disabled={verwijderThema.isPending}
                className="rounded-md bg-suggestie-geweigerd px-3 py-1.5 text-sm font-semibold text-suggestie-geweigerd-foreground disabled:opacity-60"
              >
                {verwijderThema.isPending
                  ? t("themabeheer.verwijderBezig")
                  : t("themabeheer.verwijderBevestig")}
              </button>
              <button
                type="button"
                onClick={() => setVerwijderen(false)}
                className="rounded-md border border-input px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-diep"
              >
                {t("themabeheer.annuleer")}
              </button>
            </div>
          </div>
        ) : null}

        {/* ---- Themadoelen: the school-wide anchors, with the 2-or-3 advice as advice. ---- */}
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-ink">{t("themabeheer.themadoelenLabel")}</h4>
            <button
              type="button"
              onClick={() => setDoelKiezen((open) => !open)}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-diep"
            >
              {doelKiezen ? t("themabeheer.annuleer") : t("themabeheer.doelKiezerTitel")}
            </button>
          </div>

          {thema.heeftVoldoendeThemadoelen ? null : (
            <p className="mt-1.5 rounded-sm bg-attentie-zacht px-2 py-1 text-xs font-medium text-attentie-ink">
              {t("themabeheer.adviesUitleg")}
            </p>
          )}

          {thema.themadoelen.length === 0 ? (
            <p className="mt-2 text-sm text-ink-zacht">{t("themabeheer.themadoelenGeen")}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {thema.themadoelen.map((themadoel) => (
                <li
                  key={themadoel.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-xs font-semibold text-ink">
                      {themadoel.koppeling.leerplandoelCode}
                    </span>
                    {/* The status is a word, from the shared vocabulary the review screen uses (Art. IV.2):
                        a teacher must be able to see that a link is still only a proposal. */}
                    <span className="text-xs text-ink-zacht">
                      {t(`suggestieStatus.${statusSleutel(themadoel.koppeling.status)}`)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      verwijderThemadoel.mutate({ themaId: thema.id, themadoelId: themadoel.id })
                    }
                    disabled={verwijderThemadoel.isPending}
                    aria-label={t("themabeheer.ontkoppelAria", {
                      code: themadoel.koppeling.leerplandoelCode,
                    })}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-suggestie-geweigerd underline hover:bg-paper-diep disabled:opacity-60"
                  >
                    {t("themabeheer.ontkoppel")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {verwijderThemadoel.isError ? (
            <p role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
              {t("themabeheer.ontkoppelMislukt")}
            </p>
          ) : null}

          {doelKiezen ? (
            <div className="mt-3">
              <Doelkiezer
                gekoppeldeCodes={gekoppeldeCodes}
                bezig={voegThemadoelToe.isPending}
                onKoppel={(code) =>
                  voegThemadoelToe.mutate(
                    { themaId: thema.id, leerplandoelCode: code },
                    { onSuccess: () => setDoelKiezen(false) },
                  )
                }
              />
              {voegThemadoelToe.isError ? (
                <p role="alert" className="mt-2 text-sm font-medium text-suggestie-geweigerd">
                  {t("themabeheer.doelKoppelMislukt")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* ---- The class-scoped layer. Its own endpoint, its own section, its own sentence. ---- */}
      <Klaslaag themaId={thema.id} klasId={klasId} />

      {/* ---- The AI suggestions for this thema (E2-05 review + E2-08 trigger, mounted here per the owner's
              ruling of 2026-08-04). The components are E2's, unchanged; only the thema id's source changed. ---- */}
      <section aria-labelledby="thema-suggesties" className="border-t border-border pt-5">
        {/* E2's own copy, deliberately not reworded into a `themabeheer.*` key: `matching.uitleg` already reads
            "De AI stelt leerplandoelen voor bij dit thema", which was written for a page that had to ask which
            thema it meant and is simply true here. Duplicating it under a second key would leave two sentences
            about one feature to drift apart. */}
        <h3 id="thema-suggesties" className="text-lg font-bold text-ink">
          {t("matching.titel")}
        </h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-zacht">{t("matching.uitleg")}</p>
        <div className="mt-3 flex flex-col gap-4">
          <DoelsuggestieGeneratie themaId={thema.id} />
          <DoelsuggestieLijst themaId={thema.id} />
        </div>
      </section>
    </div>
  );
}

/** One read-only field, with an honest empty state instead of a blank space. */
function Veld({ label, waarde }: { label: string; waarde: string | null }) {
  const gevuld = waarde !== null && waarde.trim().length > 0;

  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">{label}</dt>
      <dd className={gevuld ? "mt-0.5 text-sm text-ink" : "mt-0.5 text-sm italic text-ink-zacht"}>
        {gevuld ? waarde : t("themabeheer.nietIngevuld")}
      </dd>
    </div>
  );
}

/**
 * The catalogue key for a link status.
 *
 * The wire sends `"Voorgesteld"`, `nl.json` keys are `suggestieStatus.voorgesteld`, and lower-casing the first
 * letter is the whole mapping. Written as a function rather than inline so the two vocabularies meet in one
 * place: if a fifth `KoppelingStatus` ever arrives, this is where it fails to resolve.
 */
function statusSleutel(status: string): "voorgesteld" | "aanvaard" | "geweigerd" | "manueel" {
  return status.toLowerCase() as "voorgesteld" | "aanvaard" | "geweigerd" | "manueel";
}
