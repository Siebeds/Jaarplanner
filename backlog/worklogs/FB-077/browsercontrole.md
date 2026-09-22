# FB-077 — browser pass

Real app, own throwaway database `jp_fb077`, API on 5185, Vite on 5178, branch `ticket/FB-077-fichekleur`.
Seeded klas "L3 derde leerjaar (demo)", week 21–25 september 2026, with three blocks on one screen:

- `kringmoment`, an algemene fiche, Tuesday 8:30–9:20;
- `klasregels tekenen`, an activiteit wearing the teacher's colour **Olijf**, on that same Tuesday;
- `kennismakingsspel`, an activiteit **without** a colour, on Wednesday, which is the ground the fiche has to be
  told from.

## What the browser measured

Contrast computed from `getComputedStyle`, compositing as rendered (jsdom cannot do this).

| | light | dark |
|---|---|---|
| fiche ground | `rgb(220 223 229)` | `rgb(10 12 15)` |
| colourless activiteit ground | `rgb(245 246 248)` | `rgb(22 25 31)` |
| name on the fiche (`inkt`) | **13.32:1** | **16.1:1** |
| every smaller line on it (`inkt-zacht`: the time, the word "algemene fiche", a description) | **4.88:1** | **9.3:1** |
| fiche icon on its ground | 4.21:1 | 7.09:1 |
| fiche ground against a colourless activiteit | 1.23:1 | 1.12:1 |

The first try used the `vlak-diep` token unchanged and measured **1.09:1** against a colourless activiteit: visible
side by side, invisible scattered over a week. That is why the ground is a step deeper, as `--color-fiche-vlak` and
`--color-fiche-lijn` in `index.css`, which the dark-value guard in `state/weergave.test.ts` can see.

Screen reader: the block's accessible name is `kringmoment, 8:30 - 9:20, algemene fiche`, an activiteit's is
`kennismakingsspel, 8:30 - 9:20`. Only the fiche's own button holds an icon; the info icon beside a block is a
sibling of it and both kinds have one.

## Widths

- Desktop, viewport 1440×900: `fb077-week-desktop.png` (light) and `fb077-donker.png` (dark; captured at 1055×667,
  before the ground was deepened, so read it for the order of the planes and not for the exact value).
- 390×844: `fb077-390-zijbalk.png`. The panel becomes a bottom sheet and the card keeps the ground, the icon and the
  name.

**One defect, and it is not new.** A block that shares its day with another is half a column wide, and its content
row is clipped. What that costs depends on the width:

- at 1440 the fiche keeps its icon and its ground, and the **name** is clipped to "k…" (the activiteit beside it is
  clipped to "klas…" the same way);
- at 390 the row is 4.4px and the **icon** is clipped to a third as well; only the ground still carries. A fiche
  alone on its day at 390 has a 50.4px row and shows icon and name whole.

The cause is the 28px `pr-7` reserved for the info icon (FB-018), which clips the name of any block, fiche or
activiteit, at both widths. Recorded as **TB-060** rather than fixed here.
