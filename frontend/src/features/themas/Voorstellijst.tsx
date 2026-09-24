import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Knop } from "../../components/ui/Knop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { t } from "../../i18n";
import { Aimerk, Beslisknoppen } from "./Subdoelplaatsing";

export type Besluit = "Aanvaard" | "Geweigerd";

export type Voorstel = {
  id: string;
  /** What the decision is about, in a few words: the word itself, or a goal's code. Names the two buttons. */
  naam: string;
  /** Merken and a code before the status. Optional. */
  kop?: ReactNode;
  /** The proposal itself. */
  inhoud: ReactNode;
  motivatie?: string | null;
};

/** How long an "Alle n" decision waits for Ongedaan maken before it is written. */
export const UITSTEL_MS = 6000;

type Eigenschappen = {
  voorstellen: Voorstel[];
  /** Writes one decision; a rejected promise puts the row back. */
  onBeslis(id: string, besluit: Besluit): Promise<unknown>;
  label: string;
};

/**
 * The AI's open proposals as one flat list (TB-076): the woordweb's words and the thema's doelsuggesties share it, so a
 * teacher sees at a glance everything the AI proposes and decides each where she likes (Art. IV.1 to IV.3). Each row
 * wears the faint ring with the wand, the status mark, the AI's motivation and the quiet check and cross of ADR-0051,
 * the shape every other AI proposal in the app has.
 *
 * **A single decision is written at once**, and the row leaves before the server answers. If the write fails the row
 * comes back, and the caller shows the error it already shows.
 *
 * **"Alle n aanvaarden" and "Alle n weigeren" wait before they write.** The server cannot turn a decision back into a
 * proposal, so the undo lives here: the rows go, a line says what is about to happen and takes focus on its Ongedaan
 * maken, and only after `UITSTEL_MS` are the decisions sent, one after the other. The wait pauses while the pointer
 * or keyboard focus is on that line (WCAG 2.2.1), and says so. Leaving the screen, or the page, sends them at once,
 * since that is what the teacher chose. Offered from two open proposals on.
 */
