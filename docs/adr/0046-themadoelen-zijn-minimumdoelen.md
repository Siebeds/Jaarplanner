# ADR-0046 — A thema's themadoelen are minimumdoelen, without a maximum

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Project owner, 2026-09-16: the rulings M1 to M7 below, given after the demo and in the FB-043 session.
  Directie has not been asked.
- **Reverses:** the owner's ruling of 2026-09-15 under FB-009 that a thema has "no list of its own of intended
  minimumdoelen" (recorded in `IThemaDoelenoverzichtQuery`).
- **Relates to:** [ADR-0008](0008-themalaag-level-scoping.md) (school-wide thema), [ADR-0025](0025-subthema-per-leeftijd.md)
  (subthema per leeftijd), [ADR-0032](0032-opstap-api-als-importbron.md) (where the minimumdoelen and the concordance
  come from).
- **Realises:** FB-043; FR-2.3, FR-9.3. **Constitution:** Art. IX.2 and XII (amended), IV.8 (amended); III.5, V.1 and
  VI.1 unchanged.

## Context

A themadoel was a `DoelKoppeling` to one leerplandoel, and a leerplandoel belongs to one leeftijd (`…GK2…`). A thema is
school-wide and runs across several leeftijden, so a themadoel said something about one age of a thing that spans
several. The minimumdoel is the level that spans them, and the level the onderwijsinspectie tests. A thema also held at
most three themadoelen (Art. IX.2, "2–3"), which the owner no longer wants.

## Decision

The owner's rulings:

- **M1.** Directie and themabeheer link **minimumdoelen** to a thema as its themadoelen, and unlink them.
- **M2.** A linked minimumdoel **brings along** the leerplandoelen that concord to it, at **every** leeftijd of the
  concordance, including a leeftijd the thema has no subthema for yet. They are not chosen, and they go when the
  minimumdoel is unlinked.
- **M3.** A thema has **no maximum** of themadoelen.
- **M4.** No screen adds a **leerplandoel** as a themadoel any more. The existing leerplandoel themadoelen are
  **deleted** from the data, in every environment. The table and the entity stay; cleaning them up is a later ticket.
- **M5.** The deletion lowers dekking until FB-045 makes the linked minimumdoelen count. That is accepted.
- **M6.** The FR-1 import is **untouched**, its maximum of three leerplandoel themadoelen included. Carrying
  minimumdoelen in the import is a ticket of its own.
- **M7.** The thema's AI doelsuggesties and the wizard's themadoel step are **untouched**; what becomes of them is a
  ticket of its own.
- Subthema's do not change: a subdoel stays a leerplandoel of the subthema's leeftijd.

## How it is built

- **Domain.** `ThemaMinimumdoel` (`Id`, `ThemaId`, `MinimumdoelRef`) is a new child of `Thema`, in its own table
  `thema_minimumdoelen`, with a restricting foreign key to `minimumdoelen.Ref` (reference data is never deleted, Art.
  III.1) and a unique index on `(ThemaId, minimumdoel_ref)`. It carries **no status and no AI motivation**: only a
  person makes it, so it is not a `DoelKoppeling`. `Thema.KoppelMinimumdoel` refuses a second link to the same
  minimumdoel; the service refuses a ref no loaded minimumdoel carries (Art. III.5).
- **The leerplandoelen are never stored on the link.** They are read through the concordance
  (`Leerplandoel.MinimumdoelRef`) whenever needed. The thema page reads them from the minimumdoel's own detail,
  `GET /api/minimumdoelen/{ref}` (TB-010), which a client already has; `ThemaWeergave` carries only the refs.
- **Routes.** `POST /api/themas/{id}/minimumdoelen` and `DELETE /api/themas/{id}/minimumdoelen/{koppelingId}`, both
  under `ThemaBewerken` (R4). `POST /api/themas/{id}/themadoelen` is removed (M4). The delete of a leerplandoel themadoel
  stays, since the import may still write one.
- **Migration.** `ThemaMinimumdoelen` creates the table and runs `DELETE FROM themadoelen` (M4). It is **not
  reversible**: its `Down` drops the new table and cannot bring the deleted rows back.
- **Screen.** On the thema page the themadoelen are the minimumdoelen, each shut; opened, one row per leeftijd with its
  count; a leeftijd opened, its leerplandoelen, each opening the doel's detail. The doelenregister no longer offers
  "Koppel aan thema". The thema's counts ("op het thema", the card's doelen, `HeeftVoldoendeThemadoelen`) count the
  minimumdoelen.

## Consequences

- **Dekking does not read the new link yet** (M5): layer 1 of `EfDekkingOpslag` still reads the leerplandoel
  themadoelen, which after the migration only the import writes. FB-045 decides how a linked minimumdoel counts.
- **A leerplandoel themadoel the import writes is invisible on the thema page** while it still counts for dekking and
  still feeds the generation prompt. That lasts until the import ticket (M6).
- **The AI prompts see no themadoelen** on a thema built by hand: the generation prompt and the matching prompt read
  the leerplandoel themadoelen only (M7).
- "Doelen per leeftijd" (FB-009) still lists a leerplandoel themadoel as a place; FB-044 reworks that block.
- The advisory lower bound stays at two themadoelen, now counted as minimumdoelen.
