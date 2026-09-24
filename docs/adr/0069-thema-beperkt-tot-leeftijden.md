# ADR-0069 — A thema is limited to the leeftijden it holds

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Project owner (FB-012, ruling of 2026-09-15).
- **Relates to:** [ADR-0025](0025-subthema-per-leeftijd.md) (a subthema per leeftijd),
  [ADR-0053](0053-themaplaatsing-met-eigen-datums.md) and [ADR-0055](0055-ai-jaarplan-met-datums.md) (placing and
  generating thema's).
- **Constitution:** Art. IX.2 amended (Thema, Subthema); Art. V.1 and VI.1 unchanged.

## Context

Every thema was school-wide: every klas saw it among its choices, also a thema the school only teaches in the third
kleuterklas. The lists grew long, and a klas could plan a thema not meant for its age. The owner asked for a thema that
is *"niet per se schoolbreed"*, and ruled on 2026-09-15 that a thema stays shared but can be **limited to certain
leeftijden**. A thema per klas or a personal thema was not asked for.

## Decision

1. **A thema holds a set of leeftijden**: one or more of the nine jaar/fase codes (JK, K2, K3, L1–L6). By default, and
   for every thema that existed before this decision, all nine. Whoever edits a thema (admin, themabeheer) sets them.
   A thema created by the FR-1 import gets all nine, and a later import leaves them alone.
2. **A klas sees a thema when it teaches one of its leeftijden** (`Jaarfasen.VoorKlas`). Only such a thema is offered
   when a thema is placed in its jaarplan and is sent to the AI when its jaarplan is generated; the server refuses a
   placement of any other thema. A klas whose leeftijd cannot be derived sees every thema, as
   `Klasleeftijden` widens rather than narrows.
3. **A subthema holds one of its thema's leeftijden**: on creation, when its leeftijd is changed, and when a
   subthemavoorstel is accepted. The agenda's choice of subthema and activiteit follows from this, because it already
   goes through the subthema's leeftijd.
4. **A leeftijd in use cannot be removed.** While a klas of that leeftijd holds the thema in its jaarplan, or a
   subthema of the thema has that leeftijd, the tool refuses the change with a Dutch message naming those klassen and
   subthema's. Cleaning them up for the user is not done: that would delete a teacher's planning or content as the side
   effect of a list edit (the ticket's default).
5. **Nothing else changes.** Dekking, rights, the doelsuggesties and the themadoelen read a thema as before.

## Consequences

**Positive:** a klas's choices hold only thema's meant for it; the school keeps one shared library.
**Negative:** a klas whose jaarfase is changed afterwards keeps a thema already in its plan, even if the thema is not
meant for its new leeftijd; the guard in 4 applies to editing the thema, not to editing the klas.
