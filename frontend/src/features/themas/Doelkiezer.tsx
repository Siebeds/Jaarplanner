import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useKlas } from "../../app/klasdetail";
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
 * **It offers this class's own jaar/fase by default, and says so** (E9-07, CR5). An L3 teacher searching "water"
 * used to get every kleuterdoel in the register, because the search was unscoped. The default is now the codes the
 * server says this class teaches, with a visible control to widen to the whole curriculum, and a sentence naming which
 * scope was applied. **Narrow by default, widen on request, never hide:** a graadklas legitimately teaches across
 * fasen, and a picker that silently withheld a goal a teacher knows exists would send them looking for a bug in the
 * import.
 *
 * **On an undetermined class it widens rather than narrowing to nothing.** An empty `jaarFasen` means the set could not
 * be derived (the unresolved graadklas case), and a search scoped to an empty set makes every leerplandoel unreachable
 * -- worse than the unscoped search this story replaces. See `Klasdetail.jaarFasen`.
 *
 * **What it does NOT do, and the reason is that the derivation does not exist.** A subthema is scoped per klas *and*
 * leeftijd (Art. IX.2), so at the subdoel level the relevant set is narrower still: the subthema's own `Leeftijd`. The
 * domain has `Jaarfasen.VoorLeerjaar` and **no** `VoorLeeftijd`, so scoping to a subthema's leeftijd would mean
 * inventing a second mapping from age to Op.stap code in the client -- exactly the drift the backend half of this story
 * refused. Left to a story that can rule on the mapping; the class scope is the part CR5 asked for and the part the
 * code can honestly answer today.
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
  /**
   * The class whose jaar/fase the search is scoped to, or `""` when no class is selected.
   *
   * **Empty is a real state, not a missing prop.** Thema's and themadoelen are school-wide (Art. IX.2), so a teacher may
   * legitimately be linking here with no class chosen. Then there is nothing to scope by, the search is unscoped, and
   * no control is offered -- a switch between "the whole curriculum" and "the whole curriculum" would be a control that
   * does nothing (the E3-06 rule).
   */
  klasId: string;
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

