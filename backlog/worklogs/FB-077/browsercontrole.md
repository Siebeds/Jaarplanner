# FB-077 — browser pass

Real app, own throwaway database `jp_fb077`, API on 5185, Vite on 5178, branch `ticket/FB-077-fichekleur`.
Seeded klas "L3 derde leerjaar (demo)", week 21–25 september 2026, with three blocks on one screen:

- `kringmoment`, an algemene fiche, Tuesday 8:30–9:20;
- `klasregels tekenen`, an activiteit wearing the teacher's colour **Olijf**;
- `kennismakingsspel`, an activiteit **without** a colour, which is the ground the fiche has to be told from.

## What the browser measured

Contrast computed from `getComputedStyle`, compositing as rendered (jsdom cannot do this).

| | light | dark |
|---|---|---|
| fiche ground | `rgb(220 223 229)` | `rgb(10 12 15)` |
| colourless activiteit ground | `rgb(245 246 248)` | `rgb(22 25 31)` |
| name on the fiche | **13.32:1** | **16.1:1** |
| fiche icon on its ground | 4.21:1 | 7.09:1 |
| fiche ground against a colourless activiteit | 1.23:1 | 1.12:1 |

The first try used the `vlak-diep` token unchanged and measured **1.09:1** against a colourless activiteit: visible
side by side, invisible scattered over a week. That is why the ground is now a step deeper, with its `dark:` half
written by hand (`features/algemene-fiches/merk.ts` says why).

Screen reader: the block's accessible name is `kringmoment, 8:30 - 9:20, algemene fiche`, an activiteit's is
`kennismakingsspel, 8:30 - 9:20`. Only the fiche's own button holds an icon; the info icon beside a block is a
sibling of it and both kinds have one.

## Widths

- Desktop 1440: `fb077-week-desktop.png` (light), `fb077-donker.png` (dark).
- 390px: `fb077-390-zijbalk.png`. The panel becomes a bottom sheet and the card keeps the ground, the icon and the name.

**One defect, and it is not new.** At 390px, when two blocks share one day, a block is about 40px wide and its
content row is 4.4px, so the fiche icon is clipped to a third of itself; the ground still carries. The cause is the
28px `pr-7` reserved for the info icon (FB-018), which clips the NAME of any block, fiche or activiteit, the same
way. A fiche alone on its day at 390px has a 50.4px content row and shows its icon whole. Recorded as **TB-060**
rather than fixed here.
