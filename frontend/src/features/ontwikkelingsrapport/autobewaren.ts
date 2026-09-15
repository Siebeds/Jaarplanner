import { useCallback, useEffect, useRef, useState } from "react";

/** Where an automatic save stands: nothing to do yet, on its way, done, or refused. */
export type Bewaarstand = "rust" | "bezig" | "bewaard" | "fout";

/**
 * Saving as the teacher works, with no save button (FB-003): a choice right away, typing after a pause or when the
 * field is left. Twenty children times three reports is too much work to lose to a forgotten button.
 *
 * - **One save at a time, and the last value wins.** A change made while a save is on its way is sent after it, so two
 *   requests for the same field never race and the server always ends on what is on screen.
 * - **Nothing is sent when nothing changed** (`gelijk` against what was last saved), so leaving a field untouched costs
 *   no request.
 * - **A pending change is sent when the part unmounts** (another moment or child opened in between), and the browser
 *   asks before a reload or close while one is still open.
 * - **A refusal stays on screen** with what the server said, and the next change, or `opnieuw`, tries again.
 */
export function useAutobewaren<T>(
  begin: T,
  bewaar: (waarde: T) => Promise<unknown>,
  gelijk: (a: T, b: T) => boolean,
  wachttijd = 1200,
) {
  const opgeslagen = useRef(begin);
  const laatste = useRef(begin);
  const bezig = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bewaarRef = useRef(bewaar);
  const [stand, setStand] = useState<Bewaarstand>("rust");
  const [fout, setFout] = useState<unknown>(null);

  useEffect(() => {
    bewaarRef.current = bewaar;
  });

  const pomp = useCallback(async () => {
    clearTimeout(timer.current);
    if (bezig.current) return;
    bezig.current = true;
    let bewaard = false;
    try {
      while (!gelijk(laatste.current, opgeslagen.current)) {
        setStand("bezig");
        const waarde = laatste.current;
        await bewaarRef.current(waarde);
        opgeslagen.current = waarde;
        bewaard = true;
      }
      if (bewaard) {
        setFout(null);
        setStand("bewaard");
      }
    } catch (reden) {
      setFout(reden);
      setStand("fout");
    } finally {
      bezig.current = false;
    }
  }, [gelijk]);

  const zet = useCallback(
    (waarde: T, wanneer: "nu" | "straks") => {
      laatste.current = waarde;
      clearTimeout(timer.current);
      if (wanneer === "nu") void pomp();
      else timer.current = setTimeout(() => void pomp(), wachttijd);
    },
    [pomp, wachttijd],
  );

  useEffect(() => {
    const vraagBijVertrek = (gebeurtenis: BeforeUnloadEvent) => {
      if (bezig.current || !gelijk(laatste.current, opgeslagen.current)) gebeurtenis.preventDefault();
    };
    window.addEventListener("beforeunload", vraagBijVertrek);
    return () => {
      window.removeEventListener("beforeunload", vraagBijVertrek);
      // Leaving the part: what was typed but not yet sent goes now rather than being dropped with the timer.
      void pomp();
    };
  }, [gelijk, pomp]);

  return { stand, fout, zet, opnieuw: pomp };
}
