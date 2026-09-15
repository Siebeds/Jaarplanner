# ADR-0041 — A hoekverrijking belongs to a hoek and a subthemaperiode

- **Status:** Accepted. *Decision 5 and the consequence that the subthemabalk carries the verrijking are superseded by
  [ADR-0044](0044-hoekverrijking-in-het-zijpaneel.md) (FB-038, owner 2026-09-15): the verrijking is read and written in
  the agenda's side panel, and a hoek is no longer placed in the agenda. The model and decision 3 stand.*
- **Date:** 2026-09-15
- **Deciders:** Project owner, in session on 2026-09-15: *"een leerkracht moet de hoekenverrijking via de agenda kunnen
  invullen en bekijken, dit is geen activiteit in de agenda ... maar loopt overheen verschillende dagen (best linken aan
  een subthema - klik op subthema, vul hoekenverrijking in, zie hoekenverrijking preview in subthemabar op agenda)"*,
  and four rulings the same day on the questions of FB-020 (below).
- **Replaces:** the verrijking with its own dates on a `Hoekplaatsing` (owner meeting 2026-08-30; `Hoekverrijking`,
  `Hoekplaatsing.VoegVerrijkingToe`). That model was never recorded as an ADR; this one records what replaces it.
- **Realises:** FB-020. **Constitution:** Art. IV.2 (a teacher's decisions are not undone as a side effect), Art. IX.3
  (a (re)generation discards only placements that are `Voorgesteld` and not `vergrendeld`), Art. V.1 (unchanged), Art.
  II.3. No article changes: Art. IX.2 does not describe the hoek model.
- **Backlog:** FB-020; FB-019 (doelen on a verrijking) and FB-021 (directie's overview) build on it; E10-01 reuses the
  subthemabalk.

## Context

A verrijking was free text on a hoekplaatsing, with a window of its own inside the placement's. It had no tie to what
the class was working on, it was written in the hoek's detail sheet, and a teacher typed a stretch of days the subthema
already had. The owner asked for it to belong to the subthema that runs: she clicks the subthema in the agenda and
writes, per hoek, what goes in it for that stretch. It is never a block in the time grid.

## Decision

1. **A `Hoekverrijking` is one text for one `Hoek` and one `Subthemaplaatsing`**, unique on that pair. The hoek names
   the klas (a hoek belongs to one), the window names the days; neither is stored twice. A blank text is not a
   verrijking: saving a blank field removes it.
2. **It is an aggregate of its own, outside `Jaarplan`, though the window it names is inside it.** That is safe because
   nothing discards a window: a (re)generation removes only `Voorgesteld`, unlocked placements (Art. IX.3) and a
   window carries no status; re-planning an overlapping window of the same subthema moves the same row, so the text
   follows the days.
3. **A subthema the agenda draws from its activiteiten alone has no stored window.** Saving a verrijking there first
   stores the window as the agenda draws it, through the planner's own route (`PlaatsSubthemaAsync`), and the sheet
   says so before the save (owner ruling). An existing window of the same subthema over any of those days is used and
   never moved.
4. **It goes with its hoek or its subthema, and both deletes name the count first.** Owner ruling for the subthema:
   *mee weg, met aantal*; the hoek's delete follows the same rule. Cascade on both foreign keys, and the services remove
   the rows as well so the in-memory test provider deletes what PostgreSQL deletes. Removing a hoekplaatsing no longer
   touches a verrijking.
5. **Written in two places, the same way:** the sheet a row of the subthemabalk opens (every hoek of the klas, saved
   together) and the hoek's detail sheet (one hoek, per stored window touching the placement's days; owner ruling:
   editable there too). The side panel shows, under each hoek, its verrijking for the anchored week.
6. **Existing rows were converted, not kept in two shapes** (owner ruling). Each old verrijking went to every stored
   subthemaperiode of its klas it shared a day with; two landing on one pair were joined in date order; one sharing a
   day with none was dropped. Only demo and development data had the old shape.
7. **It grants no dekking.** It carries no doelkoppeling; FB-019 is where that would be argued.

## Consequences

- One route family, `/api/klassen/{klasId}/hoekverrijkingen`: read per range with `KlasplanningBekijken`, as every
  read of one klas's planning ([ADR-0040](0040-klassen-inkijken-per-jaarfase.md)), written per window with
  `KlasplanningBewerken`. And `/api/subthemas/{id}/hoekverrijkingen/aantal` for the delete confirmation, read with
  `SubthemaBeheren`, the right that deletes the subthema. The verrijking routes under `/api/hoekplaatsingen` are gone,
  and the placement sheet no longer asks for a text.
- The weekplanning's `Subthemaperiodeweergave` carries the window's `Id`, so the agenda can address it.
- A text is at most 2000 characters, checked on the server and stopped at the field.
- The subthemabalk above the time grid is built here; E10-01's streefwoordenschat can hang off the same rows.
