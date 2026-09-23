import { forwardRef, type KeyboardEvent, type MouseEvent } from "react";
import { useHref, useNavigate } from "react-router-dom";
import { IcoonKruis } from "../../components/Iconen";
import { Knop, Knoplink } from "../../components/ui/Knop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { useSelectie } from "../../state/selectie";
import { Aimerk, Beslisknoppen } from "../themas/Subdoelplaatsing";
import {
  useBeslisKatvoorstel,
  useSignaalGezien,
  useSignaalLater,
  type Deurmatsignaal,
  type Deurmatvoorstel,
} from "./gegevens";
import { Gesprek, Vraagveld } from "./Katchat";
import { useKatchat } from "./useKatchat";
import type { Chuck } from "./useChuck";
import { katvoorstelMoment, signaalzin, voorstelzin } from "./zinnen";

/**
 * Chuck's window (FB-071, ADR-0059 K4): on top what he brought, each item to look at or put off; below it the chat
 * (FB-031, ADR-0066), with its question field fixed at the bottom so it stays in reach while the conversation scrolls.
 * Below `sm` it is a screen of its own.
 *
 * It decides nothing itself except what the cat brought for a klas: those proposals have no other screen (ADR-0060),
 * so they are accepted or rejected here, through the route every activiteitvoorstel is decided by.
 */
export const Katvenster = forwardRef<
  HTMLDivElement,
  { id: string; chuck: Chuck; komt: boolean; naast: boolean; onSluit: () => void }
