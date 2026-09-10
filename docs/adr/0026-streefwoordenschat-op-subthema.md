# ADR-0026 — Streefwoordenschat is a third vocabulary list, on the subthema

- **Status:** Proposed
- **Date:** 2026-08-30
- **Deciders:** Project owner (ruling of 2026-08-30, recorded below). **Directie/leerkrachten have not confirmed
  the pedagogy** — the question is filed as question 10 in [`docs/besluiten-gevraagd.md`](../besluiten-gevraagd.md).
- **Relates to:** [ADR-0025](0025-subthema-per-leeftijd.md) (a subthema is scoped by leeftijd alone), which this
  decision depends on completely and **supersedes nothing**. It also touches
  [ADR-0024](0024-single-frontend-inkt-en-signaal.md) (the palette and the rationed accent) and
  [ADR-0023](0023-activiteit-day-placement.md) (the day-placement axis the agenda draws its subthema bands from).
- **Realises:** F9 from the project owner's meeting notes. **Constitution:** Art. II.3 (language),
  Art. III (school content is autonomous and fully editable), Art. IX.2 (level-dependent scoping),
  Art. V.1 (coverage is computed, never stored), Art. XII (colour never alone).
- **Backlog:** [E10-01](../../backlog/E10-eigenaarsvergadering.md).

> **ADR-0025 is cited above and does not exist yet.** Session `verbeteringen` built the change on 2026-08-30 and
> `Subthema.cs` already cites the number in its own docstring; the ADR itself is still to be written. This one is
> `Proposed` and unbuildable until that lands, so the dangling link is a dependency rather than an oversight.

## Context

The owner brought back a request from a meeting: *streefwoordenschat* — the vocabulary a teacher aims for —
recorded on the **subthema**, reachable from the agenda, and editable in the agenda itself rather than only in
the beheer screens.

The model already has vocabulary, and it has two lists, both on `Thema` and both **school-wide** (Art. IX.2):

| List | Lives on | Scope | Means |
| --- | --- | --- | --- |
| `kernwoordenschat[]` | `Thema` | school-wide | the basiswoorden every child ends up with |
| `rijkeWoordenschat[]` | `Thema` | school-wide | the stretch, the rich theme words |

So the request reads two ways, and they are not the same feature:

1. **A third list**, at a level neither existing list reaches.
2. **The existing rijke woordenschat, re-scoped downward** — the same idea, but narrower than school-wide.

**The framing that came with the request was one day out of date, and the correction matters.** It described the
subthema level as *"klas- en leeftijdsgebonden"*, which is what Art. IX.2 says in the text still on `main`. On
this branch it is no longer true: **ADR-0025 removed `Subthema.KlasId` on 2026-08-30**, so a subthema hangs on a
leeftijd alone (`JK`, `K2`, `K3`, `L1`–`L6`) and holds for **every klas that teaches that age**. Reading 2 was
therefore proposed as *"rijke woordenschat, but per klas"*, and **per klas is not a shape the model still offers
at this level.** The realistic pair is *school-wide* versus *per leeftijd*, which is a much smaller gap than the
one the question was asked across.

## Decision

### 1. Streefwoordenschat is a **third list**, and it lives on `Subthema`

```
Thema  (school-wide)
  kernwoordenschat[]      basiswoorden, unchanged
  rijkeWoordenschat[]     the stretch, unchanged
  |
  +-- Subthema  (leeftijd: K3)
        streefwoordenschat[]   <- new
        onderzoeksvragen[]
        subdoelen[]
        activiteiten[]
```

`List<string>`, ordered as entered, mapped exactly as the two thema lists already are. The two thema lists are
**not touched, not moved and not deprecated**, so there is **no data migration** and nothing a school has already
typed can be lost by this change. That is the whole reason the third-list reading was chosen over the re-scoping
one: the re-scoping option has to fan every existing thema list out across N subthema's, and it would take the
school-wide stretch list away from the thema, which nobody asked for.

**The list therefore holds for every klas of that leeftijd.** Two K3 classes share one list. This is the direct
and intended consequence of ADR-0025 and it is **the single most surprising thing about the feature** — see
decision 5 and decision 7, which exist only to make it visible in the interface.

### 2. Its meaning is the selection, and the docstring says so

Kernwoordenschat is what every child ends up with; rijke woordenschat is the thema's stretch; **streefwoordenschat
is what this age is actually aiming for in these two weeks.** The three are not a hierarchy and the model must not
imply one: there is no containment rule, no validation that a streefwoord appears in either thema list, and no
derivation. A teacher may aim for a word the thema never listed. **Art. III** settles this — school content is the
school's, and a tool that refused a word because it was not in a list the school also authored would be inventing
a rule nobody stated.

### 3. No new endpoint, and no new read model

- **Write:** `streefwoordenschat` joins `SubthemaWijzigingInvoer` on the existing
  `PUT /api/subthemas/{subthemaId}`. One writer for the field.
- **Read:** it joins `SubthemaWeergave`, which the thema endpoints already nest and which the agenda already
  fetches through `useThemaVoorKlas` — that is exactly how `Activiteitblad` resolves the subthema of the
  activiteit it is showing today.

