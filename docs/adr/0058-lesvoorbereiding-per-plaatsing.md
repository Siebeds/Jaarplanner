# ADR-0058 — The AI writes a lesvoorbereiding per plaatsing, and Art. IV.4 becomes one rule

- **Status:** Accepted
- **Date:** 2026-09-18
- **Deciders:** Project owner, in the sparring session of 2026-09-18 on the agentic extension and in TB-056 the same
  day. Directie has not been asked.
- **Relates to:** [ADR-0010](0010-ai-advisory-architecture.md) (AI advisory), [ADR-0043](0043-eigen-woordweb-per-subthema.md),
  [ADR-0050](0050-ai-plaatst-leerplandoelen-in-subthemas.md) and [ADR-0056](0056-ai-stelt-activiteiten-voor.md) (the
  three Art. IV.4 exceptions this rule replaces), [ADR-0057](0057-vervanging-briefing-en-klasfiche.md) (the vervanger,
  who reads a lesvoorbereiding), [ADR-0059](0059-de-kat-proactieve-agent.md) (the cat that prepares them during a
  vervanging).
- **Realises:** TB-056; FB-067, FB-068; FR-14.6. **Constitution:** Art. I.2, IV.1, IV.2, IV.4, IV.5 and
  IX.3 (amended).

## Context

An activiteit in the agenda says what happens, not how. A leerkracht prepares each one herself, and a vervanger has
no time to. Art. I.2 kept "automatic generation of the actual lesson material" out of scope, and ADR-0056 A1 repeated
it for activiteitvoorstellen. Art. IV.4 grounded the AI on the school's data, with three exceptions that each let the
model make up content; a fourth for lesvoorbereidingen would make the list the rule.

## Decision

The owner's rulings:

- **L1. Lesson material is in scope.** The non-goal leaves Art. I.2, and the AI may write a lesvoorbereiding.
- **L2. Its form:** the goals, an instap, a kern, an afsluiting, the materiaal, the woordenschat, differentiatie
  (easier and more challenging, without names) and a duur, with a short motivation.
- **L3. It hangs on the plaatsing:** that activiteit, on that day, in that klas. It moves with the plaatsing.
- **L4. When:** for the vaste leerkracht **on request only**; during a vervanging the cat prepares them unasked,
  rolling (ADR-0059).
- **L5. The vervanger reads** a lesvoorbereiding, open or decided, and decides none (ADR-0057 V2).
- **L6. Art. IV.4 becomes one rule** instead of a list of exceptions: the AI may make up **content** from its own
  knowledge; every **goal** it names or links is a loaded Op.stap goal it was sent; what it is sent is the school's
  own data and those goals. The rewrite of an ontwikkelingsrapport text keeps its narrower rule.

Defaults of this session, which the owner may change on their own:

- **D1. Who asks and decides:** whoever may edit the klas's agenda: its leerkrachten ("LK eigen") and directie. Who
  reads the klas's planning (ADR-0040) reads a decided lesvoorbereiding; the vervanger reads open ones too, since the
  cat prepares them for her.
- **D2. Status** as Art. IV.2: `voorgesteld`, `aanvaard` (unchanged), `manueel` (edited before accepting) or
  `geweigerd`. A plaatsing has at most one open proposal and one decided lesvoorbereiding; a new request replaces the
  open one; accepting replaces the decided one. The cat never remakes a rejected one by itself.
- **D3. The goals:** only the activiteit's decided goal links (`aanvaard` or `manueel`). A code outside them is dropped.
  An activiteit without goals gets a lesvoorbereiding without a goals section.
- **D4. What the AI is sent:** the activiteit (name, soort, expected outcomes, length) with the text of its decided
  goals; the subthema (onderzoeksvragen, kern- and streefwoordenschat, the words of the klas's leerkrachten's woordweb
  on it); the thema; the plaatsing's day and hours; the klasfiche. No gebruiker's name and nothing about a child.
- **D5. Validation:** each section present and at most 2000 characters; the duur in minutes and within the plaatsing's
  begin and end; the motivation present. A response that fails is dropped with an English log line and a Dutch
  sentence for the person who asked.
- **D6. Lifetime:** it goes with its plaatsing. It never counts for dekking.
- **D7. Budget:** each call counts against the school's AI budget once FB-055 exists.

## The rule Art. IV.4 now states

The AI is sent only the school's own data and the loaded Op.stap goals, never an external or unknown source, and the
tool sends no pupil data of its own accord. Within that, it may make up **content** from its own knowledge: the words
of a woordweb, the name and onderzoeksvraag of a thema or subthema it proposes, an activiteit's name, soort, expected
outcomes and length, a lesvoorbereiding. **Every goal it names or links is one of the loaded goals it was sent**, never
a goal, a code or a fact about the curriculum of its own, and which goals are candidates is each feature's own rule,
recorded in its ADR (the subthema's subdoelen for ADR-0056, the aanbod-gat for ADR-0060, the activiteit's goals here).
Nothing it makes up is final before a person decides it (IV.1). In the cat's chat, the question the gebruiker types
goes as typed, and an answer about the school's content comes from the tool's data (ADR-0059). The rewrite of an
ontwikkelingsrapport text sends only the teacher's text, with the klas's children's names replaced, and makes up
nothing beyond rewording it.

## Alternatives considered

- **A fourth exception.** Rejected by L6: four exceptions to one rule are a different rule, badly stated.
- **Hang it on the activiteit.** Rejected by L3: an own activiteit of the absent leerkracht is hers to edit
  (ADR-0049), and a lesvoorbereiding for one klas's Tuesday is not content of the leeftijd.
- **Prepare them for everyone, every evening.** Rejected by L4: the cost grows with every klas every day, for
  preparations most leerkrachten did not ask for.

## Consequences

**Positive:** a vervanger finds prepared lessons; a leerkracht can ask for one; Art. IV.4 reads as the rule it had
become.

**Negative / trade-offs:** the widest AI content yet, and the leerkracht who accepts it is responsible for it. A
lesvoorbereiding for one plaatsing is not reusable next year (a later "bewaar bij de activiteit" could be).

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| Only the activiteit's decided goals (D3, L6) | the validator; its unit tests |
| Only the klas's leerkrachten and directie ask and decide (D1) | a matrix row on the klas; endpoint tests |
| The vervanger reads, never decides (L5) | the Vervanger relation of ADR-0057 is on no deciding row |
| Nothing about a child is sent (D4, Art. VI.2) | the prompt builder takes no free field about a child; a unit test on the prompt |
| The AI is faked in tests (Art. IV.6) | unit and integration tests |
