import { useId, useState } from "react";
import { IcoonChevron } from "../../components/Iconen";
import { t, telWoord, type Vertaalsleutel } from "../../i18n";
import { cn } from "../../lib/cn";
import { datumVanTijdstip } from "../../lib/datum";
import { Beperkt, Telling } from "./Meldingen";
import { getal, veldLabel } from "./opmaak";
import type {
  DoelsetTelling,
  LeerplandoelImportAntwoord,
  MinimumdoelImportAntwoord,
  OpstapHerimportDiff,
  VeldWijziging,
} from "./types";

/**
 * The two review reports of the Op.stap import from KOV's API (FR-2.5, E1-22): one for the decreed minimumdoelen, one for
 * the leerplandoelen. Each renders a preview and an apply alike, because the screen shows the apply's OWN report once it
 * returns (decide-and-record (b)): a preview and an apply are two reads of KOV, and only the second says what was written.
 *
 * **Counts, not codes.** A first import lists all 5,835 codes in `toegevoegd`. Nobody reads that list, and rendering it
 * would bury the few lines that do need reading (a goal still linked by school content, a renumbered one). So additions
 * are a number; only what a person should look at is listed, and every list is capped with an honest tail (`Beperkt`).
 *
 * **What is never shown:** `problemen[].reden`. It is English and for the operator (E1-21 antagonist round 1, QUESTION 3).
 * Admin gets the count and who to tell; the Dutch consequence for a stored goal comes from the server in `opmerkingen`.
 *
 * **Server Dutch is rendered as given** (`opmerkingen`, Art. II.3 as ratified 2026-07-30): it names the discipline or the
 * count itself, and a paraphrase here would drift from it.
 */

/** Whether the report in front of the reader was written to the database. Text, never colour alone. */
export function Doorvoerstatus({ toegepast }: { toegepast: boolean }) {
  return (
    <span className={cn("shrink-0 text-meta", toegepast ? "font-medium text-inkt" : "text-inkt-zacht")}>
      {toegepast ? t("importeren.kov.doorgevoerd") : t("importeren.kov.nietDoorgevoerd")}
    </span>
  );
}

export function MinimumdoelenRapport({ antwoord }: { antwoord: MinimumdoelImportAntwoord }) {
  const { diff } = antwoord;

  return (
    <div className="flex flex-col gap-4">
      {/* A skipped read has nothing to count; the server's notice below says why. */}
      {diff.overgeslagen ? null : diff.isLeeg ? (
        <p className="text-body text-inkt-zacht">{t("importeren.kov.mdNiets")}</p>
      ) : (
        <Tellingen
          items={[
            { label: t("importeren.nieuw"), aantal: diff.toegevoegd.length },
            { label: t("importeren.gewijzigd"), aantal: diff.gewijzigd.length },
            { label: t("importeren.ongewijzigd"), aantal: diff.ongewijzigd.length, stil: true },
            { label: t("importeren.opstap.verdwenen"), aantal: diff.verdwenen.length },
            ...(diff.teruggekeerd.length > 0 ? [{ label: t("importeren.kov.terug"), aantal: diff.teruggekeerd.length }] : []),
            ...(diff.nietIngelezen.length > 0
              ? [{ label: t("importeren.kov.nietGelezen"), aantal: diff.nietIngelezen.length }]
              : []),
          ]}
        />
      )}

      {diff.gewijzigd.length > 0 ? (
        <Wijzigingen
          titel={t("importeren.kov.gewijzigdeMinimumdoelen")}
          items={diff.gewijzigd.map((w) => ({ code: w.ref, velden: w.velden }))}
        />
      ) : null}

      <Meldingen groepen={diff.opmerkingen.length > 0 ? [{ sleutel: "md", regels: diff.opmerkingen }] : []} />

      <Probleemtelling
        aantal={antwoord.problemen.length}
        een="importeren.kov.problemenMdEen"
        meer="importeren.kov.problemenMdMeer"
      />
    </div>
  );
}

