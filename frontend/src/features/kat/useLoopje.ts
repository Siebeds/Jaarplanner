import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { DUUR, PAS } from "./rig";

/**
 * What Chuck does between his postures (FB-071): stand up, step out paw by paw, walk a cycle; turn round, walk back,
 * step in, turn round in the basket and lie down. Each step is a class on the scene element, whose keyframes come from
 * `choreografie.ts`; this only sequences them.
 *
 * **The static state is set in the same tick as the animation class is removed** (`buiten`, `omgedraaid`), or he
 * jumps back to where he started when the animation lets go. Every timer is tracked and cleared on unmount.
 */
export function useLoopje(scene: RefObject<SVGSVGElement | null>) {
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const lopend = timers.current;
    return () => {
      for (const id of lopend) window.clearTimeout(id);
      lopend.clear();
    };
  }, []);

  const na = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const zet = useCallback((el: SVGSVGElement, naam: string, waarde: string) => el.style.setProperty(naam, waarde), []);

  /** Lying or standing, without moving: what reduced motion and a sudden change of posture use. */
  const zetStil = useCallback(
    (ligt: boolean) => {
      const el = scene.current;
      if (!el) return;
      for (const id of timers.current) window.clearTimeout(id);
      timers.current.clear();
      el.classList.remove("rijst", "uit", "loopt", "in", "zakt", "buiten", "omgedraaid");
      zet(el, "--stapduur", "0ms");
      zet(el, "--stap-x", "0px");
      zet(el, "--kijkduur", "0ms");
      zet(el, "--staduur", "0ms");
      zet(el, "--lig-op", ligt ? "1" : "0");
      zet(el, "--sta-op", ligt ? "0" : "1");
    },
    [scene, zet],
  );

  /** Up in the basket, out over the rim, and one walk cycle. With `verdwijn` he fades while he walks. */
  const stapUit = useCallback(
    ({ verdwijn, klaar }: { verdwijn: boolean; klaar?: () => void }) => {
      const el = scene.current;
      if (!el) return;
      zet(el, "--staduur", "150ms");
      el.classList.remove("loopt", "zakt", "in", "buiten", "omgedraaid");
      el.classList.add("rijst");
      zet(el, "--lig-op", "0");
      zet(el, "--sta-op", "1");

      na(DUUR.opstaan, () => {
        el.classList.remove("rijst");
        el.classList.add("uit");
        na(DUUR.uitstappen, () => {
          el.classList.add("buiten");
          el.classList.remove("uit");
          el.classList.add("loopt");
          zet(el, "--stapduur", `${DUUR.lopen}ms`);
          zet(el, "--stap-x", `${-PAS}px`);
          // He fades WHILE he walks: that reads as walking out of view, not as vanishing.
          if (verdwijn) {
            na(DUUR.lopen * 0.3, () => {
              zet(el, "--staduur", `${Math.round(DUUR.lopen * 0.7)}ms`);
              zet(el, "--sta-op", "0");
            });
          }
          na(DUUR.lopen, () => {
            el.classList.remove("loopt");
            klaar?.();
          });
        });
      });
    },
    [na, scene, zet],
  );

  /** Turn round, walk back, step in, turn round in the basket and lie down. With `verschijn` he fades in walking. */
  const stapTerug = useCallback(
    ({ verschijn, klaar }: { verschijn: boolean; klaar?: () => void }) => {
      const el = scene.current;
      if (!el) return;
      const lopen = () => {
        el.classList.add("loopt");
        zet(el, "--stapduur", `${DUUR.lopen}ms`);
        zet(el, "--stap-x", "0px");
        if (verschijn) {
          zet(el, "--staduur", `${Math.round(DUUR.lopen * 0.5)}ms`);
          zet(el, "--sta-op", "1");
        }
        na(DUUR.lopen, () => {
          el.classList.remove("loopt");
          el.classList.add("in");
          na(DUUR.instappen, () => {
            el.classList.remove("in", "buiten");
            // In the basket he turns round before he lies down, as a cat does.
            zet(el, "--kijkduur", `${DUUR.omdraaien}ms`);
            el.classList.remove("omgedraaid");
            na(DUUR.omdraaien + 60, () => {
              el.classList.add("zakt");
              na(DUUR.gaanLiggen, () => {
                el.classList.remove("zakt");
                zet(el, "--staduur", "150ms");
                zet(el, "--lig-op", "1");
                zet(el, "--sta-op", "0");
                klaar?.();
              });
            });
          });
        });
      };

      if (verschijn) {
        // Turn round unseen, then become visible while already walking.
        zet(el, "--kijkduur", "0ms");
        el.classList.add("omgedraaid");
        na(30, lopen);
      } else {
        zet(el, "--kijkduur", `${DUUR.omdraaien}ms`);
        el.classList.add("omgedraaid");
        na(DUUR.omdraaien + 80, lopen);
      }
    },
    [na, scene, zet],
  );

  return useMemo(() => ({ stapUit, stapTerug, zetStil }), [stapUit, stapTerug, zetStil]);
}

/** Whether the viewer asked for less motion. Read at the moment of acting, so a change in the system applies at once. */
export function minderBeweging(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const tussen = (laag: number, hoog: number) => laag + Math.random() * (hoog - laag);

/**
 * Idle life on the one visible cat: an ear flick every 5.2 to 13 s and, when his eyes are open, a blink every 3.4 to
 * 9 s. A cat that breathes identically every 4.4 s reads as a machine; these cost nothing and do the most.
 */
export function useLevenInRust(kat: RefObject<SVGSVGElement | null>, actief: boolean) {
  useEffect(() => {
    if (!actief) return;
    const lopend = new Set<number>();
    const na = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        lopend.delete(id);
        fn();
      }, ms);
      lopend.add(id);
    };
    const eenmaal = (klasse: string, duur: number) => {
      const el = kat.current;
      if (!el || minderBeweging() || document.hidden) return;
      el.classList.add(klasse);
      na(duur, () => el.classList.remove(klasse));
    };
    const tik = () =>
      na(tussen(5200, 13000), () => {
        eenmaal("tikt", 440);
        tik();
      });
    const knipper = () =>
      na(tussen(3400, 9000), () => {
        const el = kat.current;
        if (el && getComputedStyle(el).getPropertyValue("--oog-open").trim() === "1") eenmaal("knippert", tussen(110, 170));
        knipper();
      });
    tik();
    knipper();
    return () => {
      for (const id of lopend) window.clearTimeout(id);
    };
  }, [actief, kat]);
}