>(function Katvenster({ id, chuck, komt, naast, onSluit }, ref) {
  const { deurmat, houding } = chuck;
  const titelId = `${id}-titel`;
  const aantal = houding.aantal;
  const chat = useKatchat();

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-modal={naast ? "false" : "true"}
      aria-labelledby={titelId}
      data-komt={komt ? "" : undefined}
      onKeyDown={naast ? undefined : houdFocusBinnen}
      className={cn(
        "katvenster flex flex-col overflow-hidden bg-kaart text-inkt",
        naast
          ? "absolute right-0 top-full z-40 mt-3 max-h-[min(38rem,calc(100dvh-9rem))] w-[23rem] rounded-kaart border border-lijn shadow-zweef"
          : "fixed inset-0 z-50 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]",
      )}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-lijn py-2.5 pl-4 pr-2.5">
        <h2 id={titelId} className="font-display text-sectie text-inkt">
          {t("kat.naam")}
        </h2>
        <span className="text-meta text-inkt-zacht">
          {aantal === 0 ? t("kat.venster.niets") : telWoord(aantal, "kat.venster.eenDing", "kat.venster.dingen")}
        </span>
        <button
          type="button"
          data-sluit=""
          onClick={onSluit}
          aria-label={t("kat.venster.sluiten")}
          className="ml-auto inline-flex h-raak w-raak items-center justify-center rounded-veld text-inkt-zacht transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
        >
          <IcoonKruis aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-lijn bg-vlak px-4 py-3">
          {deurmat.isPending ? (
            <p className="text-meta text-inkt-zacht">{t("kat.venster.laadt")}</p>
          ) : deurmat.isError ? (
            <p role="alert" className="text-meta text-attentie-inkt">
              {t("kat.venster.fout")}
            </p>
          ) : aantal === 0 ? (
            <p className="text-meta text-inkt-zacht">{t("kat.venster.leeg")}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {deurmat.data.signalen.map((signaal) => (
                <li key={signaal.id}>
                  <Signaalitem signaal={signaal} onSluit={onSluit} />
                </li>
              ))}
              {deurmat.data.voorstellen.map((voorstel) => (
                <li key={`${voorstel.soort}-${voorstel.id}`}>
                  {voorstel.verwijzing === null ? (
                    <Katvoorstel voorstel={voorstel} />
                  ) : (
                    <Voorstelitem voorstel={voorstel} verwijzing={voorstel.verwijzing} onSluit={onSluit} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Gesprek chat={chat} onSluit={onSluit} />
      </div>

      <Vraagveld chat={chat} />

      <p className="shrink-0 border-t border-lijn bg-vlak px-4 py-2.5 text-micro text-inkt-zacht">
        {t("kat.venster.geenKinderen")}
      </p>
    </div>
  );
});

/**
 * On a phone the window is a screen of its own over everything else (`aria-modal`), so Tab stays inside it: focus that
 * wandered behind it would sit on a control nobody can see.
 */
function houdFocusBinnen(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "Tab") return;
  const focusbaar = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])")];
  if (focusbaar.length === 0) return;
  const eerste = focusbaar[0];
  const laatste = focusbaar[focusbaar.length - 1];
  if (e.shiftKey && document.activeElement === eerste) {
    e.preventDefault();
    laatste.focus();
  } else if (!e.shiftKey && document.activeElement === laatste) {
    e.preventDefault();
    eerste.focus();
  }
}

/**
 * "Bekijken" on the deurmat: a link, since it goes somewhere, so it gets a middle click, Ctrl+click and a screen reader
 * that calls it a link. The klas it is about is chosen first, since a link carries no klas; a new tab reads that
 * choice when it opens. A plain click stays in this tab through the router and closes the window; a click the browser
 * opens elsewhere leaves the window open.
 */
function Bekijklink({
  verwijzing,
  klasId,
  label,
  onGevolgd,
  onSluit,
}: {
  verwijzing: string;
  klasId: string | null;
  label: string;
  onGevolgd?: () => void;
  onSluit: () => void;
}) {
  const href = useHref(verwijzing);
  const navigate = useNavigate();
  const kiesKlas = useSelectie((s) => s.kiesKlas);
  const gevolgd = () => {
    onGevolgd?.();
    if (klasId) kiesKlas(klasId);
  };
  function opKlik(e: MouseEvent<HTMLAnchorElement>) {
    gevolgd();
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSluit();
    navigate(verwijzing);
  }
  return (
    <Knoplink
      rang="rustig"
      href={href}
      aria-label={label}
      onClick={opKlik}
      onAuxClick={(e) => e.button === 1 && gevolgd()}
    >
      {t("kat.bekijken")}
    </Knoplink>
  );
}

function Signaalitem({ signaal, onSluit }: { signaal: Deurmatsignaal; onSluit: () => void }) {
  const gezien = useSignaalGezien();
  const later = useSignaalLater();
  const zin = signaalzin(signaal);
  return (
    <article className="rounded-veld border border-lijn bg-kaart px-3 py-2.5">
      <p className="text-micro text-inkt-zacht">{signaal.klasnaam}</p>
      <p className="mt-0.5 text-body text-inkt">{zin}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {signaal.verwijzing ? (
          <Bekijklink
            verwijzing={signaal.verwijzing}
            klasId={signaal.klasId}
            label={t("kat.bekijkenAria", { wat: zin })}
            onGevolgd={() => gezien.mutate(signaal.id)}
            onSluit={onSluit}
          />
        ) : null}
        <Knop
          rang="stil"
          bezig={later.isPending}
          aria-label={t("kat.laterAria", { wat: zin })}
          onClick={() => later.mutate(signaal.id)}
        >
          {t("kat.later")}
        </Knop>
      </div>
      {later.isError ? (
        <p role="alert" className="mt-2 text-meta text-attentie-inkt">
          {t("kat.venster.mislukt")}
        </p>
      ) : null}
    </article>
  );
}

/** A proposal decided in its own screen: the window points there. */
function Voorstelitem({
  voorstel,
  verwijzing,
  onSluit,
}: {
  voorstel: Deurmatvoorstel;
  verwijzing: string;
  onSluit: () => void;
}) {
  const zin = voorstelzin(voorstel);
  return (
    <article className="voorstel-ai rounded-veld px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Aimerk label={t("activiteitvoorstel.aiVoorstel")} />
        <Statusmerk status="Voorgesteld" className="ml-auto" />
      </div>
      <p className="mt-1.5 text-body font-medium text-inkt">{zin}</p>
      <p className="mt-1 line-clamp-3 text-meta text-inkt-zacht">{voorstel.aiMotivatie}</p>
      <div className="mt-2">
        <Bekijklink
          verwijzing={verwijzing}
          klasId={null}
          label={t("kat.bekijkenAria", { wat: zin })}
          onSluit={onSluit}
        />
      </div>
    </article>
  );
}

/**
 * An activiteitvoorstel the cat brought a klas (ADR-0060): shown whole and decided here, since no other screen shows
 * it with its klas and its moment. It wears the faint ring of an undecided proposal (ADR-0051).
 */
function Katvoorstel({ voorstel }: { voorstel: Deurmatvoorstel }) {
  const beslis = useBeslisKatvoorstel();
  const moment = katvoorstelMoment(voorstel);
  return (
    <article className="voorstel-ai rounded-veld px-3 py-2.5" aria-label={voorstel.titel}>
      <div className="flex items-center gap-2">
        <Aimerk label={t("activiteitvoorstel.aiVoorstel")} />
        <Statusmerk status="Voorgesteld" className="ml-auto" />
        <Beslisknoppen
          naam={voorstel.titel}
          bezig={beslis.isPending}
          aanvaardLabel={t("kat.aanvaard")}
          onAanvaard={() => beslis.mutate({ voorstelId: voorstel.id, status: "Aanvaard" })}
          onWeiger={() => beslis.mutate({ voorstelId: voorstel.id, status: "Geweigerd" })}
        />
      </div>
      <p className="mt-1.5 text-body font-medium text-inkt">{voorstel.titel}</p>
      {moment ? <p className="mt-0.5 text-meta text-inkt-zacht">{moment}</p> : null}
      <p className="mt-2 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">{voorstel.aiMotivatie}</p>
      {beslis.isError ? (
        <p role="alert" className="mt-2 text-meta text-attentie-inkt">
          {t("kat.venster.mislukt")}
        </p>
      ) : null}
    </article>
  );
}
