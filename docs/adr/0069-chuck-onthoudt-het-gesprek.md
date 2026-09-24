# ADR-0069 — The cat's chat is a conversation: the browser holds the turns, the server seals them

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Project owner, in FB-093 on 2026-09-23 (the last turns within a fixed bound, no summary; the server
  seals each turn; of a lookup only its kind and the names and codes found). Directie has not been asked.
- **Supersedes:** [ADR-0066](0066-de-chat-van-de-kat-kiest-een-opzoeking.md) D1 (each question stands alone), and C1
  in part (no school content in the request) and C2 in part (five lookups become six).
- **Relates to:** [ADR-0059](0059-de-kat-proactieve-agent.md) (D6: the chat stores nothing),
  [ADR-0048](0048-claude-api-als-tweede-ai-provider.md) (the two providers).
- **Realises:** FB-093; FR-14.10 in part. **Constitution:** Art. IV.2, IV.4, IV.5, VI.1 and VI.2 unchanged.

## Context

Under ADR-0066 D1 each question to the cat stood alone. A teacher does not talk like that: after "zit K-1.5.2 in thema
Herfst?" she asks "en in thema Water?", after "bij welk subthema hoort Plassen springen?" she asks "welke doelen heeft
dat subthema?". A model remembers nothing between calls; a conversation is its earlier turns sent again with every new
question. The tool keeps no conversation (Art. VI.2, ADR-0059 D6), so those turns can only come from the browser, and
a turn that comes from the browser can be forged: a gebruiker could insert an answer of the cat's to steer the model.

## Decision

- **G1. The browser holds the conversation; the server seals each turn.** Every answer carries its turn: the question
  as asked, the answer in the form the model is sent again, and an HMAC-SHA256 seal over the gebruiker's id, the
  question and the answer (`Katbeurtzegel`). The browser sends the turns back unchanged with the next question. The
  server checks every turn that goes along before it builds a prompt; one that does not check stops the question with
  a 409 and the model is not called. The frontend then says it lost the thread and starts again from the next
  question. A turn sealed for one gebruiker does not check for another. The seal proves a turn is the server's own and
  unchanged; it is not bound to one conversation, so while the process lives she can send her own earlier turns again,
  which is harmless under G5. A turn can carry text she chose herself: the question, and a term that found nothing or
  several (at most 200 characters), which sits in the cat's reply as what the tool did not find.
- **G2. The seal's key lives only in the process.** It is drawn at random when the API starts and kept nowhere, so a
  conversation over a restart starts again, and several instances would each refuse the others' turns (the demo runs
  one). Nothing about a conversation outlives the process that answered it.
- **G3. The last ten turns go along, no summary.** The model is sent the last `MaxBeurten` (10) turns, oldest first, as
  alternating user and assistant messages between the cacheable prefix (instructions and handleiding) and the new
  question (`AiRequest.Gesprek`, both providers). What falls out, the model no longer knows. A question is at most 500
  characters and an explanation 1,500, so the cost of a question stays bounded; `Promptbegrenzing` counts the turns.
- **G4. Of a lookup only its kind and the names and codes found go along** (`Katbeurtschrijver`): the goal's code, the
  thema, subthema and activiteit names, the subthema's and thema's an activiteit hangs in, or the term that found
  nothing or several. Never a place, the agenda, a klas, a goal's text or a yes or no. An explanation goes as it was:
  the model wrote it. This is school content in the request, which C1 excluded; Art. IV.4 allows the school's own data,
  and it is only what she already saw.
- **G5. The answer still comes from the tool, with her rights.** A follow-up is classified like any question, and a
  lookup runs over the tool's data with the rights of whoever asks (ADR-0066 C6). The conversation gives the model
  names to fill in, never data: a turn cannot open a klas she may not read.
- **G6. A sixth lookup, `doelenVanSubthema`**, answers "welke doelen heeft dat subthema?": the subdoelen of every
  subthema with that name, each with its leeftijd, decided and proposed apart.
- **G7. Nothing is kept or logged**, as ADR-0066 C7: the turns print only their kind, and the seal and the refusal name
  no content.

## Alternatives considered

- **Keep the conversation on the server.** Rejected: the tool keeps no conversation (VI.2, ADR-0059 D6).
- **Summarise older turns with the model.** Rejected by the owner: a second call per question, and a summary the model
  wrote is harder to bound and to check.
- **Send the full lookup result.** Rejected by the owner: a follow-up needs the subject, not the places, and the tool
  looks the rest up again.
- **No seal, trust the browser.** Rejected: a forged answer of the cat's is the known way to steer a chatbot.
- **A key in configuration or the Data Protection key ring**, so a conversation survives a restart. Not needed now; the
  seal sits behind `Katbeurtzegel` and can take a configured key later.

## Consequences

**Positive:** follow-up questions work in the words a teacher uses; the stable prefix stays cacheable; a changed or
invented turn never reaches the model. What she can still put in a turn is her own text (G1), which steers nothing
beyond a lookup run with her rights or an explanation only she sees.

**Negative / trade-offs:** each question costs its conversation's tokens again, up to ten turns; a restart or a second
instance ends every open conversation; the eleventh turn back is forgotten.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| A turn must carry a valid seal for her (G1) | `Katbeurtzegel`, `KatchatService`; `KatchatServiceTests`, `KatchatEndpointsTests` |
| At most ten turns go along (G3) | `KatchatPromptBuilder.MaxBeurten`; `KatchatServiceTests`, `Katchat.test.tsx` |
| Only kind, names and codes of a lookup (G4) | `Katbeurtschrijver`; `KatchatServiceTests` |
| The answer comes from the tool with her rights (G5) | `Katopzoeker`; `KatchatEndpointsTests` (follow-up stays in her klassen) |
| Nothing kept or logged (G7) | no table; `KatchatEndpointsTests` captures every log line at Trace |