export function LeerplandoelenRapport({ antwoord }: { antwoord: LeerplandoelImportAntwoord }) {
  const { disciplines } = antwoord;
  const som = (tel: (diff: OpstapHerimportDiff) => number) => disciplines.reduce((totaal, d) => totaal + tel(d.diff), 0);

  const allesLeeg = disciplines.every((d) => d.diff.isLeeg);
  const nietGelezen = som((d) => d.nietIngelezen.length);
  const terug = som((d) => d.teruggekeerd.length);
  // A version other than the last applied one (a first apply included) is recorded by the apply even when no curriculum
  // row changes, so that one case gets its own sentence instead of a Doorvoeren beside "Er verandert niets" with no
  // explanation. Mirrors the server's rule (antagonist round 2, MINOR 2).
  const alleenVersie =
    !antwoord.toegepast &&
    (antwoord.vorigeVersie === null ||
      antwoord.vorigeVersie.versie !== antwoord.versie ||
      antwoord.vorigeVersie.hash !== antwoord.hash) &&
    !disciplines.some((d) => d.diff.schrijftIets);
  const hernummerd = disciplines.flatMap((d) => d.diff.hernummerd);
  const gewijzigd = disciplines.flatMap((d) => d.diff.gewijzigd);
  const gekoppeld = disciplines.flatMap((d) => d.diff.verdwenenMaarGekoppeld);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-meta text-inkt-zacht">
        {antwoord.snapshotTijdstip
          ? t("importeren.kov.versieGepubliceerd", {
              versie: antwoord.versie,
              datum: datumVanTijdstip(antwoord.snapshotTijdstip),
            })
          : t("importeren.kov.versie", { versie: antwoord.versie })}
      </p>

      {allesLeeg ? (
        <p className="text-body text-inkt-zacht">{t("importeren.kov.lpNiets")}</p>
      ) : (
        <>
          <Tellingen
            items={[
              { label: t("importeren.nieuw"), aantal: som((d) => d.toegevoegd.length) },
              { label: t("importeren.gewijzigd"), aantal: som((d) => d.gewijzigd.length) },
              { label: t("importeren.ongewijzigd"), aantal: som((d) => d.ongewijzigd.length), stil: true },
              {
                label: t("importeren.opstap.verdwenen"),
                aantal: som((d) => d.verdwenen.length + d.verdwenenMaarGekoppeld.length),
              },
              ...(hernummerd.length > 0 ? [{ label: t("importeren.kov.nieuweCode"), aantal: hernummerd.length }] : []),
              ...(terug > 0 ? [{ label: t("importeren.kov.terug"), aantal: terug }] : []),
              ...(nietGelezen > 0 ? [{ label: t("importeren.kov.nietGelezen"), aantal: nietGelezen }] : []),
            ]}
          />
          <Disciplinetabel antwoord={antwoord} />
        </>
      )}

      {alleenVersie ? (
        <p className="text-body text-inkt-zacht">{t("importeren.kov.versieVastleggen", { versie: antwoord.versie })}</p>
      ) : null}

      {antwoord.aantalRedenenGewijzigd > 0 ? (
        <p className="text-meta text-inkt-zacht">
          {antwoord.aantalRedenenGewijzigd === 1
            ? t("importeren.kov.redenenEen")
            : t("importeren.kov.redenenMeer", { aantal: getal(antwoord.aantalRedenenGewijzigd) })}
        </p>
      ) : null}

      {/* Kept, never deleted, and the sentence says so: this lists what stays put. */}
      {gekoppeld.length > 0 ? (
        <div className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
          <p className="text-meta font-medium text-attentie-inkt">
            {telWoord(gekoppeld.length, "importeren.kov.verdwenenGekoppeldEen", "importeren.kov.verdwenenGekoppeldMeer")}
          </p>
          <div className="mt-2">
            <Beperkt
              items={gekoppeld}
              hoeveel={8}
              render={(doel) => (
                <li key={doel.code} className="flex flex-wrap items-baseline gap-x-2 text-meta text-attentie-inkt">
                  <span className="mono shrink-0 font-medium">{doel.code}</span>
                  <span>{t("importeren.opstap.koppelingen", { aantal: doel.aantalKoppelingen })}</span>
                </li>
              )}
            />
          </div>
        </div>
      ) : null}

      {hernummerd.length > 0 ? (
        <div>
          <h3 className="text-micro uppercase text-inkt-zwak">{t("importeren.kov.nieuweCodes")}</h3>
          <div className="mt-2">
            <Beperkt
              items={hernummerd}
              hoeveel={8}
              render={(doel) => (
                <li key={doel.oudeCode} className="mono text-meta text-inkt">
                  {t("importeren.kov.heetNu", { oud: doel.oudeCode, nieuw: doel.nieuweCode })}
                </li>
              )}
            />
          </div>
        </div>
      ) : null}

      {gewijzigd.length > 0 ? (
        <Wijzigingen titel={t("importeren.kov.gewijzigdeLeerplandoelen")} items={gewijzigd} />
      ) : null}

      <Meldingen
        groepen={disciplines
          .filter((d) => d.diff.opmerkingen.length > 0)
          .map((d) => ({ sleutel: d.disciplineNummer, kop: d.disciplineNaam, regels: d.diff.opmerkingen }))}
      />

      <Doelsets doelsets={antwoord.overgeslagenDoelsets} />

      <Probleemtelling
        aantal={antwoord.problemen.length}
        een="importeren.kov.problemenLpEen"
        meer="importeren.kov.problemenLpMeer"
      />

      {/* A null changelog renders nothing and gives no reason: its two causes are indistinguishable here (contract). */}
      {antwoord.wijzigingslog ? <Wijzigingslog versie={antwoord.versie} tekst={antwoord.wijzigingslog} /> : null}
    </div>
  );
}