**A dedicated `PUT .../streefwoordenschat` was considered and rejected**, even though it is the narrower verb. It
would make the field the only one on `Subthema` with two write paths, and this repo has already paid for that
shape: `Activiteitblad`'s docstring records a sheet whose payload defaulted four fields to `null`, so a form that
prefilled from a partial row **erased them on the first save**. One endpoint, one payload, and the rule that
already followed from it — *the full record has to arrive before the form may open* — carries over unchanged to
the new sheet.

### 4. The weekplanning payload does **not** carry the words

`Weekplanning` gains nothing. `GeplandeActiviteit` and `Subthemaperiode` already carry `subthemaId` and `themaId`,
which is everything the agenda needs to *reach* the words; it does not need to *hold* them, because decision 5
puts them behind a press rather than on the grid.

Putting them on the activiteit row would duplicate the whole list once per activiteit on a day. Putting them on
`Subthemaperiode` would cover only the runs a teacher explicitly marked off — `subthemareeksen` also derives runs
from placed activiteiten alone, so half the bands would have words and half would not, for a reason no teacher
could see.

### 5. **The calendar strip stays decorative. The doorklik is one control per run, not per day.**

This is the load-bearing UI decision, and the obvious design is wrong.

`Subthemastroken` draws a strip on the top edge of **every day** a subthema covers. It is `aria-hidden="true"` and
`pointer-events-none`, and both are documented choices: the day's own button already names what runs on it, so a
second reading per cell across forty cells is what makes a calendar unusable with a screen reader. Turning the
strip into the button breaks three things at once:

1. **A five-day run becomes five buttons to one destination.** In a month holding two subthema's that is roughly
   forty extra tab stops, all duplicates.
2. **It puts the subthema back in the accessibility tree twice per cell**, which is the exact defect `aria-hidden`
   was added to fix.
3. **It fails WCAG 2.2 AA SC 2.5.8 (Target Size, Minimum).** The strip is `h-5` (20px), and `h-4` (16px) in the
   month cell. Both are under 24px, and neither can grow: a cell that spends half its height on strips has stopped
   being a day.

So the strip keeps doing the one job it is good at, which is showing *where* a subthema runs. The entry point is a
**rail of the subthema runs in view**, one row each, above the grid: the name, the run's dates, and the first few
streefwoorden as chips with a count. One correctly-sized, correctly-labelled control per run.

> **This is not the chip that was removed, and an audit will otherwise read it as a regression.** `Maandrooster`
> used to append a line naming the subthema, and it was deleted because it appeared **only when every activiteit
> in view belonged to one subthema** — so in any month holding two, the line naming the subthema simply vanished.
> What failed was the all-or-nothing condition, not the position. A rail listing **every** run in view has no such
> condition and cannot vanish. It also gives a screen-reader user the first readable answer to *"which subthema's
> am I in this week"*, which the strips, being `aria-hidden`, never gave.

A **second** entry point sits in `Activiteitblad`, which already resolves its subthema: a teacher standing in an
activiteit is exactly who wants to know what the words are. Both open the same sheet.

### 6. The sheet shows all three lists, and only one of them is editable

`Subthemablad`, built on `Blad` like `Activiteitblad`:

```
+--------------------------------------------------+
| de speelhoek                              K3   x |
| 8 sep - 19 sep                                   |
+--------------------------------------------------+
| STREEFWOORDEN                                 8  |
| +----------------------------------------------+ |
| | (wind x) (regen x) (wolk x) (paraplu x)      | |
| | (donder x) (bliksem x)   volgend woord...    | |
| +----------------------------------------------+ |
| Deze woorden horen bij het subthema voor K3.     |
| Elke klas die K3 geeft, werkt met deze lijst.    |
|                                                  |
| VAN HET THEMA                                    |
| Kernwoordenschat                                 |
|  [weer] [warm] [koud] [nat]                      |
| Rijke woordenschat                               |
|  (neerslag) (temperatuur) (voorspelling)         |
|                                                  |
|                        Annuleren    Bewaren      |
+--------------------------------------------------+
```

- **The editor is the existing `Woordchips`**, unchanged. It was built for exactly this shape and its paste
  handling is the reason it exists: vocabulary lists arrive comma-separated from a Word document, and a textarea
  turns eight words into one.
- **The thema's two lists are read-only context, not clutter.** A teacher choosing streefwoorden is choosing them
  beside the thema's vocabulary, and showing the three together is what makes a three-list model legible instead
  of confusing. They are read-only *here* because they are school-wide (Art. IX.2) and this sheet is opened from
  one class's agenda; the thema page keeps editing them.
- **Three lists, three treatments, no new hue** (Art. XII, and ADR-0024 rations the accent to five uses that this
  is not one of). The distinction is carried by the control, which is the strongest signal available and needs no
  colour at all: streefwoorden sit **inside a bordered input box, with a × on every chip and a caret**, which is
  what "you may edit this" looks like; the thema's lists are static chips with no box, **filled** for
  kernwoordenschat and **outlined** for rijke woordenschat — the weight distinction `Woordchips`' `gevuld` prop
  already encodes and the thema form already uses.

