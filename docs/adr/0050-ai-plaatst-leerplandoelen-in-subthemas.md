# ADR-0050 — The AI proposes where a thema's open leerplandoelen go, in an existing or a new subthema

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Project owner, 2026-09-16: the rulings P1 to P6 below, given in session on FB-057 and, for P5, on
  FB-054 the same day. Directie has not been asked.
- **Relates to:** [ADR-0010](0010-ai-advisory-architecture.md) (AI advisory), [ADR-0043](0043-eigen-woordweb-per-subthema.md)
  (the first Art. IV.4 exception), [ADR-0046](0046-themadoelen-zijn-minimumdoelen.md) (themadoelen are minimumdoelen and
  bring their leerplandoelen along), [ADR-0030](0030-rollen-en-rechten-in-de-app.md) (the hoofdleerkracht's rights),
  [ADR-0051](0051-ai-voorstel-draagt-een-vage-ring.md) (how a proposal looks).
- **Realises:** FB-057; the first step of FB-054; FR-4.1 to FR-4.4; FA A.7 steps 4 to 6. **Constitution:** Art. IV.1,
  IV.4, IV.5, IV.8, VI.1, IX.2 and XII (amended); V.1 unchanged.

## Context

Since ADR-0046 a minimumdoel linked as themadoel brings along, at each leeftijd, the leerplandoelen that concord to it.
Most of them hang in no subthema yet. Placing them was manual: open each goal, find a subthema that fits, add it as a
subdoel, and see nowhere how many were left. The owner asked for an AI that proposes a place for each, in an existing
subthema or in a new one, as reviewable suggestions.

Art. IV.4 grounded the AI on the school's data and the loaded goals only. A new subthema needs a name and an
onderzoeksvraag that neither holds.

## Decision

The owner's rulings:

- **P1.** Per thema and per leeftijd the page shows how many leerplandoelen of the themadoelen are **open**, in no
  subthema of that leeftijd under the thema. The count needs no AI.
- **P2.** The AI proposes, for open leerplandoelen, a place: as **subdoel of an existing subthema** of that leeftijd, or
  in a **new subthema** with a name, an onderzoeksvraag and a length. Each proposal carries a motivation and is accepted
  or rejected on its own; a rejected proposal does not come back.
- **P3.** The proposals are shown **in the subthema's themselves**: a proposed subdoel inside the subthema it names, a
  proposed new subthema as a chapter of its own with its goals.
- **P4.** A **hoofdleerkracht of that jaarfase, and directie**, ask for the proposals and decide them, checked by the
  server. Themabeheer alone does not.
- **P5.** The AI may **make up the name and onderzoeksvraag of a thema or subthema** it proposes, from its own
  knowledge. The goals it places come only from the loaded goals it was sent, and nothing is stored as final without a
  decision. This is the Art. IV.4 exception the owner ruled on FB-054; this ADR writes it for both tickets.
- **P6.** This is the first step of FB-054, which reuses the same proposals school-wide.

Defaults of the building session, which the owner may change on their own:

- **D1. What is open.** A leerplandoel is open at a leeftijd when it concords to a themadoel of the thema, its own
  jaar/fase is that leeftijd, and no subthema of the thema at that leeftijd holds it as a subdoel, whatever that
  subdoel's status. Only leeftijden at which the thema has a subthema are shown and asked for.
- **D2. A new run replaces the open proposals** of that thema and leeftijd: they are deleted, and the decided ones
  stay. A run proposes at most **three** new subthema's.
- **D3. Rejected stays out.** The prompt lists the rejected placements (goal and subthema) and the names of rejected
  new subthema's; a placement or a name the model repeats anyway is dropped, not stored.
- **D4. A new subthema is decided as one.** Accepting it creates the subthema with its onderzoeksvraag and its goals as
  subdoelen; the person may first change its name, onderzoeksvraag and length and leave goals out. A changed proposal
  is stored as `manueel`, an unchanged one as `aanvaard`; a goal left out is `geweigerd`. Its goals are not decided one
  by one. Rejecting it rejects its goals.
- **D5. What an accepted proposal writes.** A subdoel with status `aanvaard` and the proposal's motivation, the same
  row a person adds by hand except for its status, so every reader that counts decided subdoelen counts it (Art. V.1).
  A goal that became a subdoel of that subthema in the meantime is refused with a sentence, and a proposal whose
  subthema is deleted goes with it.
- **D6. Who sees the proposals.** Only who may decide them for that leeftijd, as with a thema's doelsuggesties (owner
  ruling 2026-09-14); everyone sees the open count.
