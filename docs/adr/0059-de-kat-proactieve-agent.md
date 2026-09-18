# ADR-0059 — The cat: a proactive agent that notices without AI and prepares with it

- **Status:** Accepted
- **Date:** 2026-09-18
- **Deciders:** Project owner, in the sparring session of 2026-09-18 on the agentic extension and in TB-056 the same
  day. Directie has not been asked. The onderwijsadviseur reviews the cat before it becomes central to the huisstijl.
- **Relates to:** [ADR-0010](0010-ai-advisory-architecture.md) (AI advisory), [ADR-0039](0039-ai-knoppen-regenboogring.md)
  and [ADR-0051](0051-ai-voorstel-draagt-een-vage-ring.md) (how AI controls and proposals look),
  [ADR-0047](0047-dekkingsprognose-en-dekking.md) (the dekking it watches), [ADR-0057](0057-vervanging-briefing-en-klasfiche.md),
  [ADR-0058](0058-lesvoorbereiding-per-plaatsing.md) and [ADR-0060](0060-activiteitvoorstellen-op-een-aanbod-gat.md)
  (what it brings).
- **Realises:** TB-056, TB-057; FB-068 to FB-071, FB-031, FB-032; FR-14.7, FR-14.9 to FR-14.11. **Constitution:** Art. I.1,
  IV.1, IV.5, IV.8, VI.2, IX.3 and XII (amended).

## Context

Every AI feature so far runs when a person asks (Art. IV.8: the AI never runs ahead of the teacher). The owner wants an
agent that lives on the kleuterleerkracht's agenda and reduces planning work by noticing things and bringing what
helps, without flooding her. He personified it as a fat orange striped cat: proactive, not servile.

## Decision

The owner's rulings:

- **K1. The agent is the interface, not the motor.** What it notices, the tool computes without AI; the AI only makes
  content (a lesvoorbereiding, an activiteitvoorstel, a chat answer).
- **K2. It may act unasked** (Art. IV.8 amended). It prepares; it never decides. What it brings is a proposal, decided
  by the person Art. IV.1 names for it.
- **K3. In the app only**, at most a few moments a day. No mail, no push, no badges or red dots.
- **K4. Its place and its window.** The cat sleeps top right in a basket. Clicking it makes it stand up, walk a few
  steps and open one window: on top what it brought (each item with *Bekijken* and *Later*), below a chat with it
  (FB-031, FB-032, both in phase 1).
- **K5. Its posture is its status**, each with a visible label: asleep in the basket (nothing new), in the basket with
  its ears up (something is ready), lying on the corner of the week strip (a goal is at risk), purring (every goal of
  the klas on track).
- **K6. Charming in behaviour, adult in content, never babytaal.**
- **K7. What it notices in phase 1:** a minimumdoel at risk and a subthema not planned while its thema ends (FB-069), a
  vervanging with its briefing (ADR-0057), lesvoorbereidingen ready during a vervanging (ADR-0058), activiteitvoorstellen
  on an aanbod-gat before a thema starts (ADR-0060). Out of phase 1: an inbox for loose notes and photos (the
  krabpaal), communication with parents, spreading evaluations.

Defaults of this session, which the owner may change on their own:

- **D1. A background job** in the API process (an `IHostedService`), which in Azure needs Always On. It ticks at fixed
  Brussels times (07:00 and 19:00) and on events (recording a vervanging). One tick runs on one instance only, through a
  lease row in Postgres. It is idempotent: a tick over an unchanged state writes nothing.
- **D2. The signal layer** (`Application`) derives per klas, without AI, what the cat noticed. A `Signaal` is stored
  (`Soort`, `KlasId`, `OntvangerId`, a `Sleutel` that makes it unique, `Aangemaakt`, `GezienOp?`, `UitgesteldTot?`) so
  it can be seen and postponed; a signal whose reason is gone is removed at the next tick. It never counts for dekking.
- **D3. The job acts for no one.** It writes proposals and signals addressed to a recipient, and reads for each only
  what that recipient may read (Art. VI.1). An AI call it makes is sent what the feature's ADR allows and counts
  against the school's AI budget once FB-055 exists.
- **D4. The thresholds:** a minimumdoel is at risk when it is in the klas's dekkingsprognose, not gedekt, and the free
  lesweken left in the schooljaar are fewer than the lesweken of the shortest thema that carries it as themadoel; a
  subthema is unplanned when its thema's placement in the klas ends within five schooldagen and the subthema, at the
  klas's leeftijd, is not in the agenda. *Later* postpones a signal to the next schooldag.
- **D5. Who sees it:** the cat lives in the app of every gebruiker. A signal about a klas is addressed to its
  leerkrachten; directie can look at every klas's signals but is not addressed by them. A vervanger is addressed only
  by what concerns her vervanging (the briefing, the lesvoorbereidingen ready), never by a dekking signal.
- **D6. The chat stores nothing.** No conversation is kept, and no chat content is logged. The window says in visible
  text that no name or information about a child belongs in it. A chat answer changes nothing: what it proposes goes
  through the ordinary proposal flows (FB-032), and it can do only what the gebruiker may do.
- **D7. Colour.** The orange of the cat's coat is illustration, never a status colour: orange already means attentie,
  the AI ring and doelsoort A. How the coat is drawn so it does not read as a knelpunt is designed with the
  `frontend-design` skill and measured in a browser. An AI control stays an `AiKnop` (ADR-0039) and a proposal keeps the
  faint ring (ADR-0051). With reduced motion the cat changes posture without animation and the window opens without the
  walk. There is no cat in an export or an ontwikkelingsrapport.

## Alternatives considered

- **Let the model decide what matters.** Rejected by K1: detection by AI is costlier, less predictable and harder to
  test than the rules above.
- **Notifications by mail.** Rejected by K3.
- **A separate chat button beside the cat.** Rejected by K4: one place, and "what did you bring me?" is the first line
  of the conversation.

## Consequences

**Positive:** one calm place for everything the AI prepares; detection that is testable without AI; the chatbot gets a
face.

**Negative / trade-offs:** the first AI calls nobody asked for, and their cost; a background job to host and keep
single-instance; a persona that has to stay adult in tone and is reviewed outside the team.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| Detection without AI (K1, D2) | the signal layer has no AI client; its unit tests run without one |
| It prepares, never decides (K2) | the job writes only proposals with status `voorgesteld` and signals; tests |
| One tick, one instance, idempotent (D1) | the lease; an integration test with two runners |
| Reads only what the recipient may read (D3) | the job goes through the same policies; tests |
| The chat stores nothing (D6) | no table; a test that no chat content reaches the log |