### 7. The scope sentence is unconditional, and it may not overreach

*"Deze woorden horen bij het subthema voor K3. Elke klas die K3 geeft, werkt met deze lijst."*

- **Unconditional**, and therefore **out of scope for E9-01's "Uitleg tonen" switch.** It is a consequence
  disclosure about what a save affects, not instruction, and E9-01's own rule keeps those on screen whatever the
  switch says.
- **It asserts only what the model guarantees** (the E5-03 rule). The tempting sentence is *"Ook K3 blauw werkt
  met deze lijst"*, and the sheet cannot promise that: it does not know whether a second K3 class exists. Naming
  the sibling class is the better copy **only** behind a count the payload does not carry today.
  `ThemaBibliotheekItem.aantalAfgeleideKlassen` shows the codebase already counts this kind of thing, so it is a
  cheap follow-up and deliberately not v1.
- No em dashes (owner, 2026-07-29). Every string goes in `nl.json` (Art. II.3).

### 8. Dekking does not move, and a test pins the absence

Art. V.1 makes a doel gedekt through a **placement of the thema**, and a word is not a doel. Adding a streefwoord
changes no figure anywhere. This is stated as a decision rather than left implicit because ADR-0023 had to make
the same promise about day placements, and the failure mode is identical: anything that later wires a count to a
vocabulary list would let the tool claim coverage for content no leerplandoel was ever linked to.

## Consequences

**Good.** Purely additive: one column, one migration, no data migration, no endpoint, no read-model growth, and
nothing a school has typed can be lost. The teacher gets the words where the work happens. The three-list model
becomes visible on one sheet instead of being inferred from three screens.

**Bad, and worth saying plainly.**

- **A third vocabulary list is a third thing to explain**, on a tool the directie has already said has too much on
  screen (CR1, E9-01). The sheet answers that by showing all three at once rather than adding a third place to
  look, but it does not make the count two.
- **A K3-groen teacher edits K3-blauw's list, and the interface has to carry that.** Decision 7 is a sentence, and
  a sentence is weaker than a mechanism. If the leerkrachten answer question 10 by saying the list must be
  personal, the fix is the per-klas entity this ADR rejected, and that is a rebuild of the storage rather than an
  adjustment.
- **A rail above the grid costs vertical space** on a screen where CR2 asked for more room, not less. It is
  justified only because it shows **data** (words) rather than prose, which is the CR1 rule's own distinction. If
  it grows a sentence, it has failed.

**Neutral.** The strip's `aria-hidden` and `pointer-events-none` stay, so `Subthemastroken` needs no change at
all. That is a consequence of decision 5 and part of the reason it was chosen.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| **Move `rijkeWoordenschat` from `Thema` down to `Subthema`** | No third list, which is tidier, but it needs a data migration that fans each existing thema list out across N subthema's, and it takes the school-wide stretch list away from the thema. Nobody asked for either. It is also irreversible in practice: once fanned out and edited per age, the original school-wide list cannot be reconstructed. |
| **A per-`(Subthema × Klas)` list** | Gives each teacher their own words, which is what "per klas" originally meant. It costs a new entity and a join, and it reopens the line ADR-0025 drew one day earlier: **content is per leeftijd, planning is per klas.** Defensible only if streefwoordenschat is planning rather than content, and it is content. Kept on the table because question 10 could turn it into the answer. |
| **UI only: make the existing rijke woordenschat editable from the agenda** | Cheapest by far, and it delivers the agenda half of the request immediately. But rijke woordenschat is school-wide, so a K3 teacher editing it from their own agenda would silently change the L6 teacher's list too. Strictly worse than decision 1 on the exact axis that makes decision 1 uncomfortable. |
| **Make the calendar strip the button** | The direct reading of "doorklikbaar vanuit de agenda", and it fails SC 2.5.8 at 16–20px, multiplies one destination into one button per day, and re-duplicates the subthema in the accessibility tree. See decision 5. |
| **Put the words on the strip itself** | A 16px strip already truncates the subthema name. A count beside it fights the one thing the strip exists to say. |

## Compliance trace

| Claim | Where |
| --- | --- |
| School content is autonomous and fully editable; no containment rule is imposed | Art. III, decision 2 |
| Level-dependent scoping: the list sits at the level Art. IX.2 assigns to age-differentiated content | Art. IX.2, decision 1 |
| Dekking stays computed and does not move | Art. V.1, decision 8 |
| Every user-facing string is Dutch and lives in `nl.json`; no em dashes | Art. II.3, decision 7 |
| Three lists distinguished without a new hue; state never carried by colour alone | Art. XII / ADR-0024, decision 6 |
| Target size, and the accessibility tree not doubled | WCAG 2.2 AA SC 2.5.8, decision 5 |
| The pedagogy is **not** ratified here | Art. XIV; question 10 in `docs/besluiten-gevraagd.md` |
