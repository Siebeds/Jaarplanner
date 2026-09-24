# ADR-0070 — The AI proposes a hoekverrijking per hoek, and the klas decides it

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Project owner: H1 to H3 on 2026-09-24, in session when FB-028 was picked up. Directie has not been asked.
- **Relates to:** [ADR-0041](0041-hoekverrijking-per-subthemaperiode.md) (the verrijking per subthemaperiode, FB-020),
  [ADR-0044](0044-hoekverrijking-in-het-zijpaneel.md) (the verrijking in the side panel), [ADR-0051](0051-ai-voorstel-draagt-een-vage-ring.md)
  (how a proposal looks), [ADR-0039](0039-ai-knoppen-regenboogring.md) (the AI button),
  [ADR-0058](0058-lesvoorbereiding-per-plaatsing.md) (Art. IV.4 as one rule).
- **Realises:** FB-028; FR-4.1. **Constitution:** Art. IV.1, IV.4 and IV.5 amended; IV.2, V.1 and VI.1 unchanged.

## Context

A leerkracht writes per hoek what it holds while a subthema runs (FB-020, FB-038): "prentenboeken over de herfst,
bladerenpers op tafel". The owner asked for the AI to propose those verrijkingen. Art. IV.4 let the AI make up the words of
a woordweb, the name of a thema or subthema, an activiteit and a lesvoorbereiding from its own knowledge; the text of a
verrijking was none of these.

## Decision

The owner's rulings:

- **H1. Where it is asked.** A small AI button on each hoek's row in the Hoekenfiches panel, per subthema block. One
  request is one proposal for that hoek and that subthema. The proposal shows under the row, and is taken over, changed
  first, or rejected there.
- **H2. It belongs to the klas.** Whoever may plan the klas (`KlasplanningBewerken`), and an admin, asks, sees and
  decides it. No asker is stored; a duo colleague sees what the other asked.
- **H3. Art. IV.4.** The AI may make up the text of a verrijking from its own knowledge. It names no goal and links none
  (the goals of a hoek stay by hand, FB-019).

Defaults of the building session, which the owner may change on their own:

- **D1. What it is sent.** The hoek's name and description; the subthema's name, thema, leeftijd and onderzoeksvragen;
  the **texts** of its decided subdoelen (`aanvaard` or `manueel`), without codes; what the hoek holds for that subthema
  now; and the texts the klas rejected for that hoek and subthema. No gebruiker, no klas name, no pupil data.
- **D2. The answer.** `{"verrijking": "<text>", "motivatie": "<one sentence>"}`, or both `null` for "nothing fitting".
  A text over 1000 characters or without a motivation refuses the answer as a whole (Art. IV.5): a 422 and no change.
- **D3. Nothing new is kept out.** An answer equal (ignoring case and outer spaces) to what the hoek holds now or to a
  rejected text stores nothing, and the open proposal, if any, stays.
- **D4. One open proposal per (hoek, subthema).** A new request replaces it; decided ones stay (Art. IV.2).
- **D5. Keyed on the subthema, not the window.** A verrijking hangs on a stored subthemaperiode, but the agenda also
  draws a subthema from its activiteiten alone. Asking must change nothing, so it stores no window. Accepting names the
  window as a save does (its id, or the days the agenda draws) and writes through the ordinary verrijking save, which
  finds or stores it (ADR-0041).
- **D6. Accepting replaces** what the hoek held for that window. Unchanged is `aanvaard`, edited first is `manueel`.
  Rejecting changes no verrijking. A row version keeps two simultaneous decisions from both being saved.
- **D7. Lifetime.** A proposal goes with its hoek and with its subthema. It counts for no dekking, as a verrijking does
  not.
- **D8. Readers.** A reader of the agenda who may not plan the klas sees the verrijkingen and neither the button nor the
  open proposals.

## How it is built

- **Domain.** `Hoekverrijkingsvoorstel` (`HoekId`, `SubthemaId`, `Tekst`, `AiMotivatie`, `Status`), table
  `hoekverrijkingsvoorstellen`, cascading from the hoek and the subthema. Not a `Hoekverrijking` with a status: the
  agenda and the panel read verrijkingen without one.
- **Routes**, all under `KlasplanningBewerken` on the klas: `GET /api/klassen/{klasId}/hoekverrijkingsvoorstellen`,
  `POST /api/klassen/{klasId}/hoeken/{hoekId}/verrijkingsvoorstel` with the subthema, and
  `PUT /api/klassen/{klasId}/hoekverrijkingsvoorstellen/{id}/beslissing`.
- **Screen.** On the row an `AiKnop` (ADR-0039); the open proposal under it in the faint `voorstel-ai` ring with the quiet
  check, pencil and cross (ADR-0051).

## Alternatives considered

- **One button per subthema block, proposing for every hoek at once.** Offered; the owner chose one button per hoek.
- **Personal proposals, as ADR-0056's.** Rejected by H2: a verrijking is the klas's, not a person's.
- **Store the window when asking.** Rejected: asking would change the plan before anyone decided (Art. IV.1).

## Consequences

**Positive:** a leerkracht gets a concrete starting point per corner, grounded on the subthema's own subdoelen.

**Negative / trade-offs:** a fifth kind of content the model makes up; whoever takes it over is responsible for it.
A subthema planned in two stretches shares one open proposal per hoek, and the stretch she accepts it into gets it.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| Only planners of the klas and admin ask, see and decide (H2) | `[RechtOp]` on the routes; `HoekverrijkingsvoorstellenEndpointsTests`, the route sweep |
| No goal code is sent or named (H3, D1) | `HoekverrijkingsvoorstelPromptBuilder`; its unit and endpoint tests |
| Unreadable answer stores nothing (D2) | `HoekverrijkingsvoorstelResponseParser`; its unit and endpoint tests |
| A rejected or current text is not proposed again (D3) | `HoekverrijkingsvoorstelService`; the endpoint tests |
| Asking changes no verrijking and no window (D5) | `HoekverrijkingsvoorstelService`; the endpoint tests |
| The AI is faked in tests (Art. IV.6) | the unit and integration tests |
