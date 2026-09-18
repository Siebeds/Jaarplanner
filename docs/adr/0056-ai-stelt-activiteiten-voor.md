# ADR-0056 — The AI proposes activiteiten under a subthema, and an accepted one is the asker's own

- **Status:** Accepted; D6 superseded in part by [ADR-0060](0060-activiteitvoorstellen-op-een-aanbod-gat.md) for the proposals the cat brings
- **Date:** 2026-09-17
- **Deciders:** Project owner: A1 on 2026-09-17, given in session when FB-025 was picked up ("de grondwet mag
  genegeerd/aangepast worden"); A2 on 2026-09-15 (FB-025, and ADR-0049 E4); A3 on 2026-09-17, answering the audit of
  FB-025. Directie has not been asked.
- **Relates to:** [ADR-0010](0010-ai-advisory-architecture.md) (AI advisory), [ADR-0043](0043-eigen-woordweb-per-subthema.md)
  and [ADR-0050](0050-ai-plaatst-leerplandoelen-in-subthemas.md) (the earlier Art. IV.4 exceptions),
  [ADR-0049](0049-eigen-activiteit-van-de-leerkracht.md) (the own activiteit an accepted proposal becomes),
  [ADR-0051](0051-ai-voorstel-draagt-een-vage-ring.md) (how a proposal looks).
- **Realises:** FB-025; FR-4.1 to FR-4.3; FA A.7 step 7 (rijk aanbod). **Constitution:** Art. IV.1, IV.4, IV.5, IV.8,
  VI.1, IX.2 and XII (amended); I.2 and V.1 unchanged.

## Context

A leerkracht thinks up every activiteit under a subthema herself. The owner asked for the AI to propose activiteiten
that work on the subthema's subdoelen, each accepted or rejected. Art. IV.4 grounded the AI on the school's own data
and the loaded goals, with two exceptions (a woordweb's words, the name and onderzoeksvraag of a proposed thema or
subthema). An activiteit's name and what the kleuters do in it are in neither.

## Decision

The owner's rulings:

- **A1.** The AI may **make up an activiteit** from its own knowledge: its name, its soort, what the kleuters do and
  what is expected (the activiteit's `verwachteUitkomsten`), and its length. Every goal it links is a subdoel of the
  subthema, and nothing it proposes becomes an activiteit before it is accepted. It writes no lesson material
  (Art. I.2): no worksheet, no written-out lesson, only the fields an activiteit already has.
- **A2.** An accepted proposal becomes an **own activiteit** of the person who asked for it (ADR-0049 E4), with the
  goals accepted. Sharing it with the subthema is FB-016.
- **A3.** **Directie sees and decides every leerkracht's proposals** (R3, "directie sees and edits everything"). An
  acceptance by directie still makes the asker's own activiteit.

Defaults of the building session, which the owner may change on their own:

- **D1. Who asks.** Whoever may create an own activiteit under that subthema: the `EigenActiviteitMaken` row, a
  leerkracht with a klas at its leeftijd, and directie (ADR-0049 D2). Asking needs no new matrix row.
- **D2. The proposals are personal.** A colleague neither sees nor decides another's proposals. The asker decides hers
  only while she may still create an own activiteit at that leeftijd, so one who lost her klas there can no longer
  accept or reject them; they count for nothing, and a new asker or directie can act instead.
- **D3. How many.** At most **5** per request, set by `Activiteitvoorstellen:MaxPerVraag` (1 to 10).
- **D4. A new request replaces** the asker's open proposals under that subthema; decided ones stay. A request that
  keeps no proposal leaves the open ones as they were.
- **D5. Rejected stays out.** The prompt lists the names of the asker's rejected proposals under that subthema; a
  proposal the model gives one of those names anyway is dropped. So is one named like an activiteit already there
  (the shared ones and the asker's own).
- **D6. The goals.** The candidates are the subthema's decided subdoelen (`aanvaard` or `manueel`). A subthema without
  one is refused with a sentence: there is nothing to work on. A code outside them is dropped from the proposal, and a
  proposal with no valid code left is dropped.
- **D7. Validation.** A proposal is also dropped without a name, expected outcomes or a motivation, with a name over
  200 or expected outcomes over 1000 characters, or a length outside 1 to 4 lesuren. An unknown soort becomes none
  (FB-050), and an onderzoeksvraag key the prompt did not list becomes none.
- **D8. Accepting.** The asker may first change the name, soort, expected outcomes, length and which goals come along
  (at least none: an activiteit without goals is allowed). An unchanged proposal is stored as `aanvaard`, a changed one
  as `manueel`. Two simultaneous decisions on one proposal cannot both be saved (a row version). The new activiteit has
  the asker as owner and maker; each goal it keeps is a link with status
  `aanvaard` and the proposal's motivation, so it counts only as an own activiteit does (Art. V.1). A goal that is no
  longer a decided subdoel of the subthema is refused with a sentence.
- **D9. Lifetime.** A proposal goes with its subthema and with its asker.

## How it is built

- **Domain.** `Activiteitvoorstel` (`SubthemaId`, `GebruikerId`, `Naam`, `ActiviteitType?`, `VerwachteUitkomsten`,
  `LengteInLesuren`, `OnderzoeksvraagId?`, `LeerplandoelCodes`, `Status`, `AiMotivatie`, `ActiviteitId` once accepted),
  one table `activiteitvoorstellen`, cascading from the subthema and the gebruiker. It is deliberately **not** an
  `Activiteit` row: those feed the agenda, the dekking and the thema's counts.
- **Prompt.** A fixed system prompt with the rules and the JSON contract
  `{"activiteiten":[{"naam","soort","verwachteUitkomsten","lengteInLesuren","onderzoeksvraag","doelen":[code],"motivatie"}]}`,
  where `onderzoeksvraag` is a short key the prompt lists (`V1`, …) or null. The user prompt holds the thema, the
  subthema with its onderzoeksvragen and decided subdoelen, the names and soort of the activiteiten already there, and
  the rejected names; no gebruiker and no pupil data. Its size is bounded as every AI call is (TB-007).
- **Routes.** `GET /api/subthemas/{id}/activiteitvoorstellen` (the caller's open ones, and for directie everyone's),
  `POST /api/subthemas/{id}/activiteitvoorstellen/genereer` under `EigenActiviteitMaken` at the subthema's leeftijd, and
  `PUT /api/activiteitvoorstellen/{id}/beslissing` under a new matrix row, `ActiviteitvoorstelBeslissen`, whose one
  column is the proposal's asker while she is "LK leeftijd" there (resource `Activiteitvoorstelbron`); directie passes
  it as every row (A3).
- **Screen.** In a subthema chapter, under its activiteiten: the AI button, and each open proposal in the faint ring of
  ADR-0051 with the quiet check, pencil and cross; a proposal of someone else, which only directie is sent, names its
  asker.

## Alternatives considered

- **Store a proposal as an `Activiteit` with a status.** Rejected for the reason ADR-0050 rejected it for subdoelen:
  the agenda, the dekking and the counts read activiteiten without a status.
- **Let the hoofdleerkracht decide, and make the result shared.** Rejected by A2.
- **Keep Art. IV.4 closed and only rank existing activiteiten.** Rejected by A1: the owner wants new ideas.

## Consequences

**Positive:** a leerkracht gets concrete starting points under a subthema, already tied to its subdoelen.

**Negative / trade-offs:** a third Art. IV.4 exception, and the widest so far: an activiteit's content may come from
the model's knowledge, and whoever accepts it is responsible for it. Colleagues do not see each other's proposals.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| Only subdoelen of the subthema as goals, rejected and existing names dropped (D5 to D7) | `ActiviteitvoorstelValidator`; its unit tests |
| Only the asker and directie see and decide a proposal (D2, A3) | the `ActiviteitvoorstelBeslissen` row; `RechtenmatrixTests` and the endpoint tests |
| Asking needs `EigenActiviteitMaken` (D1) | `[RechtOp]` on the routes; the route sweep and the endpoint tests |
| Accepting writes an own activiteit with `aanvaard` links (A2, D8) | `ActiviteitvoorstelService`; the endpoint tests |
| The AI is faked in tests (Art. IV.6) | the unit and integration tests |
