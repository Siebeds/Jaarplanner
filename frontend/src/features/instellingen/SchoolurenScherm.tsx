import { type FormEvent, useId, useState } from "react";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Knop } from "../../components/ui/Knop";
import { Invoer } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { ApiError } from "../../lib/api";
import { geenToegangZin, useRechten } from "../../lib/rechten";
import { t } from "../../i18n";
import { toonBereik } from "../plan/tijd";
import { type Schooldaguren, useBewaarSchooluren, useSchooluren } from "../schooluren/gegevens";
import {
  Dagnaam,
  type Dagvelden,
  type Veldfout,
  WEEKDAGEN,
  beginVelden,
  dagnaam,
  naarInvoer,
} from "../schooluren/schooluren";
import { Onderdeelwissel } from "./Instellingenindeling";

/**
 * Instellingen, Schooluren: when the school day begins and ends on each weekday, and when the middagpauze runs
 * (FB-023, ADR-0038).
 *
 * **Admin sets them; everyone else reads them.** The owner ruled on 2026-09-15 that the hours are one set for the
 * school, set by admin. For anyone else the same five days are a list without a single field, which is what the
 * matrix grants (ADR-0030 §3, "beheren", admin only) and what the server enforces on the PUT.
 *
 * **What they do is said once, above the days**, because it is what makes this more than a form that stores numbers:
 * the agenda opens at the start of the school day and shades the hours outside it.
 */
export function SchoolurenScherm() {
  const { data, isPending, isError } = useSchooluren();
  const { mag } = useRechten();

  return (
    <>
      <Schermkop titel={t("instellingen.schooluren")} smal onder={<Onderdeelwissel />} />

      <Schermvlak smal>
        <div className="flex flex-col gap-4">
          <p className="text-body text-inkt-zacht">{t("schooluren.uitleg")}</p>

          {isPending ? (
            <Laadlijst rijen={5} />
          ) : isError ? (
            <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {t("schooluren.laadFout")}
            </p>
          ) : mag.beheer ? (
            <Schoolurenformulier uren={data.dagen} />
          ) : (
            <Schoolurenlijst uren={data.dagen} />
          )}
        </div>
      </Schermvlak>
    </>
  );
}

/**
 * The five weekdays as admin fills them in, with one button for all of them: the server replaces the whole set, so
 * the form saves the whole set.
 *
 * Its state starts from what the school has and is not reset by its own save: the server's answer is what was sent,
 * so the fields already hold it, and a reset would take the "bewaard" line away the moment it appears.
 */
