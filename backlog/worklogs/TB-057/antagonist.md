# TB-057 — antagonist

Two rounds, on branch `ticket/TB-057-signalenlaag`.

- **Round 1:** VIOLATIONS FOUND. One MAJOR, no CRITICAL.
- **Round 2** (re-audit of the blocking finding only): COMPLIANT.

## The blocking finding, and what it cost

**[MAJOR] The cat got its own answer to "which leeftijd is this klas."** `EfKatklassenlezer` read `Klas.Jaarfase`
straight off the row instead of asking `Jaarfasen.VoorKlas`, the one place Art. VI.1 puts that mapping. Two real
divergences: a klas with only a `Leerjaar` and no stated jaarfase came out `null` here while the rest of the app
derives a code from the ordinal (Art. IX.3), and a single `string?` could not tell "cannot be derived, so widen"
apart from "no leeftijd" (Art. XIV, the graadklas is open).

Nothing was broken for a user, because no detector ships yet. It mattered because FB-069 and FB-070 will judge "the
subthema at the klas's leeftijd" and "the leerplandoelen of its jaarfase" against this surface, while the dekking they
must agree with computes its leeftijden through the mapping. A cat that reads a klas differently from the dekking is
the state ADR-0059 D2 exists to prevent.

Fixed in `83c33848`: `Katklas.Leeftijden` and `Katcontext.Leeftijden` are `IReadOnlyList<string>?` from
`Jaarfasen.VoorKlas`, and both doc comments state the null contract.

## MINOR findings left open

Recorded rather than fixed (Art. X.7). None blocks; three are the owner's to decide.

1. **`Kat:Ingeschakeld` is off in every environment.** No `appsettings*.json` in the repo sets it, so the job ticks
   nowhere, the demo included, and the deurmat reads empty there. Deliberate (a job that writes unasked is switched on
   explicitly), but somebody has to choose which deployment turns it on. In Azure it needs Always On (ADR-0059 D1).
2. **The deurmat re-runs every detector on every read.** Correct by D2, and free today with no detectors. Once FB-069
   lands it is a full dekking computation per klas per page load, the most expensive logic in the system (Art. V.6).
   A cache or a staleness window belongs in FB-071.
3. **The cat's copy is composed server-side in Dutch** (`Signaalvondst.Titel`). Art. II.3 allows it for a message a
   teacher can act on, and no title ships yet. If FB-069 and FB-071 put the cat's whole vocabulary here, `nl.json`
   loses the chrome it is supposed to own. Worth deciding the split before the first detector.
4. **Nothing prunes `kattikken`** (two rows a day, forever), and a round that dies mid-way leaves `Voltooid` null with
   nothing but the log to show it.
5. **ADR-0059 D5's admin view is not built:** an admin sees only signals addressed to her, not every klas's. It shows
   less, never more, so nothing leaks. It belongs to FB-071.

## Gates

`dotnet build` clean (the one warning is pre-existing, in `SchoolcontentBeheerEndpointsTests.cs`), `dotnet format`
clean, 2167 unit tests and 580 Postgres integration tests green. No frontend change, so `pnpm lint` does not apply.

One integration test, `GebruikerbeheerEndpointsTests.Een_admin_afzetten_of_verwijderen_die_intussen_verwijderd_wordt`,
failed once under the full parallel run and passed on the rerun and in isolation. It is a concurrency test unrelated to
the cat; left alone rather than chased.
