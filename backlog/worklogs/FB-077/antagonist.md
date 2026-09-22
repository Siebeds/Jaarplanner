# FB-077 — antagonist, round 1

**Verdict: COMPLIANT.** No CRITICAL, no MAJOR. Five MINOR findings; four are fixed, one is the owner's to answer.

| # | finding | what was done |
|---|---|---|
| 1 | The worklog and TB-060 scoped the narrow-block defect to 390px, while the commit's own desktop screenshot shows the same clipping. | Fixed. Both now say what each width costs: at 1440 the name, at 390 the icon as well. TB-060 lost its false "desktop has room enough" line and gained a criterion for the wide case. |
| 2 | The pass claimed "Desktop 1440" for screenshots captured at 1055×667. | Fixed. Re-captured at a real 1440×900 viewport; the dark one is labelled with the width it was actually taken at. |
| 3 | Acceptance criterion 3 names "de tekst op een algemene fiche" but the evidence measured the name only. | Fixed. Every smaller line on the ground is `text-inkt-zacht`: measured 4.88:1 light and 9.3:1 dark, so the criterion holds on all of it. |
| 4 | `FICHEVLAK` was two raw `hsl()` literals. The precedent in `activiteiten/kleuren.ts` argues for literals because those six mean whatever the teacher decided; this one means *algemene fiche*, so the argument points the other way. | Fixed. It is now `--color-fiche-vlak` / `--color-fiche-lijn` in `index.css`, with its reasoning there and a dark value the guard in `state/weergave.test.ts` can see. The browser renders the same values as before the refactor. |
| 5 | Criterion 1 promises "een andere **kleur**", and what shipped is a neutral one step deeper, by the owner's own ruling. The ticket text was never restated to match. | **Left to the owner.** The ruling is in the Werklog; whether the criterion and the title should be reworded is his call, not this session's. |
