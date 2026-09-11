import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Light, dark, or whatever the device says (ADR-0027).
 *
 * Per browser and not per teacher: it lives in localStorage, like the class selection, because it is
 * a view preference and not school data. A school laptop in a bright classroom and the same
 * teacher's tablet on the sofa can reasonably want different answers.
 *
 * `systeem` is the default and stamps nothing. The stylesheet answers it on its own through
 * `prefers-color-scheme`, so a teacher who never opens Instellingen gets the device's choice with no
 * script involved at all. Only an explicit choice writes `data-weergave` on <html>, and the `dark`
 * variant in `index.css` reads exactly that attribute.
 *
 * **`index.html` reads this store's storage before the stylesheet paints**, so a teacher who chose
 * dark on a light device never sees a white flash first. That script knows the key
 * `jaarplanner-weergave` and zustand's `{ state: { keuze } }` shape; `weergave.test.ts` pins both, so
 * renaming either here fails a test instead of quietly reintroducing the flash.
 */
export type Weergave = "systeem" | "licht" | "donker";

interface WeergaveState {
  keuze: Weergave;
  kies: (keuze: Weergave) => void;
}

export const useWeergave = create<WeergaveState>()(
  persist(
    (set) => ({
      keuze: "systeem",
      kies: (keuze) => set({ keuze }),
    }),
    { name: "jaarplanner-weergave" },
  ),
);

function pasToe(keuze: Weergave) {
  const html = document.documentElement;
  if (keuze === "systeem") delete html.dataset.weergave;
  else html.dataset.weergave = keuze;

  // The browser's own chrome (the address bar on a phone, the task switcher on a tablet) takes its
  // colour from this meta. Read back from the page rather than written here, so the one place a
  // colour is defined stays `index.css`.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const vlak = getComputedStyle(document.body).backgroundColor;
  if (meta && vlak) meta.content = vlak;
}

pasToe(useWeergave.getState().keuze);
useWeergave.subscribe((state) => pasToe(state.keuze));

// While following the device, the device can change its mind (an automatic evening switch), and the
// stylesheet follows that by itself. Only the meta above needs telling.
if (typeof window.matchMedia === "function") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => pasToe(useWeergave.getState().keuze));
}
