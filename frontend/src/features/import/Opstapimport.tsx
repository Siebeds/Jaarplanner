import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IcoonChevron } from "../../components/Iconen";
import { Knop } from "../../components/ui/Knop";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { cn } from "../../lib/cn";
import { datumVanTijdstip } from "../../lib/datum";
import { t } from "../../i18n";
import { Foutvlak, Vak } from "./Meldingen";
import { Opstapbestand } from "./Opstapbestand";
import { Doorvoerstatus, LeerplandoelenRapport, MinimumdoelenRapport } from "./Opstaprapport";
import {
  importeerLeerplandoelen,
  importeerMinimumdoelen,
  useOpstapStand,
  voorbeeldLeerplandoelen,
  voorbeeldMinimumdoelen,
} from "./api";
import { getal } from "./opmaak";
import { RUST, schrijftLeerplandoelen, schrijftMinimumdoelen, voer, type Staat } from "./stappen";
import type { LeerplandoelImportAntwoord, MinimumdoelImportAntwoord } from "./types";

/**
 * The Op.stap tab of Inladen: importing the curriculum from KOV's API (FR-2.1, FR-2.5, ADR-0032; E1-22).
 *
 * **One flow, two steps, in the order the data demands.** *Op.stap ophalen* reads both sources and shows what an import
 * would change, writing nothing; *Doorvoeren* writes it. The minimumdoelen come first because every concorded
 * leerplandoel points at one through a Restrict FK, and the leerplandoelen preview answers 409 until they are in. So on
 * a first run the screen previews the minimumdoelen alone and says why the leerplandoelen wait; once those are through,
 * it fetches the leerplandoelen preview by itself and offers *Doorvoeren* again. Whether the minimumdoelen are in comes
 * from `GET /api/opstap-import/stand`, which reads our database: asking the leerplandoelen preview would cost a 13 MB
 * read of KOV and a 409 dressed as an error on exactly the path a first-time directie takes.
 *
 * **The apply's own report replaces the preview's** (decide-and-record (b)). Preview and apply are two reads of KOV. For
 * the leerplandoelen the apply sends back the version the preview named, so it writes that snapshot; the minimumdoelen
 * have no version, so what was written is whatever the second read said. Either way only the apply's answer is true
 * about what is now stored. While an apply runs, the preview stays on screen, because it is what is being written.
 *
 * **Errors are the server's Dutch** (`detail` of a 409 or 502, Art. II.3 as ratified 2026-07-30), shown under the step
 * they belong to. A refused leerplandoelen apply after a successful minimumdoelen apply leaves both on screen, which is
 * what happened.
 *
 * **The Excel upload** (`Opstapbestand`) is offered only while no leerplandoelen snapshot has been applied. After one,
 * the server refuses every file (Art. VII.2), so offering it would be a control that can only be refused (the E3-06
 * rule); one line says why it is gone instead, since a directie who used it will look for it.
 */
