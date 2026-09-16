# ADR-0052 — A thema's doelsuggesties propose minimumdoelen as themadoelen

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Project owner, 2026-09-16: the rulings O1 to O5 below, given on FB-053's open questions and in the
  session that started it. Directie has not been asked.
- **Supersedes:** in [ADR-0047](0047-dekkingsprognose-en-dekking.md), S2 and the doelsuggestie half of D4 (an accepted
  doelsuggestie of a thema no longer counts for a leerplandoel). Settles M7 of
  [ADR-0046](0046-themadoelen-zijn-minimumdoelen.md).
- **Relates to:** [ADR-0030](0030-rollen-en-rechten-in-de-app.md) (R14: directie and themabeheer generate and review
  doelsuggesties), [ADR-0047](0047-dekkingsprognose-en-dekking.md) S4 (the mijlpaal of a jaar/fase).
- **Realises:** FB-053; FR-4.1, FR-4.2, FR-4.3. **Constitution:** Art. V.1 and IX.2 (amended); IV, VI.1 and IX.2's
  themadoel line unchanged.

## Context

Since ADR-0046 a themadoel a person adds is a minimumdoel. The AI at thema level (the thema page's *Vraag suggesties*
and the wizard's step 2) still proposed leerplandoelen, an accepted proposal did not become a themadoel, and it counted
for a leerplandoel's dekking through the thema's placement (ADR-0047 S2), a route no screen explained any more.

## Decision

The owner's rulings:

- **O1.** At thema level the AI proposes **only minimumdoelen**, as themadoel, on the thema page and in the wizard's
  themadoelen step. Accepting one makes it a themadoel, the same link a person makes by hand (ADR-0046). A rejected one
  does not come back on a next request. Only directie and themabeheer generate and review, checked by the server.
- **O2.** **Every existing thema-level leerplandoel doelsuggestie goes**, open and accepted, and none counts for dekking
  any more. Leerplandoelen reach a thema through its subthema's and their subdoelen.
- **O3.** The candidates are the minimumdoelen of the mijlpalen the thema's leeftijden meet, by
  `Jaarfasen.MijlpalenVoor` (a kleuterjaar `K-`, L1 to L4 `4-`, L5 and L6 `6-`). A thema without subthema's first asks
  the person for leeftijden, as before.
- **O4.** The AI requests for subdoelen and for a jaarplan receive the thema's minimumdoel themadoelen.
- **O5.** Subdoel suggestions for a subthema stay leerplandoelen.
- **O6.** Proposals are shown in the model's order, best fit first.
- **O7.** A proposal is only accepted or rejected (D2 below, confirmed by the owner): whoever wants another minimumdoel
  rejects the proposal and links that one by hand. Art. IV.2, VI.1 and XII say so.
- **O8.** A minimumdoel accepted and later unlinked as themadoel may be proposed again. A current themadoel, an open
  proposal and a rejected proposal are not proposed again.

Defaults of the building session, which the owner may change on their own:

- **D1.** An accepted proposal stays stored as `aanvaard` beside the themadoel it made, a rejected one as `geweigerd`.
  A thema holds one proposal per minimumdoel, so when a minimumdoel accepted and later unlinked is proposed again
  (O8), its row goes back to `voorgesteld` with the new motivation and rank.
- **D2.** A proposal is decided once, from `voorgesteld`, by accepting or rejecting it. FR-4.3's *aanpassen* is not
  offered for a minimumdoel: the person links another one by hand, which is the same act. The owner confirmed this
  (O7).
- **D3.** A run asks the model for at most eight proposals with a one-sentence motivation each, and keeps at most
  eight.
- **D4.** The wizard's step 2 stays transient, as it was: it returns proposals and stores nothing, and the wizard's
  `gekozenThemadoelCodes` now hold minimumdoel refs. Step 6 writes them with their text into the subdoel prompt.
- **D5.** A minimumdoel that Op.stap no longer carries (`NietMeerInOpstap`) is no candidate.
- **D6.** O6 is kept as a rank per proposal, its position in the model's answer; a later run ranks after the
  proposals already on the thema, and the read sorts by rank.

## How it is built

- **Domain.** `Minimumdoelsuggestie` (`Id`, `ThemaId`, `MinimumdoelRef`, `Status`, `AiMotivatie`) replaces the
  `DoelKoppeling` rows of `Thema.Doelsuggesties`, in a new table `thema_minimumdoelsuggesties` and a rank, with a
  restricting foreign key to `minimumdoelen.Ref` and a unique index on `(ThemaId, minimumdoel_ref)`. A write that
  collides with a concurrent one on that index answers 409 with a Dutch sentence.
  `Thema.AanvaardDoelsuggestie` sets the status and links the minimumdoel through `KoppelMinimumdoel` when it is not
  linked yet.
- **Migration.** `Minimumdoelsuggesties` creates the new table and **drops `thema_doelsuggesties`** with its rows (O2).
  It is **not reversible**: its `Down` recreates the old table empty.
- **Prompt.** A fixed system prompt (the rules, the JSON contract `{"suggesties":[{"code","motivatie"}]}` that
  `DoelMatchResponseParser` reads, at most eight), then a user prompt that starts with the candidate list written by
  `MinimumdoelPromptlijst` (grouped by mijlpaal and `leergebied > rubriek > subrubriek`, one `- <ref>: <omschrijving>`
  line per goal, ordered by ref, so the same mijlpalen give the same bytes), then the thema, then the refs not to
  propose. That order lets the list move into a cached prefix later without reshaping the prompt.
- **Routes.** `GET` and `POST …/genereer` under `/api/themas/{id}/doelsuggesties` as before, now with minimumdoelen;
  `PUT …/{suggestieId}/status` takes `Aanvaard` or `Geweigerd`. `PUT …/{suggestieId}/leerplandoel` is removed (D2).
- **Dekking.** The doelsuggestie route is gone from `DekkingService` and `IDekkingOpslag`. For a leerplandoel the lacune
  causes that depend on a thema placement (*wacht op beslissing*, *plaatsing geweigerd*) no longer occur; they remain
  for minimumdoelen.
- **Reads.** The leerplandoel register's *Gebruikt in*, the thema's *doelen per leeftijd* and the ongekoppelde-doelen
  query no longer know a doelsuggestie. The jaarplan prompt and the calendar card list a thema's minimumdoelen beside
  any leerplandoel themadoel the import wrote.

## Consequences

- A klas's leerplandoel dekking drops where it rested on accepted thema doelsuggesties. That is the ruling (O2).
- The generation report's *if you accept the plan* figure (`Dekkingsvooruitzicht`) counts leerplandoelen, which a
  proposed thema placement no longer moves, so its two figures are now always equal. Whether it should count
  minimumdoelen instead is a follow-up question for the owner.
- A prompt with the `K-` minimumdoelen is about 11,000 tokens, well under the ceiling of TB-007.
