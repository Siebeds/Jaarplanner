import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "../../i18n";
import { useMediaQuery } from "../../lib/scherm";
import { Ballon } from "./Ballon";
import { Katvenster } from "./Katvenster";
import { DUUR } from "./rig";
import { houdingklasse } from "./houding";
import { Mandscene } from "./Tekening";
import { minderBeweging, useLevenInRust, useLoopje } from "./useLoopje";
import { useChuck, useChuckZichtbaar, type Chuck } from "./useChuck";
import { gevaarzin, houdingzin } from "./zinnen";

/** From here the window hangs under the basket; below it, it is a screen of its own. */
const VENSTER_NAAST = "(min-width: 640px)";

/**
 * Chuck in his basket, top right in the header of every screen that draws a `Schermkop` (FB-071, ADR-0059 K4).
 * Nothing when the school has not turned him on (ADR-0064).
 */
export function Katmand() {
  return useChuckZichtbaar() ? <ZichtbareKatmand /> : null;
}

/**
 * What he says, on a phone: under the header row, so no balloon ever lies over data. From `sm` it stands beside the
 * basket instead, inside `Katmand`.
 */
export function Katregel() {
  return useChuckZichtbaar() ? <ZichtbareKatregel /> : null;
}

function ZichtbareKatregel() {
  const chuck = useChuck();
  const tekst = houdingstekst(chuck, "boven");
  return tekst ? <div className="flex justify-end pt-1 sm:hidden">{tekst}</div> : null;
}

/**
 * The words every posture carries (never form alone): a balloon when he has something to say, a quiet label when he
 * has not. `null` while he lies on the week strip, where his balloon is.
 */
function houdingstekst(chuck: Chuck, staart: "rechts" | "boven"): ReactNode {
  const { houding, opDeHoek, deurmat } = chuck;
  // Nothing until he knows what he brought: a label that reads "Chuck slaapt" for a moment and then turns into a
  // balloon would say something that was never true.
  if (opDeHoek || deurmat.isPending) return null;
  if (houding.soort === "klaar" || houding.soort === "gevaar") {
    const zin = houding.soort === "gevaar" && houding.gevaar ? gevaarzin(houding.gevaar) : t("kat.zegtKlaar");
    return (
      <Ballon key={zin} staart={staart} pop className="max-w-[34ch]">
        {zin}
      </Ballon>
    );
  }
  return <span className="block max-w-[22ch] text-meta leading-tight text-inkt-zacht">{houdingzin(houding.soort)}</span>;
}

type Vensterstand = "dicht" | "komt" | "open";

