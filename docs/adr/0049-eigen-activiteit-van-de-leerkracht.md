# ADR-0049 — A leerkracht's new activiteit is her own; her jaarfase colleagues read it and copy it

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Project owner, 2026-09-15: the rulings E1 to E4 below, recorded in FB-015 (*Beslissingen van de
  eigenaar*) and FB-025. The owner chose on 2026-09-16 to build FB-015 before FB-025. Directie has not been asked.
- **Answers:** [ADR-0030](0030-rollen-en-rechten-in-de-app.md) §4 open question **(a)** (who owns personal content, and
  who sees it) **for activiteiten**, and I6 for activiteiten. Personal **subdoelen** stay open with E6-10. This is part 2
  of the ADR-0030 §5 amendment, for activiteiten only.
- **Relates to:** [ADR-0043](0043-eigen-woordweb-per-subthema.md) (the woordweb, the first personal content, whose
  shape this follows), [ADR-0047](0047-dekkingsprognose-en-dekking.md) (the two steps of dekking),
  [ADR-0025](0025-subthema-per-leeftijd.md) (content per leeftijd).
- **Realises:** FB-015; FR-3.1, FR-3.2. FB-016 (proposing an own activiteit to the subthema) and FB-025 (AI-proposed
  activiteiten) build on it. **Constitution:** Art. V.1, VI.1, IX.2, XII.

## Context

Until now every activiteit was shared: it hung under a subthema of one leeftijd, and every leerkracht of that
leeftijd saw it and edited its content (R17, R23). An activiteit that a leerkracht thought up for her own klas ended up
in the shared offer. The maker (R26) only decided who could delete it. ADR-0030 left open whose personal content
would be, and who sees it ((a)), and nothing personal was built for activiteiten.

## Decision

Four rulings of the owner (E1 to E4, FB-015, 2026-09-15):

- **E1.** A new activiteit that a leerkracht creates is **her own** by default. It belongs to her, not to her klas, and
  it follows her into the next schooljaar.
- **E2.** The leerkrachten of **the same jaarfase** read her own activiteiten and may **use** one. Using it gives them
  an **own copy**, with the same content and goals, which they may edit. They cannot edit the original.
- **E3.** The owner **links goals** to her own activiteit herself. Once it is planned in the agenda of her klas, those
  goals **count for that klas's dekking**.
- **E4.** An activiteit that an AI proposal becomes, once accepted, is an own activiteit of whoever accepted it
  (FB-025). Sharing an own activiteit with the subthema is FB-016.

Defaults, not ruled, which the build follows until the owner changes one (FB-015 *Open vragen*, and this build):

- **D1.** A leerkracht no longer creates a **shared** activiteit directly: what she creates is her own, and sharing is
  FB-016. A hoofdleerkracht of that jaarfase and directie still create shared ones, and choose, per new activiteit,
  between their own and a shared one. The wizard keeps creating shared ones (R32). Editing the **content** of a shared
  activiteit stays with every leerkracht of that leeftijd (R17, R23).
- **D2.** Who may create an own activiteit: a leerkracht with a klas at the subthema's leeftijd (the "LK leeftijd"
  relation), and directie. A gebruiker without such a klas (ADR-0030 §3 footnote ¹) may not.
- **D3.** Who reads an own activiteit: its owner, the leerkrachten and the hoofdleerkrachten of its leeftijd, and
  directie. Nobody else finds it under the subthema. Where it is **planned** in a klas's agenda, whoever reads that
  klas's planning (ADR-0040) sees it there, because the agenda is the klas's.
- **D4.** Who edits an own activiteit, links and unlinks its goals, moves it to another thema and deletes it (with or
  without goal links): its owner and directie. A hoofdleerkracht does not.
- **D5.** Who may **use** (copy) an own activiteit of someone else: whoever may create an own activiteit at its
  leeftijd (D2). The copy is a new own activiteit of the caller under the same subthema, with the same fields and the
  same goal links, each copied as `manueel`. It is not tied to the original: a later change to one does not reach the
  other (FB-015 *Buiten scope*).
- **D6.** Only its owner, or directie, plans an own activiteit in a klas's agenda, and only in a klas where they may edit
  the planning. A colleague uses it first (D5) and plans her copy.
- **D7.** Dekking (Art. V.1, amended): the goal links of an own activiteit **never** count through the subthema route,
  for any klas. For a klas they count in the **dekkingsprognose** when its owner teaches that klas and the klas is at
  the activiteit's leeftijd, or when the activiteit is planned there; they are **gedekt** when the activiteit has at
  least one placement (`Activiteitplaatsing`) in that klas's agenda. The evidence names the activiteit as an own
  activiteit, never as a thema or a subthema.
- **D8.** When directie removes the owner as a gebruiker, her own activiteiten become **shared** (as I17 does for a
  maker): the owner is set to none, and from then on the shared rules and the subthema route of dekking apply.
- **D9.** Deleting a subthema deletes the own activiteiten under it, as it deletes the shared ones today; a placed one
  still blocks the delete. The FR-1 import never matches, overwrites or deletes an own activiteit. The AI prompts for
  a thema (doelsuggesties, the wizard) and the thema's overviews of goals and counts read shared activiteiten only.

## How it is built

- **Domain.** `Activiteit` gains `EigenaarId` (a `Gebruiker`, or none for a shared one), set at creation and by nothing
  else, apart from the database setting it to none when the gebruiker goes (D8). `IsEigen` is `EigenaarId != null`.
  The maker (R26) stays as it is: for an own activiteit it is the same person.
- **Rights.** `Activiteitbron` carries the owner. On an own activiteit, the existing activiteit rows
  (`GedeeldeActiviteitBewerken`, `ActiviteitVerwijderen`, `DoelenKoppelen`, `ActiviteitVerplaatsen`) match only the
  column `Eigenaar`, which also serves the woordweb; the HL, "LK leeftijd" and maker columns do not match it (D4). New
  rows: `EigenActiviteitMaken` ("LK leeftijd", on the subthema), `GedeeldeActiviteitMaken` (HL, on the subthema),
  `EigenActiviteitLezen` and `EigenActiviteitGebruiken` (on the activiteit, D3, D5).
- **Planning.** The weekplanning service refuses to plan someone else's own activiteit (D6).
- **Dekking.** The store's subthema read and candidate read skip own activiteiten; a new read returns the goal links of
  the own activiteiten that concern the klas (D7); the payload gains `DekkendeActiviteiten`, which the screen and the
  export name as own activiteiten.

## Consequences

- A leerkracht keeps her own offer without touching the shared one, and it is still there next year.
- A goal link a leerkracht makes now counts only for her own klas, and only once she plans the activiteit, so R19's
  reason for keeping goal links from leerkrachten (a link counts for every klas at that leeftijd) does not reach it.
- Two leerkrachten of one jaarfase can hold near-identical copies. That is intended: a copy is hers to change.
- The shared layer remains (I6), and the wizard, the import and a hoofdleerkracht still fill it.

## Alternatives considered

- **The activiteit belongs to the klas.** Rejected by E1: it has to follow the leerkracht into the next schooljaar.
- **Colleagues plan the original directly.** Rejected by E2: whoever plans it gets her own copy, so the original's owner
  keeps control of what she wrote.
- **Goals of an own activiteit count through the subthema, like a shared one.** Rejected by E3: they count for the
  owner's klas, and a subthema route would make them count for every klas at that leeftijd.
