import { Link, useLocation, useParams } from "react-router-dom";

import { Badge } from "../../components/ui/badge";
import { DoelsoortBadge } from "../../components/DoelsoortBadge";
import { doelsoortBadgeSoort } from "../../components/doelsoort";
import { t, tAantal, type TranslationKey } from "../../i18n";
import { ApiError } from "../../lib/api";
import { useDoelDetail } from "./useDoelen";
import type { DoelDetail as Doel, DoelKoppelingWeergave, KoppelingHerkomst } from "./types";

/** The catalogue key per link layer, so the herkomst reads as Dutch and not as an enum name. */
const HERKOMST_LABEL: Record<KoppelingHerkomst, TranslationKey> = {
  Themadoel: "doelen.herkomstThemadoel",
  Doelsuggestie: "doelen.herkomstDoelsuggestie",
  Subdoel: "doelen.herkomstSubdoel",
  Activiteit: "doelen.herkomstActiviteit",
};

/**
 * One doel, read in full (E1-16 clause 3). Its own nested route (`/doelen/:code`), so it is deep-linkable and
 * the browser Back button works (ADR-0021).
 *
 * **Read-only, visibly** (Art. III.1, clause 4): there is not one control here that changes anything. The
 * only interactive elements are the "terug naar de lijst" link, which exists because at ~390px this pane
 * *replaces* the list and a teacher needs a way back that is not the browser chrome.
 *
 * **A field that is empty is absent, not blank.** Op.stap leaves columns empty, and a "Toelichting" heading
 * with nothing under it tells a teacher the tool lost something.
 *
 * **No "Minimumdoelen" destination.** §3's information architecture promises minimumdoelen too, and no
 * `Minimumdoel` row can exist until **E1-12** imports the decreed source (it is blocked on a file from
 * directie). So the concordance is shown here with an honest line, and no tab, screen or button is built
 * that would render nothing.
 */
export function Doeldetail() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const { data, isLoading, isError, error } = useDoelDetail(code);

  const terug = (
    <Link
      to={{ pathname: "/doelen", search: location.search }}
      className="inline-flex items-center gap-1 text-sm font-semibold text-petrol underline decoration-border underline-offset-2 lg:hidden"
    >
      {t("doelen.terugNaarLijst")}
    </Link>
  );

  if (isLoading) {
    return (
      <Paneel>
        {terug}
        <p role="status" className="text-sm text-ink-zacht">
          {t("doelen.detailLaden")}
        </p>
      </Paneel>
    );
  }

  // The third empty state (E1-16): a deep link to a code that does not exist. A 404 is a specific, honest
  // answer and must not be shown as a generic load failure, nor as an empty pane.
  if (isError && error instanceof ApiError && error.status === 404) {
    return (
      <Paneel>
        {terug}
        <h3 className="text-base font-bold text-ink">{t("doelen.onbekendTitel")}</h3>
        <p className="text-sm leading-relaxed text-ink-zacht">
          {t("doelen.onbekendUitleg", { code: code ?? "" })}
        </p>
      </Paneel>
    );
  }

  if (isError || !data) {
    return (
      <Paneel>
        {terug}
        <p
          role="alert"
          className="rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
        >
          {t("doelen.detailFout")}
        </p>
      </Paneel>
    );
  }

  return (
    <Paneel>
      {terug}
      <Kop doel={data} />

      {data.nietMeerInOpstap ? <Herzieningsvlag /> : null}

      <p className="text-[0.9375rem] leading-relaxed text-ink">{data.tekst}</p>

      <Plaats doel={data} />

      {/* Its own field, not a fourth level on the taxonomy line: `cluster` lives in the goal Excel and not in
          the ordeningskader (Art. VII.0). Absent when Op.stap left the column empty. */}
      <Veld labelKey="doelen.clusterLabel" waarde={data.cluster} />

      <Veld
        labelKey="doelen.voorbeeldenLabel"
        waarde={data.voorbeelden}
        uitlegKey="doelen.voorbeeldenUitleg"
      />
      <Veld labelKey="doelen.toelichtingLabel" waarde={data.toelichting} />
      <Veld
        labelKey="doelen.woordenschatLabel"
        waarde={data.woordenschat}
        uitlegKey="doelen.woordenschatUitleg"
      />

      <Concordantie doel={data} />
      <Koppelingen koppelingen={data.koppelingen} />
    </Paneel>
  );
}