function ZichtbareKatmand() {
  const chuck = useChuck();
  const { houding, opDeHoek } = chuck;
  const scene = useRef<SVGSVGElement>(null);
  const knop = useRef<HTMLButtonElement>(null);
  const venster = useRef<HTMLDivElement>(null);
  const vensterId = useId();
  const naast = useMediaQuery(VENSTER_NAAST);
  const loopje = useLoopje(scene);

  const [open, setOpen] = useState(false);
  // Out of his basket, or on his way back: he walks where his words stand, so they wait until he lies down again.
  const [onderweg, setOnderweg] = useState(false);
  const [stand, setStand] = useState<Vensterstand>("dicht");
  const openRef = useRef(false);
  const bezig = useRef(false);
  const terugNaUit = useRef<(() => void) | null>(null);
  const timer = useRef<number | null>(null);

  // His posture and the empty basket are classes on the drawing, set here rather than through `className`: a render
  // must never wipe the classes of a move that is under way.
  useLayoutEffect(() => {
    const el = scene.current;
    if (!el) return;
    for (const klasse of [...el.classList]) if (klasse.startsWith("houding-")) el.classList.remove(klasse);
    el.classList.add(houdingklasse(houding.soort));
    el.classList.toggle("leeg", opDeHoek);
  }, [houding.soort, opDeHoek]);

  useLevenInRust(scene, !opDeHoek);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const toonVenster = useCallback((meteen: boolean) => {
    setStand(meteen ? "open" : "komt");
    if (!meteen) requestAnimationFrame(() => requestAnimationFrame(() => setStand((s) => (s === "komt" ? "open" : s))));
  }, []);

  const openVenster = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    setOpen(true);

    // Lying on the week strip, he is not in the basket to step out of; with less motion he does not walk at all.
    if (minderBeweging() || opDeHoek || bezig.current) {
      toonVenster(true);
      return;
    }
    bezig.current = true;
    setOnderweg(true);
    loopje.stapUit({
      verdwijn: true,
      klaar: () => {
        bezig.current = false;
        const terug = terugNaUit.current;
        terugNaUit.current = null;
        terug?.();
      },
    });
    // The window opens while he is still stepping out: nobody waits for the cat.
    timer.current = window.setTimeout(() => {
      if (openRef.current) toonVenster(false);
    }, DUUR.vensterOpent);
  }, [loopje, opDeHoek, toonVenster]);

  const sluitVenster = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    setStand("dicht");
    if (timer.current !== null) window.clearTimeout(timer.current);
    // Focus returns at once: nobody on a keyboard waits for the cat.
    knop.current?.focus();

    if (minderBeweging() || opDeHoek) {
      loopje.zetStil(true);
      setOnderweg(false);
      return;
    }
    const terug = () => {
      bezig.current = true;
      loopje.stapTerug({
        verschijn: true,
        klaar: () => {
          bezig.current = false;
          setOnderweg(false);
        },
      });
    };
    // Closed while he is still stepping out: he walks back once he is out, never two moves at once.
    if (bezig.current) terugNaUit.current = terug;
    else terug();
  }, [loopje, opDeHoek]);

  // The window takes focus when it appears, on its close button: the first control, and the way out.
  const vensterZichtbaar = stand !== "dicht";
  useEffect(() => {
    if (vensterZichtbaar) venster.current?.querySelector<HTMLElement>("[data-sluit]")?.focus();
  }, [vensterZichtbaar]);

  useEffect(() => {
    if (!open) return;
    const bijToets = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        sluitVenster();
      }
    };
    document.addEventListener("keydown", bijToets);
    return () => document.removeEventListener("keydown", bijToets);
  }, [open, sluitVenster]);

  // Moving onto the week strip, or off it, while nothing is under way: he is simply there, in the basket or not.
  useEffect(() => {
    if (!openRef.current && !bezig.current) loopje.zetStil(true);
  }, [opDeHoek, loopje]);

  const naam = houdingzin(houding.soort);
  const vensterInhoud =
    stand === "dicht" ? null : (
      <Katvenster
        ref={venster}
        id={vensterId}
        chuck={chuck}
        komt={stand === "komt"}
        naast={naast}
        onSluit={sluitVenster}
      />
    );

  return (
    <div className="relative flex shrink-0 items-end gap-4">
      <div className="hidden pb-3 sm:block">{open || onderweg ? null : houdingstekst(chuck, "rechts")}</div>
      <button
        ref={knop}
        type="button"
        aria-label={t(open ? "kat.knopOpen" : "kat.knop", { houding: naam })}
        aria-expanded={open}
        aria-controls={open ? vensterId : undefined}
        onClick={() => (openRef.current ? sluitVenster() : openVenster())}
        className="relative block h-[62px] w-[94px] shrink-0 rounded-veld focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {/* The drawing lies over the header, not inside the button, so nothing clips him and he can walk past it. */}
        <Mandscene
          ref={scene}
          className="pointer-events-none absolute -bottom-[2px] -right-[5px] z-30 w-[174px] max-w-none"
        />
      </button>
      {naast ? vensterInhoud : vensterInhoud && createPortal(vensterInhoud, document.body)}
    </div>
  );
}
