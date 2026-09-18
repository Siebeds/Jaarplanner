# ADR-0057 — A vervanging gives a read-only look at a klas, with a briefing, a terugkeerbriefing and a klasfiche

- **Status:** Accepted
- **Date:** 2026-09-18
- **Deciders:** Project owner, in the sparring session of 2026-09-18 on the agentic extension and in TB-056 the same
  day. Directie has not been asked.
- **Relates to:** [ADR-0030](0030-rollen-en-rechten-in-de-app.md) (the rights matrix this adds to),
  [ADR-0040](0040-klassen-inkijken-per-jaarfase.md) (who reads a klas's planning),
  [ADR-0049](0049-eigen-activiteit-van-de-leerkracht.md) (own activiteiten), [ADR-0058](0058-lesvoorbereiding-per-plaatsing.md)
  (the lesvoorbereiding), [ADR-0059](0059-de-kat-proactieve-agent.md) (the cat that brings the briefing).
- **Realises:** TB-056; FB-063, FB-064, FB-065, FB-066; FR-14.1 to FR-14.5. **Constitution:** Art. I.1, VI.1, VI.2,
  IX.2, IX.3 and XII (amended).

## Context

When a leerkracht falls ill, a vervanger arrives who does not know the klas. The app has no notion of a vervanging:
a klastoewijzing has no dates (ADR-0030 I21), so an admin can only add the vervanger as a leerkracht by hand, which
gives her every right on the planning, and remove her later. What a vervanger needs on the first morning is spread
over the app (thema, subthema, agenda, goals), and the most useful part, how the klas runs, is not in it at all.

## Decision

The owner's rulings:

- **V1. An admin records a vervanging:** the absent leerkracht, the klas (one or more of her klassen), a first day, a
  last day or none (open until an admin ends it), and the vervanger, a gebruiker an admin already added.
- **V2. The vervanger only reads.** From the first day through the last she reads the klas's planning (jaarplan,
  agenda, dekking), its klasfiche, its lesvoorbereidingen and her briefing. She edits and decides nothing: not the
  agenda, not a lesvoorbereiding, not the klasfiche.
- **V3. The agenda is the truth, and the klasleerkracht keeps it so.** What the agenda held on a past day, happened.
  The absent leerkracht keeps her rights during the vervanging, and she corrects the agenda afterwards (an admin can
  too): what did not happen, she removes.
- **V4. A vervanger is an ordinary gebruiker** of the school's Entra tenant (Art. VI.1 unchanged). A guest account is
  out of scope.
- **V5. In the app only.** The vervanger learns of the vervanging in the app; no mail, no push.
- **V6. The briefing** is what the vervanger sees first when she opens the klas: the klasfiche, where the klas stands
  (today's thema and subthema, their onderzoeksvragen, kern- and streefwoordenschat, and the woordweb of the klas's
  leerkrachten on that subthema), what the agenda held the past days, the coming schooldagen with their empty moments
  pointed out, and the subdoelen of the running subthema no planned activiteit worked on yet. It says in visible text
  that information about a child comes from the zorgcoördinator or directie. **No AI summary in phase 1.**
- **V7. The terugkeerbriefing** is what the absent leerkracht sees first when she opens the klas after the vervanging:
  the period and who replaced her, what the agenda held per day, the lesvoorbereidingen prepared for it, and the
  running thema and subthema, with a call to remove from the agenda what did not happen (V3).
- **V8. The klasfiche** describes how the klas runs: dagritme, klasafspraken and rituelen, where the materiaal is,
  practical matters (turnen, speelplaatsbeurt, fixed moments) and a free rubric. It holds nothing about a child. The
  vaste leerkracht fills it in.

Defaults of this session, which the owner may change on their own:

- **D1. A vervanging is not a klastoewijzing.** It is its own entity, `Vervanging` (`KlasId`, `AfwezigeId`,
  `VervangerId`, `Van`, `Tot?`), so nothing a klastoewijzing grants (the "LK eigen" and "LK leeftijd" columns, own
  activiteiten, the woordweb on the leeftijd) reaches the vervanger, and I21 stays as it is.