export function Doelkiezer({ waaraan, klasId, gekoppeldeCodes, onKoppel, bezig }: DoelkiezerProps) {
  const [zoek, setZoek] = useState("");
  /**
   * Whether the teacher has asked to widen past their own class.
   *
   * Component state rather than the URL, unlike the register's filters (ADR-0021). The picker itself is transient -- it
   * opens inside a form and closes on save -- so there is nothing shareable to link to, and writing a scope into the
   * URL would collide with the register's own `?jaarFase=` on any screen that had both.
   */
  const [heelCurriculum, setHeelCurriculum] = useState(false);
  // Keyed on the instance, not on `waaraan`: two cards' subdoel pickers are both "aan dit subthema", so a
  // level-derived id collided exactly where two pickers can be open (antagonist round 2, MAJOR 1).
  const veldId = useId();
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
  const klas = useKlas(klasId);

  /**
   * The codes the search is scoped to, or `undefined` for the whole curriculum.
   *
   * **Three ways to end up unscoped, and they are three different facts:** no class is selected, the teacher pressed
   * *Heel curriculum*, or the class's set could not be derived. Only the third needs its own sentence, because it is the
   * one the teacher did not ask for.
   *
   * **`?? []` rather than trusting the field to exist.** `apiFetch` casts the body, it does not validate it, so a
   * payload without `jaarFasen` would otherwise throw on `.length` and take the whole form down with it. That exact
   * defect was found on the kalender's own dekking read (antagonist round 2, MAJOR) and the shape of the fix is copied
   * from it: a screen whose worst case is a wider search must not have a worst case of a missing screen.
   */
  const eigenFasen = klas.data?.jaarFasen ?? [];
  const kanScopen = eigenFasen.length > 0;
  /*
    `!kanScopen` here is **belt and braces, and a mutation check proved it** rather than my reading it.

    Dropping it passes an empty array as the scope, and every test still goes green: `buildParams` appends nothing for an
    empty list, so the request is unscoped either way, and the sentence below branches on `kanScopen` independently. So
    this clause does not carry the widen-on-empty rule on its own -- `buildParams` does, and the endpoint's own
    "empty means no filter" is the third layer.

    It is kept for the one thing it does carry: **cache identity**. Without it the key holds `[]` for a class whose set
    could not be derived and `null` for a class with no selection, which are two entries for one identical unscoped
    search. Recorded because a reader who finds three guards for one rule deserves to know which one is load-bearing.
  */
  const gescopedeFasen = heelCurriculum || !kanScopen ? undefined : eigenFasen;

  const resultaat = useQuery({
    // The scope is part of the key, not a filter over one cached answer: two scopes are two different result sets, and
    // caching them together would show a teacher L3's hits under a whole-curriculum total. Same reasoning as
    // `useDekking`'s key, and the same mistake is available here.
    queryKey: ["doelkiezer", genormaliseerd, gescopedeFasen ?? null],
    queryFn: () => haalDoelen({ zoek: genormaliseerd, jaarFase: gescopedeFasen }, 0),
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

      {/*
        THE SCOPE CONTROL (E9-07). Offered only when there is something to switch BETWEEN: with no class selected, or
        with a class whose codes could not be derived, both positions would search the whole curriculum and the control
        would do nothing (the E3-06 rule).

        A two-button group with `aria-pressed`, matching the shape of `Bereikschakelaar` and `Jaarfasekiezer` on
        `/dekking` so the vocabulary a teacher learns on one screen holds on the other. State on `aria-pressed` and on
        weight, never on colour alone (Art. XII).
      */}
      {kanScopen && (
        <div
          role="group"
          aria-label={t("themabeheer.doelBereikLabel")}
          className="mt-2 flex flex-wrap items-center gap-1.5"
        >
          <span className="text-xs font-medium text-ink-zacht">{t("themabeheer.doelBereikLabel")}</span>
          {[false, true].map((alles) => (
            <button
              key={String(alles)}
              type="button"
              aria-pressed={heelCurriculum === alles}
              onClick={() => setHeelCurriculum(alles)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                heelCurriculum === alles
                  ? "border-petrol bg-petrol-wash font-semibold text-ink"
                  : // `border-input`, not `border-border`, and this came out of the browser pass rather than a review.
                    // `border-border` measures **1.33:1** against the card, so the unpressed option had no perceivable
                    // boundary: its text was legible at 6.08 but it did not read as a control a teacher could press.
                    // `--input` was re-tokened to 3.40:1 by E7-10 for exactly this reason, and this is the same defect
                    // one component over. SC 1.4.11 asks 3:1 for the visual information that identifies a component.
                    "border-input text-ink-zacht hover:text-ink"
              }`}
            >
              {t(alles ? "themabeheer.doelBereikAlles" : "themabeheer.doelBereikEigen")}
            </button>
          ))}
        </div>
      )}

      {/*
        WHICH SCOPE WAS APPLIED, said rather than left to be inferred from the results. A picker that quietly narrowed
        would make a teacher who knows a goal exists doubt the import instead of the filter.

        Held back until the class answer is in, so it cannot claim a scope while the request that decides it is still in
        flight -- the E5-03 rule: a conditional sentence may assert only what its own render condition guarantees. The
        third branch fires only for a class that HAS an answer and whose answer is empty, which is why it can say "geen
        jaar of fase bekend" rather than "not loaded yet".
      */}
      {klasId && klas.data && (
        <p className="mt-2 text-xs text-ink-zacht">
          {!kanScopen
            ? t("themabeheer.doelBereikOnbekend")
            : gescopedeFasen
              ? t("themabeheer.doelBereikGemeten", { fasen: gescopedeFasen.join(", ") })
              : t("themabeheer.doelBereikGemetenAlles")}
        </p>
      )}

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
                      // While the visible text is "Bezig met koppelen", the label is dropped so the
                      // accessible name IS the visible text (SC 2.5.3). Same treatment as the "Annuleren"
                      // toggles; keeping the idle label here would break Label in Name for every row at once,
                      // because `bezig` is one flag for the whole list (antagonist round 3).
                      aria-label={
                        bezig ? undefined : t("themabeheer.doelKoppelAria", { code: doel.code, waaraan })
                      }
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
