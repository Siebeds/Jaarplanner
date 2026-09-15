# ADR-0041 — A leerkracht keeps her own woordweb per subthema, and the AI may add words to it

- **Status:** Accepted
- **Date:** 2026-09-15
- **Deciders:** Project owner, 2026-09-15: the rulings W1 to W7 below, given in session and recorded in FB-036
  (*Beslissingen van de eigenaar*). Directie has not been asked.
- **Answers:** [ADR-0030](0030-rollen-en-rechten-in-de-app.md) §4 open question **(a)** (who owns personal content, and
  who sees it) **for the woordweb only**. For personal activiteiten and subdoelen (a) stays open with E6-10.
- **Relates to:** [ADR-0010](0010-ai-advisory-architecture.md) (AI advisory), [ADR-0026](0026-streefwoordenschat-op-subthema.md)
  (the streefwoordenschat a word may later be carried to), [ADR-0039](0039-ai-knoppen-regenboogring.md) (the AI control).
- **Realises:** FB-036; FA A.7 step 3; FR-3.1, FR-4.2, FR-4.3. **Constitution:** Art. IV.1, IV.4, IV.5, IV.8, VI.1, IX.2.

## Context

The school's goal-first method has ten steps (FA A.7, Art. IV.8), and step 3 is a **brainstorm**. The tool had nothing
for it: what a teacher thought of stayed on paper. Art. IV.8 gave the AI a place at step 2 and step 6 only, and Art.
IV.4 let it ground on the school's data and Op.stap alone, so an AI that suggests words from its own knowledge of the
language fitted neither.

## Decision

Seven rulings of the owner (W1 to W7):

- **W1.** The brainstorm is a **woordweb**: loose words around the subthema's name, without branches.
- **W2.** Every leerkracht keeps her **own** woordweb, and sees her colleagues' webs, which she cannot change.
- **W3.** A woordweb hangs on a **subthema**, not on the thema. The method puts the brainstorm before the subthema's
  (step 3 before step 4); the owner chose the subthema knowingly, because that is where the work in the klas happens.
- **W4.** A woordweb **follows the leerkracht** across schooljaren: one web per gebruiker and subthema, still there when
  the thema comes back next year.
- **W5.** The AI may propose words, but **only once the web holds a word of the teacher's own**, so it does not run
  ahead of her (Art. IV.8). Each proposal carries a short motivation and is accepted or rejected one by one; the
  decision is stored (Art. IV.1 to IV.3).
- **W6.** The AI proposes words **from its own knowledge of the language**. That needs an exception in Art. IV.4. What
  it is sent is still only the school's own data: the subthema with its onderzoeksvragen, its thema, and the words
  already in that web.
- **W7.** Carrying a word to the subthema's **streefwoordenschat** is left out: that list does not exist yet (E10-01,
  ADR-0026, is designed and not built). It becomes a ticket of its own after E10-01.

Six defaults, not ruled, which the build follows until the owner changes one (FB-036 *Open vragen*):

- **D1.** At most **five** proposals per request, and a rejected word is never proposed again for that web (as
  FB-026 for goals).
- **D2.** Every signed-in gebruiker may keep a woordweb on any subthema, whatever her other rights, because a woordweb
  counts for nothing.
- **D3.** Directie edits every woordweb (R3, *directie sees and edits everything*).
- **D4.** Deleting a subthema deletes the woordwebs on it, and the confirmation says how many; removing a gebruiker
  deletes her woordwebs.
- **D5.** For themabeheer's thema delete (I26), a woordweb under the thema counts as someone else's content, whoever
  made it. The resolver knows no caller, so it fails closed.
- **D6.** A word the teacher takes out of her web is gone, and the AI may propose it again. Only a word she
  **rejected** is kept, as `geweigerd`, so it stays out.

## How it is built

- **Domain.** `Woordweb` (one per `(SubthemaId, EigenaarId)`, unique) holds `WoordwebWoord`en, each a word with a
  `KoppelingStatus` (`manueel` for a typed word, `voorgesteld` → `aanvaard` / `geweigerd` for an AI word) and an
  `aiMotivatie`. The same four statuses as a goal link, because Art. IV.2 names them for every AI output. Words are
  compared without regard to case; a typed word that the AI had proposed or the teacher had rejected becomes hers
  (`manueel`). The aggregate refuses an AI request on a web that holds no `manueel` or `aanvaard` word (W5).
- **Rights.** A matrix row of its own, `WoordwebBewerken`, with one column, `Eigenaar`, on a resource of its own,
  `Woordwebbron`. Directie passes it (D3). Reading every woordweb needs only a session. Creating one's own web needs
  only a session too (D2): the web is created for the caller, never for an id in the body.
- **AI.** `WoordwebPromptBuilder` builds the request from the school's data only (W6) and asks for
  `{"woorden": [{"woord": "…", "motivatie": "…"}]}`; `WoordwebResponseParser` validates it and an invalid answer
  stores nothing (Art. IV.5). A word already in the web in any status, a blank one, or one longer than the column is
  skipped; at most five are kept (D1). No pupil data reaches the prompt: a woordweb holds none.
- **Dekking** does not read a woordweb, and a test pins that.

## Consequences

- Step 3 of the method now exists in the tool, per teacher, before any wizard screen exists (E6-05).
- A second kind of AI output exists that is not grounded on school data alone. The exception is narrow: its output is
  a word with a motivation, never a goal, a code or a fact about the curriculum, and it is always accepted by hand.
- ADR-0030 (a) is answered for one kind of personal content. E6-10 still owes the answer for activiteiten and
  subdoelen, and may choose differently for them.

## Alternatives considered

- **A woordweb on the thema, as the method orders the steps.** Offered and recommended; the owner chose the subthema
  (W3).
- **One shared web for the team.** Not what the owner asked (W2).
- **An AI that only picks from the school's and Op.stap's vocabulary**, keeping Art. IV.4 unchanged. Offered; the
  owner chose the better brainstorm with an exception (W6).
- **Carrying words to the streefwoordenschat in this change.** It would build part of E10-01 while its pedagogy is
  still asked of directie (question 10); the owner split it off (W7).

## Compliance trace

| Claim | Where |
| --- | --- |
| AI proposes, the web's owner decides, every decision is stored with its status | Art. IV.1, IV.2, IV.3; W5 |
| The AI is sent only school data, and its words come from its language knowledge by exception | Art. IV.4 (amended); W6 |
| Structured JSON, validated before use; an invalid answer stores nothing | Art. IV.5 (amended) |
| The AI does not run ahead of the teacher at step 3 | Art. IV.8 (amended); W5 |
| Personal content: owner and directie edit, everyone reads | Art. VI.1 (amended); W2, D2, D3 |
| The woordweb in the data model | Art. IX.2 (amended) |
| Dekking unchanged | Art. V.1 |
