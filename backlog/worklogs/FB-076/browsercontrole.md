# FB-076 — browser pass

Real app, own throwaway database `jp_fb077`, API on 5185, Vite on 5178, branch `ticket/FB-076-ingepland`.
Klas "L3 derde leerjaar (demo)", week 21–25 september 2026, subthema "Onze klasafspraken" with two own activiteiten.

## Every criterion, and what was done to it

| criterion | what happened in the browser |
|---|---|
| a planned activiteit carries a rule, an icon and its day | `klasregels tekenen` showed the rule, the agenda icon and "Ingepland op di 22 sep". |
| an unplanned one carries nothing | after its last placement was removed, the card had no rule and no sentence at all. |
| the marking goes when it is taken off the agenda, **without a reload** | right-click the block, "Van deze dag halen": the sentence went from "di 22 sep en do 24 sep" to "do 24 sep" on its own, and after the second removal the marking disappeared entirely. Nothing was reloaded. |
| two days are both named | planned on Tuesday and Thursday, the card read "Ingepland op di 22 sep en do 24 sep". Three or more prints the count and the first day, which is pinned in `ingepland.test.ts` instead: it is a sentence, not a rendering. |
| the marking's text clears 4.5:1, measured in the browser | **6.08:1** light, **8.44:1** dark. |

## What else was measured

The rule is `inkt-zwak`, which is not text, so what it owes is 3:1 (WCAG 1.4.11): **4.64:1** light
(`rgb(106 112 124)` on `rgb(246 247 249)`) and **6.44:1** dark (`rgb(150 156 166)` on `rgb(21 24 30)`).

Dark was checked by setting the preference **before** loading the page. Toggling `data-weergave` on a live page gave
a card that measured light while `:root` measured dark; a reload in dark shows every token applied correctly, so that
was an artefact of the runtime toggle and not a defect. Recorded because it wasted a measurement, and would waste the
next one.

## Widths

- Desktop, viewport 1440×900: `fb076-zijbalk.png`. Both cards marked, "Ingepland op di 22 sep en do 24 sep" wrapping
  to two lines without crowding the name.
- 390×844: `fb076-390.png`. The panel is a bottom sheet; the marked card keeps its rule, its icon and its day, and the
  unmarked one beside it stays plain.
