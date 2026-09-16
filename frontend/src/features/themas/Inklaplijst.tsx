import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { IcoonChevron, IcoonKruis, IcoonZoek } from "../../components/Iconen";
import { Invoer } from "../../components/ui/Veld";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/** How many rows one press shows. */
export const PAGINA = 5;

/**
 * A long list on the thema page, shut until asked for (TB-051).
 *
 * The owner, 2026-09-16, about a thema with many minimumdoelen: "ik moet scrollen en scrollen". So a list starts as one
 * line with its count. Opened, it shows the first `PAGINA` rows and a "Laad x meer" under them, until the whole list is
 * out; shutting it forgets how far it got.
 *
 * **Two shapes for that line.** Under a heading of its own (the themadoelen, whose `Kop` also carries the AI) it is a
 * count: "70 minimumdoelen". Given `kop`, the line IS the heading: the section's title and its count fold the list, and
 * the section's add control and search sit right after them, small (owner, 2026-09-16: the add buttons were "storend op
 * die plaats en dat formaat", and opening the list "moet deel zijn van de titel, niet een extra lijntje eronder").
 * They follow the title rather than sitting at the far right, which is where the owner found them unclear on
 * 2026-08-30.
 *
 * **The search icon answers "is it in here" without opening anything.** It opens a small field that filters the whole
 * list, shut or open, and the matches are paged the same way. Escape, or the icon again, closes and clears it.
 * `onZoekOpen` tells the caller the field is open, so texts that are only fetched per shown row can be fetched for all.
 *
 * **The caller orders the items and renders each as an `li`**: the order that is logical differs per list, and the rows
 * already exist. The frame is the page's own list frame (`Doellijst`).
 */
