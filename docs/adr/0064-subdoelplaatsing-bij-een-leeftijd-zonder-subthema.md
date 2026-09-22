# ADR-0064 — The subdoelplaatsing also serves a leeftijd without a subthema

- **Status:** Accepted
- **Date:** 2026-09-22
- **Deciders:** Project owner, 2026-09-17: the wish and the ruling on who sees such a leeftijd (FB-062). Directie has
  not been asked.
- **Relates to:** [ADR-0050](0050-ai-plaatst-leerplandoelen-in-subthemas.md) (the subdoelplaatsing; this supersedes
  the last sentence of its D1), [ADR-0030](0030-rollen-en-rechten-in-de-app.md) (the hoofdleerkracht's rights),
  [ADR-0051](0051-ai-voorstel-draagt-een-vage-ring.md) (how a proposal looks).
- **Realises:** FB-062; FR-4.4. **Constitution:** Art. IV.1, VI.1 and IX.2 unchanged.

## Context

ADR-0050 D1 ended with: *"Only leeftijden at which the thema has a subthema are shown and asked for."* So at a new
thema, or at a leeftijd where nobody had started, the open count and the button "Plaats de open doelen" were missing,
and a hoofdleerkracht had to make a subthema by hand before the AI could help. Yet the AI may propose new subthema's
(D2), which is exactly what such a leeftijd needs.

## Decision

1. **A leeftijd without a subthema is shown and asked for too, while it has open goals.** What is open is D1
   unchanged: the leerplandoelen of that jaar/fase that concord to a themadoel, and no subthema of the thema at that
   leeftijd holds (at a leeftijd without one, all of them). A leeftijd without a subthema and without open goals is not
   listed. Only a leeftijd the server knows (`Jaarfasen`) qualifies.
2. **Only whoever may decide there sees it**: admin, and the hoofdleerkracht of that jaarfase
   (`SubdoelplaatsingBeslissen` at that leeftijd). For anyone else it is left out of the response entirely, since a
   leeftijd without a subthema is a place to ask and holds nothing to read. A leeftijd with a subthema keeps D6: its
   open count goes to every signed-in gebruiker, its proposals only to whoever may decide.
3. **Asking there is the same request.** `POST …/subdoelplaatsing/{leeftijd}/genereer` no longer refuses a leeftijd
   without a subthema. The prompt lists no existing subthema, so the validator (D7) keeps only new subthema's; accepting,
   changing and rejecting work as in D4. Once one is accepted, the leeftijd has a subthema and is shown as any other.
4. **The response says which kind it is.** `LeeftijdPlaatsing.HeeftSubthema` is false for such a leeftijd. The thema
   page draws a margin for it among the subthema's, in the order of `/api/jaarfasen`, holding only the count, the AI
   button and the proposed subthema's.

## Consequences

- The AI can start a leeftijd from nothing, which Art. IV.1 allows: everything lands as `voorgesteld`, and only an
  accepted proposal writes a subthema.
- A leerkracht or a hoofdleerkracht of another jaarfase sees no change: the leeftijd without a subthema does not appear
  for them, as the owner ruled.
- The kat's deurmat already lists subthemavoorstellen by the same right, so a proposal at such a leeftijd shows there
  without a change.
