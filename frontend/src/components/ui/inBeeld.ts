import { useEffect, useRef } from "react";

/**
 * Brings an element into view once, when it appears, without taking focus.
 *
 * For a sheet's own failure alert (E6-02 slice 4, fix round 2, F7). On a phone the sheet is a bottom sheet with its own
 * scroll, and a failure line under the form lands below what is visible (measured at 390×844: 866 to 918 of 844).
 * `role="alert"` announces it; this shows it. `nearest` moves the sheet only as far as needed, and focus stays in the
 * form the teacher is in. An optional call, because jsdom has no `scrollIntoView`.
 */
export function useInBeeld<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  return ref;
}