- **D2. A new relation, "Vervanger":** a gebruiker named in a vervanging of the klas concerned whose window holds
  today (the Brussels date, both ends inclusive). It is a column in the matrix of ADR-0030 §3 for the rows below, and
  "–" in every other row:

  | Actie | Admin | LK eigen | Vervanger | Others |
  | --- | --- | --- | --- | --- |
  | Een vervanging vastleggen, wijzigen, beëindigen of verwijderen (V1) | ✓ | – | – | – |
  | Jaarplan, agenda en dekking bekijken (V2) | ✓ | ✓ | lezen | as ADR-0040 |
  | De briefing lezen (V6) | ✓ | ✓ | ✓ | – |
  | De terugkeerbriefing lezen (V7) | ✓ | ✓ | – | – |
  | De klasfiche lezen (V2, V8) | ✓ | ✓ | lezen | who reads the klas's planning (ADR-0040) |
  | De klasfiche bewerken (V8) | ✓ | ✓ | – | – |

  The vervanger does not export (the Exporteren row stays as it is). "LK eigen" includes the absent leerkracht (V3).
- **D3. Own activiteiten.** The vervanger reads an own activiteit of the absent leerkracht as far as the klas's agenda
  holds it (its name, soort, expected outcomes and goals, as the agenda shows them), and no other own activiteit of
  hers. Since the vervanger creates nothing (V2), ADR-0049 needs no rule on what she leaves behind.
- **D4. The window.** An admin may change the last day, end a running vervanging today, and delete one that has not
  started. A last day before the first is refused. Two vervangingen of one klas may overlap (two vervangers).
- **D5. The briefing's reach:** two weeks back and five schooldagen ahead. A subdoel is open when no activiteit planned
  in the klas's agenda since the running subthema's placement started is linked to it (`aanvaard` or `manueel`).
- **D6. The terugkeerbriefing** shows itself once, on the absent leerkracht's first opening of the klas after the last
  day, and stays reachable from the klas until the end of the schooljaar. It needs no record of who changed what,
  because the vervanger changes nothing (V2).
- **D7. The klasfiche** is one per `Klas` (a klas already belongs to one schooljaar), each rubric free text of at most 2000 characters. A new
  klas starts empty. The screen states that no name or information about a child belongs in it.
- **D8. Computed, never stored.** The briefing and the terugkeerbriefing are read models over the planning, like the
  dekking (Art. V.1). Only the vervanging and the klasfiche are stored.

## Alternatives considered

- **A klastoewijzing with dates.** Rejected by V2: a klastoewijzing is the right to edit the planning, and the owner
  wants the vervanger to read only. Adding dates would also have changed I21 for every leerkracht.
- **Let the vervanger remove what did not happen.** Rejected by V3: the klasleerkracht does that afterwards.
- **An AI summary on top of the briefing.** Rejected for phase 1 (V6): it would be a new kind of AI output that is
  neither a proposal nor a decision.

## Consequences

**Positive:** a vervanger can start on day one without rights she should not have; the terugkeerbriefing closes the
loop, and needs no change tracking.

**Negative / trade-offs:** while the klasleerkracht is away, the agenda may say something happened that did not,
until she corrects it (V3); the dekking reads the agenda as it stands. The klasfiche is only as good as what the
leerkracht wrote. FB-063 to FB-066 were written before V2 and are revised with this ADR.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| Only an admin records a vervanging (V1) | the matrix row; endpoint tests |
| The vervanger reads, and edits nothing (V2, D1, D2) | the Vervanger relation, a column of reading rows only; `RechtenmatrixTests` and a route sweep that finds no write route admitting it |
| No child's information in a klasfiche or briefing (V6, V8, Art. VI.2) | visible text on both screens; nothing about a child is a field |
| Briefing and terugkeerbriefing are not stored (D8) | no table for them |