export function Opstapimport() {
  const queryClient = useQueryClient();
  const stand = useOpstapStand();

  const [md, setMd] = useState<Staat<MinimumdoelImportAntwoord>>(RUST);
  const [lp, setLp] = useState<Staat<LeerplandoelImportAntwoord>>(RUST);
  /** The leerplandoelen cannot be previewed yet: no minimumdoel is stored. */
  const [lpWacht, setLpWacht] = useState(false);
  const [bezig, setBezig] = useState<"ophalen" | "doorvoeren" | null>(null);
  const [excelOpen, setExcelOpen] = useState(false);

  async function ophalen() {
    if (!stand.data) return;
    const minimumdoelenIn = stand.data.aantalMinimumdoelen > 0;

    setBezig("ophalen");
    setLpWacht(!minimumdoelenIn);
    setMd({ antwoord: null, fout: null, laadt: true });
    setLp({ antwoord: null, fout: null, laadt: minimumdoelenIn });

    await Promise.all([
      voer(voorbeeldMinimumdoelen, setMd, null),
      minimumdoelenIn ? voer(voorbeeldLeerplandoelen, setLp, null) : Promise.resolve(null),
    ]);
    setBezig(null);
  }

  async function doorvoeren() {
    setBezig("doorvoeren");
    let minimumdoelenDoorgevoerd = false;

    if (md.antwoord && !md.antwoord.toegepast && schrijftMinimumdoelen(md.antwoord)) {
      const vorige = md.antwoord;
      setMd({ antwoord: vorige, fout: null, laadt: true });
      const uitkomst = await voer(importeerMinimumdoelen, setMd, vorige);
      if (!uitkomst) {
        // Nothing of the leerplandoelen is applied after a refused minimumdoelen step: it may be what they need.
        setBezig(null);
        return;
      }
      minimumdoelenDoorgevoerd = uitkomst.toegepast;
    }

    if (lp.antwoord && !lp.antwoord.toegepast && schrijftLeerplandoelen(lp.antwoord)) {
      const vorige = lp.antwoord;
      setLp({ antwoord: vorige, fout: null, laadt: true });
      await voer(() => importeerLeerplandoelen(vorige.versie), setLp, vorige);
    } else if (minimumdoelenDoorgevoerd && lp.antwoord === null) {
      // The leerplandoelen waited on these minimumdoelen, or their preview was refused for a minimumdoel that was not
      // stored yet. Now it can be read; it is shown as a preview and applied by a second press, never by this one.
      const nieuweStand = await stand.refetch();
      if ((nieuweStand.data?.aantalMinimumdoelen ?? 0) > 0) {
        setLpWacht(false);
        setLp({ antwoord: null, fout: null, laadt: true });
        await voer(voorbeeldLeerplandoelen, setLp, null);
      }
    }

    // A curriculum import moves what every screen reads: the register, the goal pickers, dekking. Refetching what is
    // mounted is cheaper than keeping a list of those keys in step with the rest of the app.
    await queryClient.invalidateQueries();
    setBezig(null);
  }

  const teSchrijven =
    (md.antwoord !== null && !md.antwoord.toegepast && schrijftMinimumdoelen(md.antwoord)) ||
    (lp.antwoord !== null && !lp.antwoord.toegepast && schrijftLeerplandoelen(lp.antwoord));

  return (
    <div className="flex flex-col gap-4">
      <Vak titel={t("importeren.kov.titel")}>
        {stand.isPending ? (
          <Laadvlak className="h-16" />
        ) : stand.isError ? (
          <div className="flex flex-col items-start gap-3">
            <Foutvlak titel={t("importeren.kov.standMislukt")} />
            <Knop onClick={() => void stand.refetch()}>{t("importeren.kov.opnieuw")}</Knop>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-meta">
              <dt className="text-inkt-zacht">{t("importeren.kov.minimumdoelen")}</dt>
              <dd className="text-inkt">
                {stand.data.aantalMinimumdoelen > 0
                  ? t("importeren.kov.ingeladen", { aantal: getal(stand.data.aantalMinimumdoelen) })
                  : t("importeren.kov.nogNietIngeladen")}
              </dd>
              <dt className="text-inkt-zacht">{t("importeren.kov.leerplandoelen")}</dt>
              <dd className="text-inkt">
                {stand.data.laatsteVersie
                  ? t("importeren.kov.versieDoorgevoerd", {
                      versie: stand.data.laatsteVersie.versie,
                      datum: datumVanTijdstip(stand.data.laatsteVersie.toegepastOp),
                    })
                  : t("importeren.kov.nogGeenVersie")}
              </dd>
            </dl>
            <div>
              {/* The accent is on the next step: on Doorvoeren while a report has something to write, on this button
                  otherwise (before any report, and after one that writes nothing). So the screen always has one
                  primary action and never two (ADR-0024; test-runner round 2 found the idle state without one). */}
              <Knop rang={teSchrijven ? "rustig" : "hoofd"} disabled={bezig !== null} onClick={() => void ophalen()}>
                {bezig === "ophalen" ? t("importeren.bezig") : t("importeren.kov.ophalen")}
              </Knop>
            </div>
          </div>
        )}
      </Vak>

      {md.antwoord || md.laadt || md.fout ? (
        <Stapvak titel={t("importeren.kov.minimumdoelen")} staat={md} schrijft={md.antwoord ? schrijftMinimumdoelen(md.antwoord) : false}>
          {md.antwoord ? <MinimumdoelenRapport antwoord={md.antwoord} /> : null}
        </Stapvak>
      ) : null}

      {lpWacht ? (
        <Vak titel={t("importeren.kov.leerplandoelen")}>
          <p className="text-body text-inkt-zacht">{t("importeren.kov.eerstMinimumdoelen")}</p>
        </Vak>
      ) : lp.antwoord || lp.laadt || lp.fout ? (
        <Stapvak titel={t("importeren.kov.leerplandoelen")} staat={lp} schrijft={lp.antwoord ? schrijftLeerplandoelen(lp.antwoord) : false}>
          {lp.antwoord ? <LeerplandoelenRapport antwoord={lp.antwoord} /> : null}
        </Stapvak>
      ) : null}

      {teSchrijven ? (
        <div>
          <Knop rang="hoofd" disabled={bezig !== null} onClick={() => void doorvoeren()}>
            {bezig === "doorvoeren" ? t("importeren.bezig") : t("importeren.kov.doorvoeren")}
          </Knop>
        </div>
      ) : null}

      <p role="status" className="sr-only">
        {bezig ? t("importeren.bezig") : ""}
      </p>

      {stand.data ? (
        stand.data.laatsteVersie === null ? (
          <div>
            <button
              type="button"
              aria-expanded={excelOpen}
              onClick={() => setExcelOpen((open) => !open)}
              className="flex min-h-raak items-center gap-2 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:text-inkt"
            >
              <IcoonChevron
                aria-hidden="true"
                className={cn("h-4 w-4 shrink-0 transition-transform duration-200", excelOpen && "rotate-180")}
              />
              {t("importeren.opstap.excelTonen")}
            </button>
            {excelOpen ? (
              <div className="mt-2">
                <Opstapbestand />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-meta text-inkt-zacht">{t("importeren.opstap.excelNietMeer")}</p>
        )
      ) : null}
    </div>
  );
}

/**
 * A section for one step: its report, a placeholder while the first answer is out, and the server's refusal under it.
 * The status names whether the report in view was written, so a reader can never mistake a preview for an import.
 *
 * **No status on a preview that writes nothing.** "Nog niet doorgevoerd" beside "Er verandert niets" is true and points
 * at an action that does not exist, since no Doorvoeren is offered for it; say less (seen in the browser pass).
 */
function Stapvak<T extends { toegepast: boolean }>({
  titel,
  staat,
  schrijft,
  children,
}: {
  titel: string;
  staat: Staat<T>;
  /** Whether applying the report in view would write anything. */
  schrijft: boolean;
  children: ReactNode;
}) {
  const status =
    staat.antwoord && (staat.antwoord.toegepast || schrijft) ? (
      <Doorvoerstatus toegepast={staat.antwoord.toegepast} />
    ) : null;
  return (
    <Vak titel={titel} merk={status}>
      <div className="flex flex-col gap-4">
        {staat.antwoord ? (
          children
        ) : staat.laadt ? (
          <div aria-hidden="true" className="flex flex-col gap-2">
            <Laadvlak className="h-14" />
            <Laadvlak className="h-24" />
          </div>
        ) : null}
        {staat.fout ? <Foutvlak titel={t("importeren.mislukt")} tekst={staat.fout} /> : null}
      </div>
    </Vak>
  );
}
