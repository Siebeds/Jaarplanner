# E4-08 — Een activiteit naar een ander subthema verplaatsen

**Branch:** `story/E4-08-activiteit-verplaatsen`, off `origin/main` `3e646da`
**Commits:** `950b009` (server), `2c7ea32` (screen), `777f9e6` (browser pass), `afde19d` + `35e2dc1` (fix round 1)
**Status:** `[~]`. The fix round has had no independent pass, and two of the audit's questions are the owner's.

## The ruling, first, because the story forbade guessing it

The entry said: *"Decide and state whether a move is restricted to subthema's of the same thema, or the same
klas, or is free with the consequence disclosed. Do not guess this one in code."* So it was asked before any
code existed. Three options; the owner chose **same klas, any thema**. The rejected two are recorded in the
story entry, because they are what makes the choice legible.

It is enforced as a **domain invariant**: `Subthema.VerplaatsActiviteitNaar` refuses a destination in another
klas, and `Activiteit.VerhuisNaar` is `internal`, so no caller reaches the FK past that guard. The picker
agrees with the server rather than being the only thing between a teacher and a refusal.

## What the change actually is

| Layer | Delta |
| --- | --- |
| Domain | the move verb on `Subthema`; an `internal` re-parent on `Activiteit` |
| Application | `VerplaatsActiviteitAsync`, `HaalSubthemaBestemmingenAsync`, `SubthemaBestemming` |
| Api | `PUT /api/activiteiten/{id}/subthema`, `GET /api/subthemas/voor-klas/{klasId}` |
| Frontend | a destination picker per activiteit row, a section-level confirmation, twelve `themabeheer.activiteitVerplaats*` keys |

**The links travel for free**, and that is the whole point: `Doelkoppelingen` is an owned collection keyed on
the activiteit, so changing `SubthemaId` carries every `Manueel` link with it. Delete-and-retype, the only
route before this, lost them along with `hoek` and `verwachteUitkomsten`.

**A move can change dekking without leaving the klas.** Layer 4 of `EfDekkingOpslag` counts an
activiteitkoppeling through the thema its subthema hangs under, so moving into a thema that is not in the
class's jaarplan takes the doel out of the figure. Driven 1 → 0 in an integration test against real
PostgreSQL, and stated in the panel where the action is.

## What running it found that reading it did not

1. **An English artefact inside a Dutch sentence, caught by an integration test on its first run.**
   `ArgumentException(message, paramName)` appends `(Parameter 'doelSubthema')` to `Message`; the service
   forwards `Message` as the 400's `detail`; E1-14's forms render that `detail` verbatim. E1-14's round-4
   MAJOR, one screen over. The guard now asserts the property over *every* message the method can refuse
   with, not over the two sentences. The sibling in `Subthema.Require` is filed as **E7-19**.
2. **The confirmation has to name the destination and outlive the row.** A cross-thema move takes the
   activiteit off this screen, so the row that performed it is gone before anyone could read a notice inside
   it; without a section-level sentence naming the new home, a successful move looks exactly like a delete.
3. **A refusal that still offered what it said was gone** (browser, not a test). With the destination deleted
   by a colleague, the panel said *"Dit subthema bestaat niet meer"* while the picker above it still offered
   that subthema and still had it selected. Fixed on both sides: the shared mutation wrapper refreshes on any
   failure rather than only on a 404, and the chosen destination is derived from the list rather than trusted
   from state.

## Antagonist round 1: VIOLATIONS FOUND (2 MAJOR, 6 MINOR, 2 QUESTION)

See [`antagonist.md`](antagonist.md). Both MAJORs were real; the first broke this story's own feedback
mechanism **and** E1-14's, through a latched TanStack flag that no single-write test could observe.

## The guards needed three rewrites, and that is the transferable part

- A duplicate-name guard comparing **accessible** names passes on two visibly identical buttons, because an
  `aria-label` keeps the names unique. The same guard at **section** scope fails on correct code, because
  "Wijzigen" and "Verwijderen" appear twice there by E1-14's deliberate design. Scoped to the row, asserting
  both properties, with two panels genuinely open.
- Asserting a `<select>`'s value after setting it to a missing option proves the **DOM**, not the component.
  The fake now reproduces the race (refuse **and** remove) and the assertion is on the submit's enabled state.
- A `verplaats.reset()` on the trigger was **removed** after a mutation check showed it changed no test and
  the close paths showed it cannot fire.

**Ten mutation checks; three only began biting after being rewritten.**

## Gates on `35e2dc1`

575 unit + 201 integration against real PostgreSQL, 459 frontend / 20 files, 0 skipped. `dotnet format`,
eslint, `tsc`, `pnpm build` clean.

Browser passes at 1440px and exactly 390px against a live API and real PostgreSQL, run twice (before and
after the fix round), including the colleague-deletes-the-destination race. Measured: submit **8,90:1**,
empty-state sentence **5,80:1**, disabled submit **2,16:1** (inactive, outside SC 1.4.3, recorded because it
is the state the panel opens in). The only elements past 390px are the nav's own `overflow-x:auto` scroller;
`document.documentElement.scrollWidth` reads 390, which is why that probe is the wrong one.

## Owed

1. An independent pass on the fix round.
2. Whether the **leeftijd** half of the ruling was actually ruled (the options were about the thema boundary).
3. Whether "never to another klas" binds `PUT /api/subthemas/{id}`, which re-scopes a subthema with every
   activiteit inside it.
