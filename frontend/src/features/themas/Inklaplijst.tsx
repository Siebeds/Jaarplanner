import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { IcoonChevron, IcoonKruis, IcoonZoek } from "../../components/Iconen";
import { Invoer } from "../../components/ui/Veld";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/** How many rows one press shows. */
export const PAGINA = 5;

/**
 * A long list on the thema page, shut until asked for (TB-044).
 *
 * The owner, 2026-09-16, about a thema with many minimumdoelen: "ik moet scrollen en scrollen". So a list starts as one
 * line with its count. Opened, it shows the first `PAGINA` rows and a "Laad x meer" under them, until the whole list is
 * out; shutting it forgets how far it got.
 *
 * **The search icon answers "is it in here" without opening anything.** It opens a field beside the count that filters
 * the whole list, shut or open, and the matches are paged the same way. Escape, or the icon again, closes and clears it.
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
}: {
  items: T[];
  sleutel: (item: T) => string;
  /** One row, as an `li`. */
  render: (item: T) => ReactNode;
  /** Everything a search may match on for this item, in any case. */
  zoektekst: (item: T) => string;
  /** The count on the fold button: "12 minimumdoelen". */
  aantalTekst: string;
  /** The list's name inside a sentence, for the search button's label: "minimumdoelen". */
  lijstnaam: string;
  zoekPlaatshouder: string;
  /** Texts the search matches on are still arriving, so a miss may not be final. */
  zoekLaadt?: boolean;
  onZoekOpen?: (open: boolean) => void;
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
  const sluitZoek = () => {
    zetZoekOpen(false);
    zoekknop.current?.focus();
  };

  return (
    <div>
      {/* A small field at the right of the count line from `sm` up, beside its close button: it looks for one thing and
          needs no more room than a word or a code (owner, 2026-09-16: "de zoekbalk is te groot"). On a phone it takes a
          line of its own under the count. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            setZichtbaar(PAGINA);
          }}
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-veld px-2 text-meta font-medium text-inkt transition-colors duration-150 hover:bg-inkt/[0.035]"
        >
          <IcoonChevron
            aria-hidden="true"
            className={cn(
              "h-4 w-4 shrink-0 text-inkt-zacht transition-transform duration-200 motion-reduce:transition-none",
              !open && "-rotate-90",
            )}
          />
          {aantalTekst}
        </button>

        {zoekOpen ? (
          <div className="relative order-last min-w-0 basis-full sm:order-none sm:ml-auto sm:w-56 sm:basis-auto">
            <IcoonZoek
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-inkt-zwak"
            />
            <Invoer
              autoFocus
              value={zoek}
              aria-label={t("lijst.zoekIn", { lijst: lijstnaam })}
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
        ) : null}

        <button
          ref={zoekknop}
          type="button"
          aria-label={t(zoekOpen ? "lijst.zoekSluit" : "lijst.zoekIn", { lijst: lijstnaam })}
          aria-expanded={zoekOpen}
          onClick={() => (zoekOpen ? sluitZoek() : zetZoekOpen(true))}
          className={cn(
            zoekOpen ? "ml-auto sm:ml-0" : "ml-auto",
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-veld text-inkt-zacht transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt",
          )}
        >
          {zoekOpen ? (
            <IcoonKruis aria-hidden="true" className="h-4 w-4" />
          ) : (
            <IcoonZoek aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Mounted while the field is open, with only its text swapped, so a screen reader announces each new count. */}
      {zoekOpen ? (
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
      ) : null}

      {getoond.length > 0 ? (
        <ul
          ref={lijst}
          className="mt-2 divide-y divide-lijn overflow-hidden rounded-veld border border-lijn"
        >
          {getoond.map((item) => (
            <Fragment key={sleutel(item)}>{render(item)}</Fragment>
          ))}
        </ul>
      ) : null}

      {rest > 0 ? (
        <button
          type="button"
          onClick={() => {
            focusOp.current = getoond.length;
            setZichtbaar(zichtbaar + PAGINA);
          }}
          className="mt-2 inline-flex h-9 items-center gap-2 rounded-veld px-2 text-meta font-medium text-inkt transition-colors duration-150 hover:bg-inkt/[0.035]"
        >
          {t("lijst.laadMeer", { aantal: Math.min(PAGINA, rest) })}
          <span className="font-normal text-inkt-zacht">{t("lijst.nogOver", { aantal: rest })}</span>
        </button>
      ) : null}
    </div>
  );
}

/** Case and accents do not decide a match: "ecologie" finds "Ecologie" and "één" finds "een". */
function normaliseer(tekst: string): string {
  return tekst.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("nl");
}
