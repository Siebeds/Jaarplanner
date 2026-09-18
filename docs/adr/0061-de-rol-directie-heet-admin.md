# ADR-0061 — The directie right is called admin

- **Status:** Accepted
- **Date:** 2026-09-18
- **Deciders:** Project owner: the name and the rule that nothing else changes on 2026-09-18 (FB-072); the full
  rename of code, column, API and configuration on 2026-09-18, in session when FB-072 was picked up. Directie has not
  been asked.
- **Relates to:** [ADR-0030](0030-rollen-en-rechten-in-de-app.md) (the rights and the matrix, whose directie column
  this renames), [ADR-0031](0031-sessielogin-via-de-api.md) (the first account and the last-holder rule, whose
  configuration key this renames).
- **Realises:** FB-072; FR-12.2. **Constitution:** Art. II.3, IV.1, IV.8, V.5, VI.1, VI.7, IX.2, XII and XIV (amended); IV.7
  unchanged.

## Context

The app has a right called **directie**: it sees and edits everything and maintains gebruikers, klassen, schooljaren
and rights. At the school it is a beheerrol, not a function. The directeur has no more rights than whoever runs the
app, and an ICT-coördinator may hold it as well. The name suggested that only the directeur could hold it, and it made
the rights harder to explain, because "directie" also names the school's management, who answer the open questions
of Art. XIV and whose rulings the code cites (for example the ruling of 2026-07-28 on stale placements).

## Decision

1. **The right is called admin**, and holding it is the *adminrecht*. It is the one beheerrol. Themabeheer,
   hoofdleerkracht, Leerlingzorg and leerkracht (a klastoewijzing) stay what they are.
2. **It allows exactly what the directie right allowed.** Every ✓ of the directie column in
   [ADR-0030 §3](0030-rollen-en-rechten-in-de-app.md#3-the-matrix-that-follows) is a ✓ for admin, and every
   exception stays (an admin views but does not edit the K3 rapportdoelen and the sterrenschaal, R31). No right is
   added or removed.
3. **Several gebruikers can be admin.** An admin gives the adminrecht to another gebruiker and takes it away. The last
   admin who has signed in cannot lose it or be removed (ADR-0031 decision 7, unchanged).
4. **Whoever held the directie right is admin**, with nothing to do: the migration `GebruikerIsAdmin` renames the
   column `gebruikers.IsDirectie` to `IsAdmin` and keeps its values.
5. **The code speaks the same language as the app.** `Gebruiker.IsAdmin`, `GeefAdminrecht`, `NeemAdminrechtAf`; the
   API's `PUT` and `DELETE /api/gebruikers/{id}/adminrecht`, and `isAdmin` in `/api/ik` and the gebruikers list; the
   configuration key `Authenticatie:EersteAdmin` for the first account, set by the Bicep parameter `eersteAdmin`.
   The old key `Authenticatie:EersteDirectie` is still read when the new one is absent, so an environment configured
   before this change keeps its bootstrap until it is redeployed.
6. **"Directie" keeps its other meaning.** Where a text means the school's management, as the body that answers the
   Art. XIV questions, confirms a ruling or bears final responsibility for coverage (Art. IV.7), it says directie.
   Where it means the right, it says admin. Whether the directeur holds the adminrecht is data, like any right.
7. **Earlier ADRs are not rewritten.** Where an earlier ADR says directie for the right (its
   matrix column, "directie sees and edits everything", "only its owner and directie"), read admin. The constitution,
   the functional analysis (A.11) and `CLAUDE.md` say admin.

## Alternatives considered

- **Rename only what a user reads**, and keep `IsDirectie`, the column, the route and the key. A much smaller change,
  without conflicts on open branches, but the code, the documents and the app would name the right differently. The
  owner chose the full rename.
- **A separate admin role beside directie.** Not what the owner decided: there is one beheerrol, and a directeur who
  is not admin is a gebruiker like any other.

## Consequences

- Every open branch that touches `IsDirectie`, the gebruikers screen or the rights matrix meets a merge conflict, and a
  branch that adds an EF migration regenerates it after this one (CLAUDE.md).
- A database is renamed by `dotnet ef database update`; the Azure demo needs its migration before the new code runs
  (`deploy-demo`). Its app setting `Authenticatie__EersteDirectie` keeps working through the fallback; the next Bicep
  deployment sets `Authenticatie__EersteAdmin`.
- A local database created before this change keeps its first account `directie@jaarplanner.local`; a new one gets
  `admin@jaarplanner.local`. The bootstrap only writes into an empty table.
- The API route changed from `/directierecht` to `/adminrecht`. The only client is this app's own frontend.

## Compliance trace

- **Art. VI.1:** the rights and who may give them are unchanged; only their name changes.
- **Art. II.3:** the refusals an admin can act on stay Dutch and server-composed ("… is de enige met het adminrecht").
- **Art. XI:** the constitution, `CLAUDE.md` and the functional analysis change in one dedicated commit, with a row in
  the ratification log.
