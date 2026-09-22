# FB-069 — antagonist

Two rounds, on branch `ticket/FB-069-dekkingssignalen`.

- **Round 1:** VIOLATIONS FOUND. One MAJOR, no CRITICAL.
- **Round 2** (re-audit of the blocking finding only): COMPLIANT.

## The blocking finding, and what it cost

**[MAJOR] The cat used a narrower definition of what a subthema covers than Art. V.1.** `Katsubthema.Leerplandoelcodes`
was built from the subthema's decided subdoelen alone. Art. V.1 names two routes: a subdoel, **or** a goal linked to a
shared activiteit under the subthema. `EfDekkingOpslag.HaalSubthemakoppelingenAsync` reads both.

The cost was real and silent. A subthema whose still-open goals hang on its activiteiten produced an empty list of
missing goals, and the detector's own "nothing to win, so stay quiet" rule then suppressed the signal altogether.
Where it did fire, `doelen` and `aantalDoelen` under-reported against the dekkingsoverzicht the teacher sees beside it.

Fixed in `945b922c`, and pinned: `KatplanbronPostgresTests.De_kat_leest_dezelfde_doelen_per_subthema_als_de_dekking`
seeds one goal by each route and demands the cat's port and the dekking's return the same set. It would have failed
before that commit. The duplication between the two reads is deliberate (the dekking's port serves the highest-risk
logic in the system and the cat must not widen it), so it needed a guard against drift rather than removal.

## MINOR findings fixed in the same commit

1. **A geweigerd placement counted as a running thema.** Nothing is taught on its account, so it can neither run nor
   end. Now filtered on the status text `ThemaplaatsingWeergave` carries.
2. **A minimumdoel whose thema is already placed as a proposal got "there is not enough room".** Wrong advice: the act
   there is to answer the proposal. The dekking already calls that `Lacuneoorzaak.WachtOpBeslissing`, and the detector
   now skips it.
3. **The emitted links named routes the frontend router does not have** (`/klassen/{id}/jaarplan`). Now `/dekking` and
   `/agenda/periodes`, which it does.
4. **The `InternalsVisibleTo` on Application is reverted.** Both counting tests say the same thing through
   `DetecteerAsync`, and now assert the number the teacher is shown instead of an internal return value.
5. `K1` is not one of the nine jaarfase codes; the tests use `K2`. `Distinct()` added to `HaalThemadragersAsync`.

## MINOR findings left open

1. **The part-elapsed current week counts as a whole free lesweek.** On a Thursday, "vrije lesweken" is one too
   generous. Whether that matters depends on whether a leerkracht starts a thema mid-week, which is the owner's to say.
2. **FB-071 must select the klas from the signal's `KlasId` before following the link.** Those screens read the klas
   from the klasfilter, not from the path, so a click without that step lands on whichever klas was open. This is a
   requirement on FB-071, not something FB-069 can solve.

## Gates

`dotnet build` clean, `dotnet format` clean, 2189 unit tests and 585 Postgres integration tests green. No frontend
change, so `pnpm lint` does not apply: the copy of both messages lives in `nl.json` and arrives with FB-071, because
the catalogus test refuses a key nothing renders. The proposed wording is in the ticket.
