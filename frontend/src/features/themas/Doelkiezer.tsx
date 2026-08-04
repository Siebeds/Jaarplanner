import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DoelsoortBadge } from "../../components/DoelsoortBadge";
import { t, tAantal } from "../../i18n";
import { haalDoelen, haalDoelenFacetten } from "../doelen/api";
import { badgeSoort } from "../doelen/doelenfilter";
import type { DoelRegel } from "../doelen/types";

/**
 * Search the Op.stap register and link one leerplandoel (E1-14, FR-3.2).
 *
 * **It searches server-side through the Doelen register's own query** (`GET /api/leerplandoelen`, E1-16). Two
 * things follow, and both are deliberate:
 * - It is **not** `GET /api/leerplandoelen/ongekoppeld`. That set hides goals already linked somewhere else,
 *   and a leerplandoel may legitimately hang off several activiteiten or several thema's, so the "unlinked"
 *   list would silently make correct choices unreachable. Recorded on the story as the reason E1-14 waited
 *   for E1-16.
 * - Nothing is filtered in the browser. After a full import the register is thousands of rows, and narrowing
 *   client-side means fetching all of them on every keystroke.
 *
 * **The goals already linked here are passed in, not fetched.** The caller knows them (they are on screen
 * right above), and a doel that is already linked is shown as such rather than hidden: hiding it would leave
 * a teacher searching for something they cannot find and unable to tell "not in the curriculum" from
 * "already done".
 */
export interface DoelkiezerProps {
  /**
   * What the link will attach to, as a Dutch noun phrase from `nl.json` (`themabeheer.niveau*`).
   *
   * It goes into the two aria labels, so a screen-reader user hears *"Leerplandoel NAT-K3-01 koppelen aan dit
   * subthema"* rather than three identical buttons on one screen. The picker is used at all three levels
   * (thema, subthema, activiteit) and before landing 2 its label said "aan dit thema" unconditionally.
   */
  waaraan: string;
  /** Codes already linked at this level, so they render as such instead of as an offer. */
  gekoppeldeCodes: readonly string[];
  /** Link this code. The caller owns the mutation, its pending state and its error copy. */
  onKoppel: (code: string) => void;
  /** True while the caller's mutation is in flight, so the buttons can say so and stop repeating it. */
  bezig: boolean;
}

/** How many hits the picker offers at once. The rest is a count plus an instruction to search harder. */
const MAX_RESULTATEN = 8;

/** Below this, a search is too broad to be worth a request: two characters is where a code starts to mean something. */
const MINIMUM_ZOEKLENGTE = 2;

export function Doelkiezer({ waaraan, gekoppeldeCodes, onKoppel, bezig }: DoelkiezerProps) {
  const [zoek, setZoek] = useState("");
  const veldId = `doelkiezer-zoek-${waaraan.replace(/\s+/g, "-")}`;
  const genormaliseerd = zoek.trim();
  const magZoeken = genormaliseerd.length >= MINIMUM_ZOEKLENGTE;

  /**
   * Its **own** query key, deliberately not the register's `["doelen", filter]`.
   *
   * Sharing that key looks like free cache reuse and is a defect: `useDoelen` is a `useInfiniteQuery`, so its
   * cache entry holds `{pages, pageParams}` while this is a plain query holding one page. Two shapes under one
   * key means whichever ran last decides what the other reads. Same endpoint, same server-side filtering, one
   * extra cache entry for a picker that asks for one page.
   */
  const resultaat = useQuery({
    queryKey: ["doelkiezer", genormaliseerd],
    queryFn: () => haalDoelen({ zoek: genormaliseerd }, 0),
    enabled: magZoeken,
  });

  /**
   * Whether the school has any curriculum at all, asked separately from the search.
   *
   * Without this the picker cannot tell **"nothing imported"** from **"this search matched nothing"**, and it
   * would answer a school with an empty register with "geen leerplandoel gevonden voor die zoekterm" — sending
   * a teacher to refine a search that can never match. That exact confusion cost the Doelen register an
   * antagonist finding (E1-16, finding 1), which is why it is designed in here rather than discovered again.
   * `totaalAantalDoelen` is the unfiltered total, so it answers the question the search cannot.
   */
  const facetten = useQuery({
    queryKey: ["doelkiezer-facetten"],
    queryFn: () => haalDoelenFacetten({}),
    // The curriculum only changes on an import, so this does not need refetching while a teacher links goals.
    staleTime: 5 * 60 * 1000,
  });

  const regels: DoelRegel[] = resultaat.data?.regels ?? [];
  const getoond = regels.slice(0, MAX_RESULTATEN);
  const rest = (resultaat.data?.totaal ?? 0) - getoond.length;

  // Only once the answer is actually known. While the request is in flight the search box stays, because
  // hiding it on a maybe is how a working control disappears on a slow connection.
  if (facetten.data && facetten.data.totaalAantalDoelen === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-ink-zacht">{t("themabeheer.doelGeenCurriculum")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <label className="block text-sm font-semibold text-ink" htmlFor={veldId}>
        {t("themabeheer.doelZoekLabel")}
      </label>
      <input
        id={veldId}
        type="search"
        value={zoek}
        onChange={(event) => setZoek(event.target.value)}
        placeholder={t("themabeheer.doelZoekPlaceholder")}
        className="mt-2 h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-ink placeholder:text-ink-zacht"
      />

      {/* The three states below are three different facts, and telling them apart is the whole job of this
          block: too short a term, a request in flight, and a genuinely empty result. Collapsing them is how a
          teacher ends up reading "niets gevonden" about a search that was never sent. */}
      {!magZoeken ? (
        <p className="mt-3 text-sm text-ink-zacht">{t("themabeheer.doelZoekKort")}</p>
      ) : resultaat.isPending ? (
        <p className="mt-3 text-sm text-ink-zacht">{t("themabeheer.doelZoekBezig")}</p>
      ) : resultaat.isError ? (
        <p role="alert" className="mt-3 text-sm font-medium text-suggestie-geweigerd">
          {t("themabeheer.doelZoekFout")}
        </p>
      ) : getoond.length === 0 ? (
        <p className="mt-3 text-sm text-ink-zacht">{t("themabeheer.doelGeenResultaat")}</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-1.5">
            {getoond.map((doel) => {
              const alGekoppeld = gekoppeldeCodes.includes(doel.code);

              return (
                <li
                  key={doel.code}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <DoelsoortBadge doelsoort={badgeSoort(doel.doelsoort)} />
                      <span className="font-mono text-xs font-semibold text-ink">{doel.code}</span>
                      <span className="text-xs text-ink-zacht">{doel.jaarFase}</span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-ink">{doel.tekst}</p>
                  </div>

                  {alGekoppeld ? (
                    <span className="shrink-0 text-xs font-medium text-ink-zacht">
                      {t("themabeheer.doelAlGekoppeld")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onKoppel(doel.code)}
                      disabled={bezig}
                      aria-label={t("themabeheer.doelKoppelAria", { code: doel.code, waaraan })}
                      className="shrink-0 rounded-md bg-petrol px-3 py-1.5 text-xs font-semibold text-petrol-foreground hover:bg-petrol-helder disabled:opacity-60"
                    >
                      {bezig ? t("themabeheer.doelKoppelBezig") : t("themabeheer.doelKoppel")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {rest > 0 ? (
            <p className="mt-2 text-xs text-ink-zacht">
              {tAantal(rest, "themabeheer.doelMeerEnkelvoud", "themabeheer.doelMeer")}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