function Schoolurenformulier({ uren }: { uren: readonly Schooldaguren[] }) {
  const [velden, setVelden] = useState(() => beginVelden(uren));
  const [fout, setFout] = useState<Veldfout | null>(null);
  const bewaar = useBewaarSchooluren();

  const zet = (weekdag: number, wijziging: Partial<Dagvelden>) => {
    setVelden((huidig) => ({ ...huidig, [weekdag]: { ...huidig[weekdag], ...wijziging } }));
    setFout(null);
    bewaar.reset();
  };

  const verstuur = (e: FormEvent) => {
    e.preventDefault();
    const invoer = naarInvoer(velden);
    if ("fout" in invoer) {
      setFout(invoer.fout);
      return;
    }
    bewaar.mutate(invoer);
  };

  const serverReden =
    geenToegangZin(bewaar.error) ?? (bewaar.error instanceof ApiError ? bewaar.error.detail : undefined);

  return (
    <form onSubmit={verstuur} noValidate className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-lijn rounded-kaart border border-lijn bg-kaart">
        {WEEKDAGEN.map((weekdag) => (
          <li key={weekdag}>
            <Dagrij
              weekdag={weekdag}
              velden={velden[weekdag]}
              fout={fout?.weekdag === weekdag ? t(fout.sleutel, { dag: dagnaam(weekdag) }) : undefined}
              onZet={(wijziging) => zet(weekdag, wijziging)}
            />
          </li>
        ))}
      </ul>

      {/* The server's own sentence, which names the weekday it refused. */}
      {bewaar.isError ? (
        <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
          <p className="text-body font-medium text-attentie-inkt">{t("schooluren.bewaarMislukt")}</p>
          {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Knop rang="hoofd" type="submit" bezig={bewaar.isPending}>
          {t("schooluren.bewaar")}
        </Knop>
        <p role="status" className="text-meta text-inkt-zacht">
          {bewaar.isSuccess ? t("schooluren.bewaard") : ""}
        </p>
      </div>
    </form>
  );
}

/**
 * One weekday: its name, the school day, and the middagpauze behind a tick box.
 *
 * Stacked on a phone; from `md` the name and the two groups stand side by side, on one baseline, so five rows read as
 * a timetable. Every field is named by the day, its group and its edge ("Maandag Schooldag van"), because five rows of
 * identical visible labels would otherwise give a screen reader five fields called "van".
 */
function Dagrij({
  weekdag,
  velden,
  fout,
  onZet,
}: {
  weekdag: number;
  velden: Dagvelden;
  fout: string | undefined;
  onZet: (wijziging: Partial<Dagvelden>) => void;
}) {
  const id = useId();
  const dagId = `${id}-dag`;
  const schooldagId = `${id}-schooldag`;
  const pauzeId = `${id}-pauze`;
  const foutId = `${id}-fout`;

  return (
    <div
      role="group"
      aria-labelledby={dagId}
      aria-describedby={fout ? foutId : undefined}
      className="grid gap-3 p-4 md:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-4"
    >
      {/* The three heads of a row share one height, the tick box's, so from `md` the day, "Schooldag" and
          "Middagpauze" stand on one line and the two pairs of fields below them start level (seen at 1440). */}
      <p id={dagId} className="text-body font-medium text-inkt md:flex md:min-h-6 md:items-center">
        {Dagnaam(weekdag)}
      </p>

      <div className="flex flex-col gap-1.5">
        <p id={schooldagId} className="flex min-h-6 items-center text-meta font-medium text-inkt-zacht">
          {t("schooluren.schooldag")}
        </p>
        <Tijdpaar
          labels={`${dagId} ${schooldagId}`}
          van={velden.begin}
          tot={velden.einde}
          onVan={(begin) => onZet({ begin })}
          onTot={(einde) => onZet({ einde })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex min-h-6 cursor-pointer items-center gap-2 text-meta font-medium text-inkt-zacht">
          <input
            type="checkbox"
            checked={velden.pauze}
            onChange={(e) => onZet({ pauze: e.target.checked })}
            aria-labelledby={`${dagId} ${pauzeId}`}
            className="h-5 w-5 shrink-0 cursor-pointer accent-inkt"
          />
          <span id={pauzeId}>{t("schooluren.middagpauze")}</span>
        </label>
        {velden.pauze ? (
          <Tijdpaar
            labels={`${dagId} ${pauzeId}`}
            van={velden.pauzeBegin}
            tot={velden.pauzeEinde}
            onVan={(pauzeBegin) => onZet({ pauzeBegin })}
            onTot={(pauzeEinde) => onZet({ pauzeEinde })}
          />
        ) : null}
      </div>

      {fout ? (
        <p id={foutId} role="alert" className="text-meta font-medium text-attentie-inkt md:col-span-2 md:col-start-2">
          {fout}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Two time fields with a dash between them, the way a timetable writes a stretch. Five-minute steps, because a school
 * day starts at 8:25 as often as at 8:30.
 */
function Tijdpaar({
  labels,
  van,
  tot,
  onVan,
  onTot,
}: {
  /** The ids that name this pair: the day and the group. */
  labels: string;
  van: string;
  tot: string;
  onVan: (tijd: string) => void;
  onTot: (tijd: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex max-w-64 items-center gap-2">
      <span id={`${id}-van`} className="sr-only">
        {t("schooluren.van")}
      </span>
      <Invoer
        type="time"
        step={300}
        value={van}
        onChange={(e) => onVan(e.target.value)}
        aria-labelledby={`${labels} ${id}-van`}
        className="min-w-0 flex-1"
      />
      <span aria-hidden="true" className="text-inkt-zwak">
        –
      </span>
      <span id={`${id}-tot`} className="sr-only">
        {t("schooluren.tot")}
      </span>
      <Invoer
        type="time"
        step={300}
        value={tot}
        onChange={(e) => onTot(e.target.value)}
        aria-labelledby={`${labels} ${id}-tot`}
        className="min-w-0 flex-1"
      />
    </div>
  );
}

/** The same five days for someone who reads them: no field, no button. */
function Schoolurenlijst({ uren }: { uren: readonly Schooldaguren[] }) {
  return (
    <dl className="flex flex-col divide-y divide-lijn rounded-kaart border border-lijn bg-kaart">
      {WEEKDAGEN.map((weekdag) => {
        const dag = uren.find((d) => d.weekdag === weekdag);
        return (
          <div key={weekdag} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
            <dt className="text-body font-medium text-inkt sm:w-28 sm:shrink-0">{Dagnaam(weekdag)}</dt>
            <dd className="text-body text-inkt">
              {dag ? (
                <>
                  {toonBereik(dag.begin, dag.einde)}
                  <span className="block text-meta text-inkt-zacht">
                    {dag.middagpauzeBegin && dag.middagpauzeEinde
                      ? t("schooluren.pauzeLijst", { bereik: toonBereik(dag.middagpauzeBegin, dag.middagpauzeEinde) })
                      : t("schooluren.geenPauze")}
                  </span>
                </>
              ) : (
                <span className="text-inkt-zacht">{t("schooluren.nietIngesteld")}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