export function Voorstellijst({ voorstellen, onBeslis, label }: Eigenschappen) {
  const [beslist, setBeslist] = useState<Record<string, Besluit>>({});
  const [uitgesteld, setUitgesteld] = useState<{ besluit: Besluit; ids: string[] } | null>(null);

  const open = voorstellen.filter((v) => !beslist[v.id]);

  // The caller's write, kept current for the deferred send, which may run after this render is long gone.
  const beslisRef = useRef(onBeslis);
  useEffect(() => {
    beslisRef.current = onBeslis;
  });

  // Written, or given back to the list when the write fails. The caller shows the error itself.
  const schrijf = useCallback(
    (id: string, besluit: Besluit) =>
      beslisRef.current(id, besluit).catch(() =>
        setBeslist((vorig) => {
          const rest = { ...vorig };
          delete rest[id];
          return rest;
        }),
      ),
    [],
  );

  const beslis = (id: string, besluit: Besluit) => {
    setBeslist((vorig) => ({ ...vorig, [id]: besluit }));
    void schrijf(id, besluit);
  };

  // The deferred "Alle n" decision. The ref is what gets sent, and only event handlers and effects touch it.
  const wachtRef = useRef<{ besluit: Besluit; ids: string[] } | null>(null);

  const verstuurUitgesteld = useCallback(() => {
    const wacht = wachtRef.current;
    if (!wacht) return;
    wachtRef.current = null;
    setUitgesteld(null);
    void (async () => {
      for (const id of wacht.ids) await schrijf(id, wacht.besluit);
    })();
  }, [schrijf]);

  // The wait, paused while the pointer or keyboard focus is on the line. `resterend` keeps what is left across pauses.
  const [muisErop, setMuisErop] = useState(false);
  const [focusErop, setFocusErop] = useState(false);
  const gepauzeerd = muisErop || focusErop;
  const resterend = useRef(UITSTEL_MS);
  useEffect(() => {
    if (!uitgesteld || gepauzeerd) return;
    const gestart = Date.now();
    const klok = window.setTimeout(verstuurUitgesteld, resterend.current);
    return () => {
      window.clearTimeout(klok);
      resterend.current = Math.max(0, resterend.current - (Date.now() - gestart));
    };
  }, [uitgesteld, gepauzeerd, verstuurUitgesteld]);

  // Leaving the screen, or closing or reloading the page, sends what is still waiting: that is what the teacher chose.
  useEffect(() => {
    window.addEventListener("pagehide", verstuurUitgesteld);
    return () => {
      window.removeEventListener("pagehide", verstuurUitgesteld);
      verstuurUitgesteld();
    };
  }, [verstuurUitgesteld]);

  const beslisAlle = (besluit: Besluit) => {
    const ids = open.map((v) => v.id);
    wachtRef.current = { besluit, ids };
    resterend.current = UITSTEL_MS;
    setMuisErop(false);
    setFocusErop(false);
    setBeslist((vorig) => ({ ...vorig, ...Object.fromEntries(ids.map((id) => [id, besluit])) }));
    setUitgesteld({ besluit, ids });
  };

  // The list and the waiting line replace each other, so focus moves with them: onto Ongedaan maken when the line
  // appears, and back onto the first row after Ongedaan maken, rather than falling to the page.
  const lijst = useRef<HTMLElement>(null);
  const wachtregel = useRef<HTMLDivElement>(null);
  const focusTerug = useRef(false);
  useEffect(() => {
    if (uitgesteld) {
      wachtregel.current?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }
    if (!focusTerug.current) return;
    focusTerug.current = false;
    lijst.current?.querySelector<HTMLButtonElement>("li button")?.focus();
  }, [uitgesteld]);

  // Focus pauses the wait only when it is visible keyboard focus: the focus a mouse click leaves behind must not hold
  // a mouse user's decision back indefinitely.
  const opFocus = (doel: Element) => {
    let zichtbaar = false;
    try {
      zichtbaar = doel.matches(":focus-visible");
    } catch {
      zichtbaar = false;
    }
    setFocusErop(zichtbaar);
  };

  const maakOngedaan = () => {
    if (!uitgesteld) return;
    focusTerug.current = true;
    const terug = new Set(uitgesteld.ids);
    wachtRef.current = null;
    setUitgesteld(null);
    setBeslist((vorig) => Object.fromEntries(Object.entries(vorig).filter(([id]) => !terug.has(id))));
  };

  if (uitgesteld) {
    return (
      <div
        ref={wachtregel}
        role="status"
        onPointerEnter={() => setMuisErop(true)}
        onPointerLeave={() => setMuisErop(false)}
        onFocus={(e) => opFocus(e.target)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFocusErop(false);
        }}
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-veld border border-lijn bg-kaart px-3 py-2.5"
      >
        <p className="text-body text-inkt">
          {t(uitgesteld.besluit === "Aanvaard" ? "voorstellijst.alleWordtAanvaard" : "voorstellijst.alleWordtGeweigerd", {
            aantal: uitgesteld.ids.length,
          })}
          {gepauzeerd ? <span className="ml-2 text-meta text-inkt-zacht">{t("voorstellijst.gepauzeerd")}</span> : null}
        </p>
        <Knop rang="rustig" className="sm:h-9 sm:min-h-9 px-3 text-meta" onClick={maakOngedaan}>
          {t("voorstellijst.ongedaan")}
        </Knop>
        <span aria-hidden="true" className="h-1 basis-full overflow-hidden rounded-full bg-vlak-diep">
          <span
            className="block h-full origin-left rounded-full bg-inkt-zacht animate-[voorstel-aftellen_linear_forwards]"
            style={{ animationDuration: `${UITSTEL_MS}ms`, animationPlayState: gepauzeerd ? "paused" : "running" }}
          />
        </span>
      </div>
    );
  }

  if (open.length === 0) return null;

  return (
    <section ref={lijst} aria-label={label} className="flex flex-col gap-2">
      {open.length > 1 ? (
        <div className="flex flex-wrap justify-end gap-1">
          <Knop rang="stil" className="sm:h-9 sm:min-h-9 px-3 text-meta" onClick={() => beslisAlle("Geweigerd")}>
            {t("voorstellijst.alleWeigeren", { aantal: open.length })}
          </Knop>
          <Knop rang="rustig" className="sm:h-9 sm:min-h-9 px-3 text-meta" onClick={() => beslisAlle("Aanvaard")}>
            {t("voorstellijst.alleAanvaarden", { aantal: open.length })}
          </Knop>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {open.map((voorstel) => (
          <li key={voorstel.id} className="voorstel-ai min-w-0 rounded-veld px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {voorstel.kop}
              <Aimerk label={t("voorstellijst.aiVoorstel")} />
              <span className="ml-auto inline-flex items-center gap-1">
                <Statusmerk status="Voorgesteld" />
                <Beslisknoppen
                  naam={voorstel.naam}
                  onAanvaard={() => beslis(voorstel.id, "Aanvaard")}
                  onWeiger={() => beslis(voorstel.id, "Geweigerd")}
                />
              </span>
            </div>
            <div className="mt-1.5 text-body font-medium text-inkt">{voorstel.inhoud}</div>
            {voorstel.motivatie ? (
              <p className="mt-1.5 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">
                {voorstel.motivatie}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