export function Inklaplijst<T>({
  items,
  sleutel,
  render,
  zoektekst,
  aantalTekst,
  lijstnaam,
  zoekPlaatshouder,
  zoekLaadt,
  onZoekOpen,
  kop,
}: {
  items: T[];
  sleutel: (item: T) => string;
  /** One row, as an `li`. */
  render: (item: T) => ReactNode;
  /** Everything a search may match on for this item, in any case. */
  zoektekst: (item: T) => string;
  /** The count on the fold button: "12 minimumdoelen". Unused with `kop`, which shows the title and the figure. */
  aantalTekst?: string;
  /** The list's name inside a sentence, for the search button's label: "minimumdoelen". */
  lijstnaam: string;
  zoekPlaatshouder: string;
  /** Texts the search matches on are still arriving, so a miss may not be final. */
  zoekLaadt?: boolean;
  onZoekOpen?: (open: boolean) => void;
  /** The list is a section of its own, and its heading folds it. */
  kop?: {
    titel: string;
    /** Only for a section holding Op.stap doelen; see `Fiche.tsx`. */
    icoon?: ReactNode;
    /** The section's add control, in its small form. */
    acties?: ReactNode;
    /** Said under the heading while the list is empty. */
    leeg: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [zoekOpen, setZoekOpen] = useState(false);
  const [zoek, setZoek] = useState("");
  const [zichtbaar, setZichtbaar] = useState(PAGINA);
  const lijst = useRef<HTMLUListElement>(null);
  const zoekknop = useRef<HTMLButtonElement>(null);
  // The row a "Laad meer" revealed first, which takes focus: the button itself may be gone after the last page.
  const focusOp = useRef<number | null>(null);

  const term = normaliseer(zoek.trim());
  const zoekt = zoekOpen && term.length > 0;
  const gefilterd = zoekt ? items.filter((item) => normaliseer(zoektekst(item)).includes(term)) : items;
  const toont = zoekt || open;
  const getoond = toont ? gefilterd.slice(0, zichtbaar) : [];
  // Nothing to load while nothing shows: a shut list is one line.
  const rest = toont ? gefilterd.length - getoond.length : 0;
  const leeg = items.length === 0;

  useEffect(() => {
    if (focusOp.current === null) return;
    const rij = lijst.current?.children.item(focusOp.current);
    focusOp.current = null;
    rij?.querySelector<HTMLElement>("button, a, input")?.focus();
  });

  const zetZoekOpen = (waarde: boolean) => {
    setZoekOpen(waarde);
    setZichtbaar(PAGINA);
    if (!waarde) setZoek("");
    onZoekOpen?.(waarde);
  };
  // The search button comes back in place of the field, so it takes focus once it is mounted again.
  const focusZoekknop = useRef(false);
  const sluitZoek = () => {
    zetZoekOpen(false);
    focusZoekknop.current = true;
  };
  useEffect(() => {
    if (zoekOpen || !focusZoekknop.current) return;
    focusZoekknop.current = false;
    zoekknop.current?.focus();
  }, [zoekOpen]);
  const vouw = () => {
    setOpen(!open);
    setZichtbaar(PAGINA);
  };

  const zoekLabel = t("lijst.zoekIn", { lijst: lijstnaam });
  const sluitLabel = t("lijst.zoekSluit", { lijst: lijstnaam });

  const zoekveld = (
    <div className="relative min-w-0 flex-1">
      <IcoonZoek
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-inkt-zwak"
      />
      <Invoer
        autoFocus
        value={zoek}
        aria-label={zoekLabel}
        placeholder={zoekPlaatshouder}
        onChange={(e) => {
          setZoek(e.target.value);
          setZichtbaar(PAGINA);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            sluitZoek();
          }
        }}
        // Important: `Invoer` sets `h-raak`, which `cn` does not recognise as a height, so a plain `h-8` loses.
        className="h-8! min-h-8 pl-7 pr-2 text-meta"
      />
    </div>
  );

  const zoekknopOpen = (
    <button
      ref={zoekknop}
      type="button"
      aria-label={zoekLabel}
      title={zoekLabel}
      aria-expanded={false}
      onClick={() => zetZoekOpen(true)}
      className={cn(ICOONKNOP, "h-8 w-8")}
    >
      <IcoonZoek aria-hidden="true" className="h-4 w-4" />
    </button>
  );

  const zoekknopDicht = (
    <button
      type="button"
      aria-label={sluitLabel}
      title={sluitLabel}
      aria-expanded
      onClick={sluitZoek}
      className={cn(ICOONKNOP, "h-8 w-8")}
    >
      <IcoonKruis aria-hidden="true" className="h-4 w-4" />
    </button>
  );

  // Mounted while the field is open, with only its text swapped, so a screen reader announces each new count.
  const status = zoekOpen ? (
    <p role="status" className={zoekt ? "mt-1 text-meta text-inkt-zacht" : "sr-only"}>
      {!zoekt
        ? null
        : gefilterd.length > 0
          ? t(gefilterd.length === 1 ? "lijst.eenGevonden" : "lijst.gevonden", {
              aantal: gefilterd.length,
              totaal: items.length,
            })
          : zoekLaadt
            ? t("lijst.zoeken")
            : t("lijst.nietsGevonden")}
    </p>
  ) : null;

  const rijen = (klasse: string) =>
    getoond.length > 0 ? (
      <ul ref={lijst} className={cn("divide-y divide-lijn", klasse)}>
        {getoond.map((item) => (
          <Fragment key={sleutel(item)}>{render(item)}</Fragment>
        ))}
      </ul>
    ) : null;

  const laadMeer = (klasse: string) =>
    rest > 0 ? (
      <button
        type="button"
        onClick={() => {
          focusOp.current = getoond.length;
          setZichtbaar(zichtbaar + PAGINA);
        }}
        className={cn(
          "items-center gap-2 text-meta font-medium text-inkt transition-colors duration-150 hover:bg-inkt/[0.035]",
          klasse,
        )}
      >
        {t("lijst.laadMeer", { aantal: Math.min(PAGINA, rest) })}
        <span className="font-normal text-inkt-zacht">{t("lijst.nogOver", { aantal: rest })}</span>
      </button>
    ) : null;

  if (!kop) {
    // A FRAMED ROW, the shape of a leeftijd in "Doelen per leeftijd" (owner, 2026-09-16): the count on the left, the
    // chevron on the right, and the list opening inside the same frame. The search icon is laid over the fold button,
    // which covers the whole row, so the two stay separate controls.
    return (
      <div className="overflow-hidden rounded-veld border border-lijn">
        <div className="relative">
          <button
            type="button"
            aria-expanded={open}
            onClick={vouw}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
          >
            <span className="min-w-0 flex-1 text-meta text-inkt-zacht">{aantalTekst}</span>
            {/* Room for the search icon. */}
            <span aria-hidden="true" className="w-8 shrink-0" />
            <IcoonChevron
              aria-hidden="true"
              className={cn(
                "h-5 w-5 shrink-0 text-inkt-zwak transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
          <span className="absolute right-10 top-1/2 flex -translate-y-1/2">
            {zoekOpen ? zoekknopDicht : zoekknopOpen}
          </span>
        </div>

        {zoekOpen ? (
          <div className="border-t border-lijn px-3 py-2">
            <div className="flex sm:w-72">{zoekveld}</div>
            {status}
          </div>
        ) : null}

        {rijen("border-t border-lijn")}
        {laadMeer("flex w-full border-t border-lijn px-3 py-2.5 text-left")}
      </div>
    );
  }

  // THE LIST UNDER ITS OWN HEADING: the heading folds it. The field is small: it looks for one thing and needs no more
  // room than a word or a code (owner, 2026-09-16: "de zoekbalk is te groot"). On a phone it takes a line of its own,
  // together with its close button.
  return (
    <section className="mt-5 border-t border-lijn pt-2">
      <div className="flex flex-wrap items-center gap-x-0.5 gap-y-2">
        <h3 className="min-w-0">
          {leeg ? (
            <span className="inline-flex h-8 items-center gap-1.5 text-micro uppercase tracking-wide text-inkt-zacht">
              {kop.icoon}
              {kop.titel}
            </span>
          ) : (
            <button
              type="button"
              aria-expanded={open}
              onClick={vouw}
              className="-ml-1.5 inline-flex h-8 items-center gap-1.5 rounded-veld px-1.5 text-micro uppercase tracking-wide text-inkt-zacht transition-colors duration-150 hover:bg-inkt/[0.035] hover:text-inkt"
            >
              <IcoonChevron
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-inkt-zacht transition-transform duration-200 motion-reduce:transition-none",
                  !open && "-rotate-90",
                )}
              />
              {kop.icoon}
              {kop.titel}
              {/* A space in the text too, so the name reads "Activiteiten 5" and not "Activiteiten5". */}{" "}
              <span className="mono rounded-full bg-vlak-diep px-1.5 text-[0.6875rem] font-medium normal-case tracking-normal text-inkt">
                {items.length}
              </span>
            </button>
          )}
        </h3>
        {kop.acties}

        {leeg ? null : zoekOpen ? (
          <div className="order-last flex min-w-0 basis-full items-center gap-0.5 sm:order-none sm:ml-1 sm:basis-auto">
            <div className="flex min-w-0 flex-1 sm:w-56 sm:flex-none">{zoekveld}</div>
            {zoekknopDicht}
          </div>
        ) : (
          zoekknopOpen
        )}
      </div>

      {leeg ? <p className="mt-1 text-meta text-inkt-zacht">{kop.leeg}</p> : null}
      {status}
      {rijen("mt-2 overflow-hidden rounded-veld border border-lijn")}
      {laadMeer("mt-2 inline-flex h-9 rounded-veld px-2")}
    </section>
  );
}

const ICOONKNOP =
  "inline-flex shrink-0 items-center justify-center rounded-veld text-inkt-zacht transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt";

/** Case and accents do not decide a match: "ecologie" finds "Ecologie" and "één" finds "een". */
function normaliseer(tekst: string): string {
  return tekst.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("nl");
}