function Paneel({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label={t("doelen.detailLabel")}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5"
    >
      {children}
    </section>
  );
}

/** The code, the doelsoort with its full Dutch label, and the jaar/fase. */
function Kop({ doel }: { doel: Doel }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h3 className="font-mono text-base font-semibold text-ink" data-cijfers>
        {doel.code}
      </h3>
      <DoelsoortBadge doelsoort={doelsoortBadgeSoort[doel.doelsoort]} />
      {/* The abbreviation on the badge is not enough on a detail: the full label is spelled out, because
          "P" means nothing to a teacher who has not memorised the six Op.stap doelsoorten. */}
      <span className="text-sm text-ink-zacht">{t(`doelsoort.${doelsoortBadgeSoort[doel.doelsoort]}`)}</span>
      <span className="text-sm text-ink-zacht">
        {t("doelen.jaarFaseLabel")}: {doel.jaarFase}
      </span>
    </div>
  );
}

/**
 * The review flag, in the attention language (Art. III.4 / IV.2): this doel disappeared from Op.stap while
 * school content still links to it. It is the tool's own signal, not decreed content, which is why it reads
 * as something to look at rather than as an error.
 */
function Herzieningsvlag() {
  return (
    <div className="rounded-md border border-attentie/30 bg-attentie-zacht px-3.5 py-3">
      <p className="text-sm font-semibold text-attentie-ink">{t("doelen.vervallenTitel")}</p>
      <p className="mt-1 text-sm leading-relaxed text-attentie-ink">{t("doelen.vervallenUitleg")}</p>
    </div>
  );
}

/**
 * Where the doel sits in Op.stap: `discipline · domein · subdomein`, and **only** those three.
 *
 * That is the entire ordeningskader (Art. VII.0), and the article's first rule is that Op.stap exposes *two
 * distinct structures* which must not be conflated. `cluster` belongs to the per-discipline goal Excel, not to
 * the ordeningskader, so appending it to this chain rendered it as a fourth taxonomy level directly under a
 * docstring saying it is not one (antagonist finding 7). It now gets its own labelled field, which is also how
 * a reader can tell that a doel without one is not missing a level.
 */
function Plaats({ doel }: { doel: Doel }) {
  const delen = [doel.disciplineNaam ?? doel.disciplineNummer, doel.domein, doel.subdomein];

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
        {t("doelen.plaatsLabel")}
      </h4>
      <p className="mt-1 text-sm text-ink">{delen.join(" · ")}</p>
    </div>
  );
}

/** One optional Op.stap field. Renders nothing at all when the source left the column empty. */
function Veld({
  labelKey,
  waarde,
  uitlegKey,
}: {
  labelKey: TranslationKey;
  waarde: string | null;
  uitlegKey?: TranslationKey;
}) {
  if (!waarde) {
    return null;
  }

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">{t(labelKey)}</h4>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">{waarde}</p>
      {uitlegKey ? <p className="mt-1 text-xs text-ink-zacht">{t(uitlegKey)}</p> : null}
    </div>
  );
}

/**
 * The concordance to a decreed minimumdoel, in three honest states.
 *
 * The middle one is why this component exists: a doel can carry a concordance *key* while the decreed
 * omschrijving is not loaded, because the per-discipline goal Excel has no omschrijving column (Art. VII.1)
 * and the separate decreed import is **E1-12**, blocked on a source file from directie. Saying "geen
 * minimumdoel" there would be false, and showing an empty section would look like a bug.
 */