function Tellingen({ items }: { items: { label: string; aantal: number; stil?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-veld bg-vlak-diep/60 px-3 py-2.5">
      {items.map((item) => (
        <Telling key={item.label} label={item.label} aantal={item.aantal} stil={item.stil} />
      ))}
    </div>
  );
}

/**
 * One row per discipline, four numbers each: the data this report exists for, set as a real table because it is one.
 * The discipline number leads in the mono face so an admin reader can find "9.2" without reading thirteen names.
 *
 * Capped in width. At 1440 a full-width table put the last column 1,100 pixels from the name it belongs to, and a row
 * that long is read by guessing which line the eye is on (seen in the browser pass, not by any test).
 */
function Disciplinetabel({ antwoord }: { antwoord: LeerplandoelImportAntwoord }) {
  const kop = "px-1 pb-1.5 text-right text-micro uppercase text-inkt-zwak sm:px-2";
  return (
    <table className="w-full max-w-2xl border-collapse text-meta">
      <thead>
        <tr className="border-b border-lijn">
          <th scope="col" className="pb-1.5 pr-2 text-left text-micro uppercase text-inkt-zwak">
            {t("importeren.kov.discipline")}
          </th>
          <th scope="col" className={kop}>
            {t("importeren.nieuw")}
          </th>
          <th scope="col" className={kop}>
            {t("importeren.gewijzigd")}
          </th>
          <th scope="col" className={kop}>
            {t("importeren.ongewijzigd")}
          </th>
          <th scope="col" className={cn(kop, "pr-0 sm:pr-0")}>
            {t("importeren.opstap.verdwenen")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-lijn">
        {antwoord.disciplines.map(({ disciplineNummer, disciplineNaam, diff }) => (
          <tr key={disciplineNummer}>
            <th scope="row" className="py-2 pr-2 text-left align-top font-normal text-inkt">
              <span className="mono mr-1.5 text-inkt-zwak">{disciplineNummer}</span>
              {disciplineNaam}
            </th>
            {diff.overgeslagen ? (
              <td colSpan={4} className="py-2 text-right align-top text-inkt-zacht">
                {t("importeren.kov.overgeslagen")}
              </td>
            ) : (
              <>
                <Getalcel aantal={diff.toegevoegd.length} />
                <Getalcel aantal={diff.gewijzigd.length} />
                <Getalcel aantal={diff.ongewijzigd.length} stil />
                <Getalcel aantal={diff.verdwenen.length + diff.verdwenenMaarGekoppeld.length} laatste />
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Getalcel({ aantal, stil, laatste }: { aantal: number; stil?: boolean; laatste?: boolean }) {
  return (
    <td
      className={cn(
        "mono py-2 pl-1 text-right align-top tabular-nums sm:px-2",
        laatste && "sm:pr-0",
        stil || aantal === 0 ? "text-inkt-zwak" : "text-inkt",
      )}
    >
      {getal(aantal)}
    </td>
  );
}

/** Changed goals with the fields that moved. Field names are the model's own identifiers, shown as such. */
function Wijzigingen({ titel, items }: { titel: string; items: { code: string; velden: VeldWijziging[] }[] }) {
  return (
    <div>
      <h3 className="text-micro uppercase text-inkt-zwak">{titel}</h3>
      <div className="mt-2">
        <Beperkt
          items={items}
          hoeveel={8}
          render={(wijziging) => (
            <li key={wijziging.code} className="flex flex-wrap items-baseline gap-x-2 text-meta">
              <span className="mono shrink-0 font-medium text-inkt">{wijziging.code}</span>
              <span className="min-w-0 text-inkt-zacht">{wijziging.velden.map((veld) => veldLabel(veld.veld)).join(", ")}</span>
            </li>
          )}
        />
      </div>
    </div>
  );
}

/**
 * The server's Dutch notices, grouped under the discipline they came from. Some already name it and some do not
 * ("3 leerplandoelen staan nog in de Op.stap-bron maar werden niet ingelezen"), so the heading is what makes the second
 * kind findable.
 */
function Meldingen({ groepen }: { groepen: { sleutel: string; kop?: string; regels: string[] }[] }) {
  if (groepen.length === 0) return null;
  return (
    <div className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
      <p className="text-meta font-medium text-attentie-inkt">{t("importeren.kov.meldingen")}</p>
      <ul className="mt-1.5 flex flex-col gap-2">
        {groepen.map((groep) => (
          <li key={groep.sleutel} className="text-meta text-attentie-inkt">
            {groep.kop ? <p className="font-medium">{groep.kop}</p> : null}
            <ul className="flex flex-col gap-0.5">
              {groep.regels.map((regel, i) => (
                <li key={`${i}-${regel}`}>{regel}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** KOV's goal-set marks, named. An unknown mark is shown as KOV writes it rather than guessed at. */
const DOELSET_NAAM: Record<string, Vertaalsleutel> = {
  P: "importeren.kov.doelsetP",
  S: "importeren.kov.doelsetS",
  "+": "importeren.kov.doelsetPlus",
  A: "importeren.kov.doelsetA",
  Z: "importeren.kov.doelsetZ",
  V: "importeren.kov.doelsetV",
};

function Doelsets({ doelsets }: { doelsets: DoelsetTelling[] }) {
  if (doelsets.length === 0) return null;
  return (
    <div>
      <h3 className="text-micro uppercase text-inkt-zwak">{t("importeren.kov.doelsets")}</h3>
      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
        {doelsets.map((set) => {
          const naam = DOELSET_NAAM[set.doelset];
          return (
            <li key={set.doelset} className="flex items-baseline gap-1.5 text-meta">
              <span className="mono text-inkt-zwak">{set.doelset}</span>
              {naam ? <span className="text-inkt-zacht">{t(naam)}</span> : null}
              <span className="mono text-inkt">{getal(set.aantal)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * How many source goals were not imported, and who can do something about it. Decide-and-record (a): admin gets this
 * Dutch count on top of the server's `nietIngelezen` notice, because "N doelen konden niet ingelezen worden" is something
 * they can act on (tell the operator) even when no stored goal is affected. The English reasons stay with the operator.
 */
function Probleemtelling({ aantal, een, meer }: { aantal: number; een: Vertaalsleutel; meer: Vertaalsleutel }) {
  if (aantal === 0) return null;
  return (
    <div className="rounded-veld border border-lijn bg-vlak-diep/60 p-3">
      <p className="text-meta font-medium text-inkt">{telWoord(aantal, een, meer)}</p>
      <p className="mt-0.5 text-meta text-inkt-zacht">{t("importeren.kov.problemenMelden")}</p>
    </div>
  );
}

/**
 * KOV's own changelog for the version, collapsed: about 220 kB of text for 1.2, which is worth having one click away and
 * not worth scrolling past. Mounted only when opened, so the report does not carry it in the DOM for nothing. The
 * region is focusable because it scrolls, and a keyboard user must be able to scroll it.
 */
function Wijzigingslog({ versie, tekst }: { versie: string; tekst: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const label = t("importeren.kov.wijzigingslog", { versie });

  return (
    <div className="border-t border-lijn pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-raak w-full items-center justify-between gap-3 text-left text-meta font-medium text-inkt transition-colors duration-150 hover:text-inkt-zacht"
      >
        <span>{label}</span>
        <IcoonChevron
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 text-inkt-zwak transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          id={id}
          role="region"
          aria-label={label}
          tabIndex={0}
          className="mt-1 max-h-96 overflow-y-auto whitespace-pre-line rounded-veld border border-lijn bg-vlak/70 p-3 text-meta text-inkt"
        >
          {tekst}
        </div>
      ) : null}
    </div>
  );
}
