# ADR-0044 — The hoekverrijking lives in the side panel, and a hoek is no longer placed in the agenda

- **Status:** Accepted
- **Date:** 2026-09-15
- **Deciders:** Project owner, in session on 2026-09-15, after seeing FB-020 built: *"de hoekenverrijking stories zijn
  wat verkeerd uitgevallen, dit was niet mijn bedoeling"*; of the verrijking line in the subthemabalk, *"dit moet weg,
  dat is niet de bedoeling. de hoekenverrijking wil ik zien hier in de sidepane"*; and *"ik wil GEEN hoeken meer in de
  agenda kunnen plaatsen want dit is niet nodig. ik wil gewoon tijdens het geselecteerde themaperiode in de agenda zien
  welke verrijkingen ik zal doen in welke hoeken"*. Seven rulings the same day, in answer to explicit questions (below,
  and in FB-038).
- **Supersedes:** [ADR-0041](0041-hoekverrijking-per-subthemaperiode.md) decision 5 (the verrijking written from the
  subthemabalk's sheet and from the hoek's detail sheet) and its consequence that the subthemabalk carries it;
  [ADR-0028](0028-tijdraster-in-plaats-van-lesuren.md) decisions 4 (every hoekplaatsing has a time) and 7 (hoeken are
  drawn in the grid). **Ends** the hoekplaatsing in the agenda (owner meeting 2026-08-30, never recorded as an ADR).
- **Keeps:** ADR-0041's model (one text per hoek and subthemaperiode) and its decision 3 (a run without a stored window
  stores it on the first save); [ADR-0042](0042-stroken-openen-de-themapagina.md) decision 3 (the subthemabalk is the
  keyboard's way to the themapagina).
- **Realises:** FB-038. **Constitution:** Art. II.3, VI.1 (reads and writes as ADR-0041: `KlasplanningBekijken` and
  `KlasplanningBewerken`), V.1 and IX.3 unchanged. WCAG 2.2 AA via [ADR-0017](0017-ui-ux-design-system.md).
- **Backlog:** FB-038; FB-019 (when a hoek's goal counts is now an open question there), FB-028 (where the AI button
  sits), FB-021 unchanged.

## Context

FB-020 gave a verrijking its right home in the model, a hoek and a subthemaperiode, but put its entry above the time
grid: a card per subthema in the subthemabalk with a preview line, opening a sheet with every hoek. The side panel's
Hoekenfiches list showed the text under each hoek, read-only, while a press on a hoek planned it in the agenda. The
owner wanted the reverse: the corners and what is in them this week, in the panel he opens beside the agenda, and no
corners in the agenda at all.

## Decision

1. **The verrijking is read and written in the side panel's Hoekenfiches list.** Each hoek's card shows, under its
   description, what it holds for every subthema run touching the agenda's week (Monday to Sunday of the anchored day),
   named by the subthema. An empty one says *Verrijking invullen* to whoever may plan and *Nog niets ingevuld* to a
   reader; while the week is not read, a card says nothing. A press opens a sheet for that hoek with one field per such
   run. It sends only the fields she changed, one request per subthemaperiode, each naming this hoek alone, so another
   corner's text in the same window is never overwritten.
2. **The subthemabalk keeps its links and nothing else.** Each thema in view and each run's chapter, with the run's days
   beside the link. No preview, no button, no sheet.
3. **The Hoekenfiches list is for everyone who reads the klas's agenda**, as the activiteiten list is (FB-017). A reader
   gets no field, no create tile and no link to Instellingen. The algemene fiches stay for whoever may plan the klas.
4. **A hoek is not placed in the agenda.** No drag from the panel, no placement sheet, no hoek blocks in the week or
   day view, no hoek strips in the month, and no detail sheet of a placed hoek, which was ADR-0041's second place to
   write a verrijking; the panel's sheet replaces it.
5. **Existing placements are hidden, not deleted** (owner ruling). The tables `hoekplaatsingen` and `hoekmomenten` and
   the routes under `/api/klassen/{id}/hoekplaatsingen` and `/api/hoekplaatsingen` stay as they are; no screen reads or
   writes them. No migration.
6. **Deleting a hoek takes its hidden placements along, without a word** (owner ruling). The refusal *"staat nog N keer
   in de agenda"* named rows no screen shows. The confirmation names the verrijkingen that go with it, as before.
7. **It grants no dekking**, as before: a hoek and a verrijking carry no doelkoppeling (FB-019 is where that is argued).

## Consequences

- Instellingen no longer says how often a hoek stands in the agenda; `HoekWeergave.AantalPlaatsingen` is still sent and
  no screen reads it.
- The dormant routes can still write a placement; nothing in the app calls them. Removing them with their tables is a
  cleanup of its own, with a migration, and needs its own ticket.
- FB-019's rule *"telt mee zodra de hoek ingepland is"* has nothing left to hold on to; the ticket carries it as an open
  question for the owner.
- FB-028's *stel verrijkingen voor* moves to the panel; whether it sits above the list or in a hoek's sheet is its
  design step.
- ADR-0028's *every hoek gets a time* no longer governs anything a screen shows.
- ADR-0042's consequence that the month's subthemabalk makes the verrijkingen reachable from the month no longer holds:
  the panel opens over every view.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep the preview in the subthemabalk and add the panel | The owner: *"dit moet weg"*. |
| Remove the whole subthemabalk | It is the keyboard's way to the themapagina (ADR-0042); the owner chose to keep the links. |
| Delete the placements, their tables and routes | The owner chose to hide them. |
| One verrijking per hoek per themaperiode | The owner kept the subthemaperiode of ADR-0041. |
| A field under each hoek, typed straight into the panel | A 240px column; the owner chose a sheet per hoek. |
| One sheet with every hoek, from a button at the top of the panel | The owner chose the hoek's own card as the way in. |

## Compliance

| Rule | Where |
| --- | --- |
| No colour alone; every state carries a label | Art. XII / WCAG 2.2 AA, decision 1 |
| Keyboard access to every destination, target size by an equivalent control | WCAG 2.2 AA SC 2.1.1, 2.5.8; decision 2 |
| A sentence asserts only what its render condition guarantees | CLAUDE.md, decision 1 (nothing said while the week is unread) |
| Rights checked server-side, reads and writes as ADR-0041 | Art. VI.1, decision 3 |