function Concordantie({ doel }: { doel: Doel }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
        {t("doelen.minimumdoelLabel")}
      </h4>

      {doel.minimumdoelRef === null ? (
        <p className="mt-1 text-sm text-ink-zacht">{t("doelen.minimumdoelGeen")}</p>
      ) : (
        <div className="mt-1">
          <p className="text-sm text-ink" data-cijfers>
            {t("doelen.minimumdoelRef", { ref: doel.minimumdoelRef })}
          </p>
          {doel.minimumdoel ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-ink">{doel.minimumdoel.omschrijving}</p>
              <p className="mt-1 text-xs text-ink-zacht">
                {t("doelen.minimumdoelLeeftijd", {
                  leeftijd: doel.minimumdoel.leeftijd,
                  nr: doel.minimumdoel.nr,
                })}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-ink-zacht">
              {t("doelen.minimumdoelNietIngeladen")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Where this doel occurs in the school's own content, and what the teacher decided about each occurrence
 * (Art. IV.2).
 *
 * **The heading asks a neutral question on purpose.** It read "Gebruikt in thema's" over a list that includes
 * `Voorgesteld` and `Geweigerd` links, which counts an open AI suggestion and an explicitly *rejected* one as
 * usage and nudges a teacher toward a coverage conclusion Art. V.1 does not support: only `aanvaard` and
 * `manueel` make a leerplandoel gedekt (antagonist finding 8). Listing every status is right, because the
 * question is "where does this appear?"; calling it usage was not.
 *
 * **Each row states its scope.** A subdoel or activiteit belongs to one klas (Art. IX.2), so it names that
 * klas; the school-wide layers say so instead. Without that, one class's planning reads as a school-wide fact.
 */
function Koppelingen({ koppelingen }: { koppelingen: DoelKoppelingWeergave[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
        {t("doelen.koppelingenLabel")}
      </h4>

      {koppelingen.length === 0 ? (
        <p className="mt-1 text-sm text-ink-zacht">{t("doelen.koppelingenGeen")}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-zacht" data-cijfers>
            {tAantal(
              koppelingen.length,
              "doelen.koppelingenAantalEnkelvoud",
              "doelen.koppelingenAantal",
            )}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {koppelingen.map((koppeling, index) => (
              <li
                // Two links of the same herkomst can point from the same thema at the same doel (a thema may
                // hold both a themadoel and a suggestion), so the index is part of the key by necessity: the
                // list is server-ordered and never reordered here.
                key={`${koppeling.herkomst}-${koppeling.themaNaam}-${koppeling.onderdeel ?? ""}-${koppeling.klasNaam ?? ""}-${index}`}
                // Two columns rather than one wrapping row. The row WAS a single `flex-wrap` with the badge on
                // `ml-auto`, and adding the scope label pushed the content past one line, so the badge dropped
                // onto a second line on its own and the list read as ragged. Found by looking at it, not by a
                // test: the badge belongs at the end of the row it describes.
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-ink">{koppeling.themaNaam}</span>
                  {koppeling.onderdeel ? (
                    <span className="text-sm text-ink-zacht">{koppeling.onderdeel}</span>
                  ) : null}
                  <span className="text-xs text-ink-zacht">{t(HERKOMST_LABEL[koppeling.herkomst])}</span>
                  {/* The scope, always stated. Keyed on the HERKOMST rather than on whether a klas name arrived:
                      a class-scoped link with no resolvable klas must not fall through to "hele school", which
                      would be exactly the false school-wide reading this label exists to prevent. */}
                  <span className="text-xs text-ink-zacht">{schaallabel(koppeling)}</span>
                </span>
                <Badge variant={statusVariant(koppeling.status)} className="shrink-0">
                  {t(`suggestieStatus.${statusVariant(koppeling.status)}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** The status token/catalogue key for a `KoppelingStatus` as the API names it (PascalCase on the wire). */
function statusVariant(status: DoelKoppelingWeergave["status"]) {
  return status.toLowerCase() as "voorgesteld" | "aanvaard" | "geweigerd" | "manueel";
}

/** Which link layers are school-wide (Art. IX.2). The other two belong to one klas and one leeftijd. */
const SCHOOLBREDE_HERKOMSTEN: ReadonlySet<KoppelingHerkomst> = new Set<KoppelingHerkomst>([
  "Themadoel",
  "Doelsuggestie",
]);

/**
 * The scope of one link, in words.
 *
 * Driven by the herkomst, because that is what *defines* the scope (Art. IX.2); the klas name only fills it in.
 * A class-scoped link whose klas could not be resolved therefore says "klas onbekend" rather than silently
 * reading as school-wide, which is the misreading this label exists to prevent.
 */
function schaallabel(koppeling: DoelKoppelingWeergave): string {
  if (SCHOOLBREDE_HERKOMSTEN.has(koppeling.herkomst)) {
    return t("doelen.koppelingSchoolbreed");
  }

  return koppeling.klasNaam
    ? t("doelen.koppelingKlas", { klas: koppeling.klasNaam })
    : t("doelen.koppelingKlasOnbekend");
}
