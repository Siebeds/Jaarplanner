# TB-022: antagonist, round 1

**Verdict:** COMPLIANT. No CRITICAL or MAJOR finding. Scope `2e1db98..9811f01`.

## The six questions put to the audit

1. **Withheld-figure gate.** It holds. `metCijfers` hides every tally, bar, `sr-only` tally sentence and the whole action
   list, and the disciplines sort by number without figures. Counting rows stays possible, as it always was: the owner
   ruled on 2026-08-06 that the 2026-07-28 ruling covers the figure, not the per-goal verdicts.
2. **Copy truthfulness.** Every sentence holds under its render condition, including "Staat in geen periode van het
   jaarplan" (never placed or stale: `PlanScherm` draws a card only under a current period's start).
3. **Non-additive counts.** Nothing on screen suggests a sum.
4. **Rights.** `doelsuggestiesBeoordelen` is right for every state the build can produce: the only writer of a
   `voorgesteld` DoelKoppeling today is `DoelMatchingService` (layer 2). Widen it if a later path writes proposed
   subdoel or activiteit links.
5. **ADR-0021.** Acceptable. The selection lives in a persisted Zustand store, and plain `/agenda/periodes` links
   already exist elsewhere. The gap between ADR-0021 decision 2 and the code predates this ticket.
6. **Constitution.** Art. V.1, III, VIII, VI, II.3 and II.5 are respected, the export is untouched, and Art. V.6 tests
   were added.

## Non-blocking findings and what was done

| Finding | Done |
| --- | --- |
| MINOR: a literal NUL byte in the map key made git treat `overzicht.ts` as binary | Key is now `JSON.stringify([soort, thema])` |
| MINOR: "Herbekijk de weigering" points at an undo control the rebuilt card no longer has | Copy is now "Plan {thema} alsnog in" |
| MINOR: the heading "Waar je nog aan kan werken" also shows to readers without any right | Heading is now "Wat nog ontbreekt" |
| MINOR: the "Naar Thema's" link was never asserted | Fixture with a KoppelingNietBeslist goal, asserted present for directie and absent for a klas teacher without the right |
| MINOR: `Leergebied` names a discipline, a word Art. XII/VII.0 reserve for a grouping over disciplines | Renamed to `Disciplinegroep`, `groepeerPerDiscipline`, `sorteerDisciplines`; the owner's word "leergebied" is quoted where the ruling is cited |
| MINOR: comments said planning cannot close a GeenThema goal | Corrected: no thema action closes it, a planned algemene fiche still can |
| MINOR: `Dekkingsmeter` recomputed the gate | It now receives the figure only when `metCijfers` allows it |
| QUESTION: Art. V.3 requires a doelsoort filter, which the screen has lacked since the ADR-0024 rebuild and the owner kept out on 2026-09-15 | For the owner: amend Art. V.3 or plan a ticket |
