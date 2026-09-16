import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { IcoonKruis, IcoonVink } from "../Iconen";
import { Knop } from "./Knop";
import { Statusmerk } from "./Statusmerk";

export type Besluit = "Aanvaard" | "Geweigerd";

export type Voorstel = {
  id: string;
  /** What the decision is about, in a few words: the word itself, or a goal's code. Names the two buttons. */
  naam: string;
  /** The line above the text: merken and a code. Optional; without it the card leads with the status. */
  kop?: ReactNode;
  /** The proposal itself, set large. */
  inhoud: ReactNode;
  motivatie?: string | null;
};

/** How long a "rest" decision waits for Ongedaan maken before it is written. */
export const UITSTEL_MS = 6000;

/**
 * The AI's open proposals, reviewed one at a time as a stack of cards (TB-045): the woordweb's words and the thema's
 * doelsuggesties share it, so a teacher meets one shape for "the AI proposes, you decide" (Art. IV.1 to IV.3).
 *
 * **One card, and its reason always shown.** The top card carries the proposal, the AI's motivation, "2 van 5", and
 * the two decisions; the cards behind it are only edges, there while more are waiting. A progress strip above says
 * what this session decided so far. The strip is colour, so it is hidden from a screen reader and doubled by the count
 * in words; each button has its icon.
 *
 * **A single decision is written at once**, and the card leaves before the server answers. If the write fails the card
 * comes back, and the caller shows the error it already shows. The two buttons are the same elements from card to
 * card, so keyboard focus stays on the one just used, and A and W decide while focus is anywhere in the stack.
 *
 * **"Rest aanvaarden" and "Rest weigeren" wait before they write.** The server cannot turn a decision back into a
 * proposal, so the undo lives here: the cards go, a line says what is about to happen with Ongedaan maken, and only
 * after `UITSTEL_MS` are the decisions sent, one after the other. Leaving the screen sends them at once, since that is
 * what the teacher chose. Offered from two open cards on; for one, the card's own buttons are the same decision.
 */
type Eigenschappen = {
  voorstellen: Voorstel[];
  /** Writes one decision; a rejected promise puts the card back. */
  onBeslis(id: string, besluit: Besluit): Promise<unknown>;
  label: string;
};

