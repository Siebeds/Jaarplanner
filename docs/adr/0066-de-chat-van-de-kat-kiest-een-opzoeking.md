# ADR-0066 — The cat's chat: the model picks a lookup, the tool answers it

- **Status:** Accepted. **D1 superseded, and C1 and C2 in part, by [ADR-0069](0069-chuck-onthoudt-het-gesprek.md)**: a question carries the last sealed turns of its conversation, with the names and codes an earlier lookup found, and a sixth lookup names a subthema's goals. The text below is left as written.
- **Date:** 2026-09-23
- **Deciders:** Project owner, answering FB-031's open questions on 2026-09-23. Directie has not been asked.
- **Relates to:** [ADR-0059](0059-de-kat-proactieve-agent.md) (the cat; D6: the chat stores nothing),
  [ADR-0065](0065-chuck-de-kat-in-de-app.md) (his window), [ADR-0040](0040-klassen-inkijken-per-jaarfase.md) (which
  klassen a gebruiker reads), [ADR-0049](0049-eigen-activiteit-van-de-leerkracht.md) (who reads an own activiteit),
  [ADR-0048](0048-claude-api-als-tweede-ai-provider.md) (the two providers).
- **Realises:** FB-031; FR-14.10 in part (explanation and lookups; proposals are FB-032). **Constitution:** Art. IV.2,
  IV.3, IV.4, IV.5, VI.1 and VI.2 unchanged.

## Context

FB-031 asks the cat to explain the tool and to answer simple lookups about the school's own content ("zit doel x in
thema y?", "waar wordt doel x gebruikt?"). The constitution already fixes the frame: a chat answer decides and changes
nothing and is not kept (IV.2), an answer about the content comes from the tool's own data and not from the model
(IV.4), and a chat turn is structured JSON naming the answer or the lookup to run (IV.5). Three questions were open,
and the owner answered them:

- **O1. The handleiding** the explanations rest on did not exist. The session writes a first version as part of
  FB-031, and the owner reviews it.
- **O2. How a lookup is answered.** Either the model turns the question into a fixed lookup the tool runs, or the model
  is sent the data and phrases the answer. The owner chose the first.
- **O3. "Waar wordt doel x gebruikt?"** also covers the agenda: in which weeks, in the klassen the gebruiker may read.

## Decision

- **C1. One model call per question, and it only classifies.** The request is the fixed instructions, the handleiding
  (the stable, cacheable part, TB-043) and the question as typed. The model answers with exactly one of:
  `uitleg` (an explanation from the handleiding, naming the chapters it rests on), `opzoeking` (one of five fixed
  lookups with the terms as the gebruiker typed them) or `onbekend`. No school content is ever in the request.
- **C2. Fixed lookups, not provider tool use.** The five lookups are `doelInThema`, `waarGebruikt`, `doelenVanThema`,
  `activiteitInSubthema` and `subthemaVanActiviteit`. They are chosen through the structured JSON every flow already
  uses (IV.5), not through a provider's native tool calling: that works the same on Azure AI Foundry and the Claude API
  through the existing `IAiClient`, needs one call instead of a loop, and keeps the model away from the data.
- **C3. The tool answers, and the frontend phrases.** A lookup returns structured data (the goal, the places, the
  proposals apart, the agenda placements); the frontend composes the Dutch sentences from `nl.json`, as the deurmat's
  signals do. Only an explanation is text the model wrote.
- **C4. An explanation must be grounded.** An `uitleg` that names no chapter the handleiding has is shown as
  `onbekend`: the cat says it does not know rather than pass on an answer from nowhere.
- **C5. Ambiguity asks, never guesses.** A term that fits several goals, thema's, subthema names or activiteiten
  returns up to eight candidates; the gebruiker picks one and the same lookup runs again with it, without the model.
  Several subthema's or activiteiten with the very same name are one subject in several places, and the answer names
  each place.
- **C6. The gebruiker sees only what her screens show.** Thema's, subthema's, subdoelen and shared activiteiten are the
  school's. An own activiteit is found only by its owner, the leerkrachten and hoofdleerkrachten of its leeftijd and an
  admin (ADR-0049 D3). An algemene fiche and the agenda are shown only for the klassen she may read (ADR-0040), in the
  schooljaar she is looking at. A decided link is a place; a proposed one is named apart; a rejected one never. The
  ontwikkelingsrapport is not in the lookups at all.
- **C7. Nothing is kept or logged.** No table, no cache. The question, the terms and the answer stay out of every log
  line, the framework's trace of an action's arguments included, which is why the request and answer types print only
  their kind.

Defaults of this session, which the owner may change on his own:

- **D1.** Each question stands alone: the model is not sent earlier turns. A follow-up that leans on the previous
  answer ("en in thema Water?") may not be understood. Sending the previous turns would make every question costlier.
- **D2.** A question holds at most 500 characters; an explanation at most 1,500.
- **D3.** A goal is found on its exact code or ref, ignoring case, and otherwise on every word of three letters or more
  in its text. Goals no longer in Op.stap are not found.
- **D4.** The agenda answer lists at most 40 placements, and says how many there are.
- **D5.** A dekking question ("is doel x gedekt?", "hoeveel procent?") is `onbekend`, as the owner ruled on 2026-09-15;
  why a goal is not gedekt is a question about the tool, and the handleiding answers it.

## Alternatives considered

- **Send the data to the model and let it answer.** Rejected by O2: costlier, and an answer about the content could
  then be invented or leak what a gebruiker may not see.
- **Provider tool use in a loop.** Rejected (C2): two providers to support, several calls per question, and the model
  would read the data it returns.
- **A search over the handleiding in code, no model.** Rejected: a teacher asks in her own words, and matching those to
  a chapter is what the model is good at.

## Consequences

**Positive:** an answer about the content is exact and filtered by the same rules as the screens; one cheap call per
question, most of it cacheable; the model never sees school content in the chat.

**Negative / trade-offs:** the handleiding must be kept up to date with the app, or the cat explains an older app; the
lookups cover only these five questions; a follow-up question does not know the previous one (D1).

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| No school content in the request (C1) | `KatchatPromptBuilder`; `KatchatServiceTests` |
| The answer comes from the tool's data (C3, IV.4) | `Katopzoeker`; `KatopzoekerTests`, `KatchatEndpointsTests` |
| An explanation must be grounded (C4) | `KatchatAntwoordParser`; `KatchatAntwoordParserTests` |
| Only what her screens show (C6, VI.1) | `Katopzoeker`, `KatchatController`; tests for own activiteiten and klassen |
| Nothing kept or logged (C7, ADR-0059 D6) | no table; `KatchatEndpointsTests` captures every log line at Trace |