- **D7. Validation.** A proposal is dropped, not stored, when its goal is not in the open set of that leeftijd, when it
  names a subthema the prompt did not list, when it places the same goal twice, or when a new subthema has no name, no
  onderzoeksvraag, a length outside 1 to 6 weeks, a name an existing subthema of that leeftijd already has, or no valid
  goal left.

## How it is built

- **Domain.** `Subthemavoorstel` (`ThemaId`, `Leeftijd`, `Naam`, `Onderzoeksvraag`, `DuurWeken`, `Status`,
  `AiMotivatie`, `SubthemaId` once accepted) and `Subdoelvoorstel` (`ThemaId`, `Leeftijd`, `LeerplandoelCode`, and
  either `SubthemaId` or `SubthemavoorstelId`, `Status`, `AiMotivatie`). Two tables, `subthemavoorstellen` and
  `subdoelvoorstellen`, cascading from the thema, and from the subthema or the subthemavoorstel they name. A proposed
  subthema is deliberately **not** a `Subthema` row: those feed the agenda, the generation and the rights.
- **Prompt.** A fixed system prompt with the rules and the JSON contract
  `{"plaatsingen":[{"code","subthema","motivatie"}],"nieuweSubthemas":[{"sleutel","naam","onderzoeksvraag","duurWeken","motivatie"}]}`,
  where `subthema` is a short key the prompt lists (`S1`, `S2`, …) or a new subthema's `sleutel` (`N1`, …). The user
  prompt holds the thema, its minimumdoelen, the existing subthema's of that leeftijd with their onderzoeksvragen and
  subdoelen, the open goals, and what was rejected. The prompt size is bounded as every AI call is (TB-007).
- **Routes.** `GET /api/themas/{id}/subdoelplaatsing`, `POST /api/themas/{id}/subdoelplaatsing/{leeftijd}/genereer`,
  `PUT /api/subdoelvoorstellen/{id}/status` and `PUT /api/subthemavoorstellen/{id}/beslissing`, under two new matrix
  rows, `SubdoelplaatsingVragen` and `SubdoelplaatsingBeslissen`, both on the hoofdleerkracht column with the
  leeftijd as resource.
- **Screen.** Per leeftijd on the thema page: the open count and the AI button, the proposed subdoelen inside their
  subthema chapter (a folded chapter says it has proposals), and a proposed subthema as a chapter after the others.

## Alternatives considered

- **Store a proposed subdoel as a `Subdoel` with status `voorgesteld`.** Rejected: several readers of subdoelen do not
  filter on status (the bibliotheek count, the subthema view, the leerplandoel register, the imports), and a proposed
  new subthema could not be a `Subthema` row at all without reaching the agenda and the generation.
- **Show the proposals under each leerplandoel, or on a board of their own** (variants A and C of the design proposal).
  The owner chose P3.
- **Keep Art. IV.4 closed and propose existing subthema's only.** The owner chose P5.

## Consequences

**Positive:** a thema's minimumdoelen turn into subdoelen with a few decisions instead of a search per goal; the open
count shows at a glance what is still to place.

**Negative / trade-offs:** a second Art. IV.4 exception: a subthema's name and onderzoeksvraag may now come from the
model's knowledge, and the person who accepts them is responsible for them. The hoofdleerkracht gains an AI right that
the doelsuggesties never gave her.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| Only open goals of that leeftijd, only listed subthema's (D1, D7) | `SubdoelplaatsingValidator`; its unit tests |
| A rejected placement does not come back (D3) | `SubdoelplaatsingService`; its unit tests |
| Only a hoofdleerkracht of the jaarfase and directie ask and decide (P4) | `Rechtenmatrix` rows; the Postgres rights tests |
| Accepting writes an ordinary subdoel or subthema (D4, D5) | `SubdoelplaatsingService`; the endpoint tests |
| The AI is faked in tests (Art. IV.6) | the unit and integration tests |