export function Voorstelstapel({ voorstellen, onBeslis, label }: Eigenschappen) {
  // Every proposal met in this session, in order, so the strip and the count keep the decided ones.
  const [gezien, setGezien] = useState<string[]>(() => voorstellen.map((v) => v.id));
  const [beslist, setBeslist] = useState<Record<string, Besluit>>({});
  const [uitgesteld, setUitgesteld] = useState<{ besluit: Besluit; ids: string[] } | null>(null);

  const open = voorstellen.filter((v) => !beslist[v.id]);
  const huidig = open[0] ?? null;

  // New proposals join the session; a fresh batch after everything was decided starts a new one. Adjusted while
  // rendering, when the ids differ from the last ones seen, rather than in an effect that would render twice.
  const idsSleutel = voorstellen.map((v) => v.id).join(",");
  const [vorigeSleutel, setVorigeSleutel] = useState(idsSleutel);
  if (idsSleutel !== vorigeSleutel) {
    setVorigeSleutel(idsSleutel);
    const ids = voorstellen.map((v) => v.id);
    const nieuw = ids.filter((id) => !gezien.includes(id));
    if (nieuw.length > 0) {
      const nogOpen = gezien.some((id) => ids.includes(id) && !beslist[id]);
      if (!nogOpen && !uitgesteld) {
        setGezien(nieuw);
        setBeslist({});
      } else {
        setGezien([...gezien, ...nieuw]);
      }
    }
  }

  // The caller's write, kept current for the deferred send, which may run after this render is long gone.
  const beslisRef = useRef(onBeslis);
  useEffect(() => {
    beslisRef.current = onBeslis;
  });

  // Written, or given back to the stack when the write fails. The caller shows the error itself.
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

  const beslis = (besluit: Besluit) => {
    if (!huidig) return;
    setBeslist((vorig) => ({ ...vorig, [huidig.id]: besluit }));
    void schrijf(huidig.id, besluit);
  };

  // The deferred "rest" decision. The ref is what gets sent, and only event handlers and effects touch it.
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

  useEffect(() => {
    if (!uitgesteld) return;
    const klok = window.setTimeout(verstuurUitgesteld, UITSTEL_MS);
    return () => window.clearTimeout(klok);
  }, [uitgesteld, verstuurUitgesteld]);

  // Leaving the screen sends what is still waiting: that is what the teacher chose.
  useEffect(() => () => verstuurUitgesteld(), [verstuurUitgesteld]);

  const beslisRest = (besluit: Besluit) => {
    const ids = open.map((v) => v.id);
    wachtRef.current = { besluit, ids };
    setBeslist((vorig) => ({ ...vorig, ...Object.fromEntries(ids.map((id) => [id, besluit])) }));
    setUitgesteld({ besluit, ids });
  };

  // Ongedaan maken leaves with its line, so focus goes back to the card rather than to the page.
  const stapel = useRef<HTMLElement>(null);
  const focusTerug = useRef(false);
  useEffect(() => {
    if (uitgesteld || !focusTerug.current) return;
    focusTerug.current = false;
    stapel.current?.querySelector<HTMLButtonElement>("[aria-keyshortcuts=A]")?.focus();
  }, [uitgesteld]);

  const maakOngedaan = () => {
    if (!uitgesteld) return;
    focusTerug.current = true;
    const terug = new Set(uitgesteld.ids);
    wachtRef.current = null;
    setUitgesteld(null);
    setBeslist((vorig) => Object.fromEntries(Object.entries(vorig).filter(([id]) => !terug.has(id))));
  };

  const opToets = (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    const toets = e.key.toLowerCase();
    if (toets === "a") beslis("Aanvaard");
    else if (toets === "w") beslis("Geweigerd");
    else return;
    e.preventDefault();
  };

  const aantalAanvaard = gezien.filter((id) => beslist[id] === "Aanvaard").length;
  const aantalGeweigerd = gezien.filter((id) => beslist[id] === "Geweigerd").length;

  if (uitgesteld) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-kaart border border-lijn bg-kaart px-4 py-3 shadow-licht"
      >
        <p className="text-body text-inkt">
          {t(uitgesteld.besluit === "Aanvaard" ? "voorstelstapel.restWordtAanvaard" : "voorstelstapel.restWordtGeweigerd", {
            aantal: uitgesteld.ids.length,
          })}
        </p>
        <Knop rang="rustig" className="h-9 min-h-9 px-3 text-meta" onClick={maakOngedaan}>
          {t("voorstelstapel.ongedaan")}
        </Knop>
        <span aria-hidden="true" className="h-1 basis-full overflow-hidden rounded-full bg-vlak-diep">
          <span
            className="block h-full origin-left rounded-full bg-inkt-zacht animate-[stapel-aftellen_linear_forwards]"
            style={{ animationDuration: `${UITSTEL_MS}ms` }}
          />
        </span>
      </div>
    );
  }

  if (!huidig) {
    if (aantalAanvaard + aantalGeweigerd === 0) return null;
    return (
      <p role="status" className="text-meta text-inkt-zacht">
        {t("voorstelstapel.klaar", { aanvaard: aantalAanvaard, geweigerd: aantalGeweigerd })}
      </p>
    );
  }

  const nummer = gezien.indexOf(huidig.id) + 1;

  return (
    <section ref={stapel} aria-label={label} onKeyDown={opToets} className="flex flex-col gap-2">
      {open.length > 1 ? (
        <div className="flex flex-wrap justify-end gap-1">
          <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={() => beslisRest("Geweigerd")}>
            {t("voorstelstapel.restWeigeren", { aantal: open.length })}
          </Knop>
          <Knop rang="rustig" className="h-9 min-h-9 px-3 text-meta" onClick={() => beslisRest("Aanvaard")}>
            {t("voorstelstapel.restAanvaarden", { aantal: open.length })}
          </Knop>
        </div>
      ) : null}

      <div className={cn("relative", open.length > 1 && "pb-2", open.length > 2 && "pb-3.5")}>
        {open.length > 2 ? (
          <div aria-hidden="true" className="absolute inset-x-6 bottom-0 h-8 rounded-kaart border border-lijn bg-kaart" />
        ) : null}
        {open.length > 1 ? (
          <div aria-hidden="true" className="absolute inset-x-3 bottom-1.5 h-8 rounded-kaart border border-lijn bg-kaart" />
        ) : null}

        <div className="relative rounded-kaart border border-lijn bg-kaart p-4 shadow-licht">
          <div aria-hidden="true" className="mb-3 flex gap-1">
            {gezien.map((id) => (
              <span
                key={id}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  beslist[id] === "Aanvaard"
                    ? "bg-suggestie-aanvaard"
                    : beslist[id] === "Geweigerd"
                      ? "bg-suggestie-geweigerd"
                      : id === huidig.id
                        ? "bg-suggestie-voorgesteld"
                        : "bg-vlak-diep",
                )}
              />
            ))}
          </div>

          <div key={huidig.id} className="animate-[stapel-in_220ms_ease-out]">
            <div className="flex flex-wrap items-center gap-2">
              {huidig.kop}
              <Statusmerk status="Voorgesteld" />
              <span className="ml-auto text-meta tabular-nums text-inkt-zacht">
                {t("voorstelstapel.teller", { nummer, totaal: gezien.length })}
              </span>
            </div>
            <div className="mt-2 text-sectie text-inkt">{huidig.inhoud}</div>
            {huidig.motivatie ? (
              <p className="mt-2 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">
                {huidig.motivatie}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Knop
              rang="rustig"
              aria-label={t("voorstelstapel.weigerAria", { naam: huidig.naam })}
              aria-keyshortcuts="W"
              onClick={() => beslis("Geweigerd")}
            >
              <IcoonKruis aria-hidden="true" className="h-4 w-4 shrink-0" />
              {t("voorstelstapel.weiger")}
              <Toets>W</Toets>
            </Knop>
            <Knop
              rang="hoofd"
              aria-label={t("voorstelstapel.aanvaardAria", { naam: huidig.naam })}
              aria-keyshortcuts="A"
              onClick={() => beslis("Aanvaard")}
            >
              <IcoonVink aria-hidden="true" className="h-4 w-4 shrink-0" />
              {t("voorstelstapel.aanvaard")}
              <Toets>A</Toets>
            </Knop>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The shortcut beside a label, for a keyboard; a phone has none, so it shows from the tablet width on. */
function Toets({ children }: { children: string }) {
  return (
    <kbd
      aria-hidden="true"
      className="mono hidden rounded-md border border-current/40 px-1.5 text-micro leading-5 sm:inline-block"
    >
      {children}
    </kbd>
  );
}
