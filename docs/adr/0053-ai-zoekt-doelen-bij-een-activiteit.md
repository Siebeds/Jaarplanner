# ADR-0053 — The AI proposes goals for an activiteit, and an accepted one is proposed as subdoel

- **Status:** Accepted
- **Date:** 2026-09-17
- **Deciders:** Project owner. Rulings of 2026-09-15 in FB-026 (an accepted goal lands on the activiteit and is proposed
  as subdoel; at most 5 per run, repeatable; a rejected goal never comes back; the thema gets nothing of its own), and
  of 2026-09-17: *only a decided goal link stops the maker from deleting an activiteit* (R25), and the maximum is
  configuration, not a school setting.
- **Realises:** FB-026, the activiteit half of E8-07. **Constitution:** Art. IV.1 to IV.5, V.1, VI.1, IX.2.
- **Builds on:** [ADR-0049](0049-eigen-activiteit-van-de-leerkracht.md) (own activiteit),
  [ADR-0050](0050-ai-plaatst-leerplandoelen-in-subthemas.md) (the subdoelvoorstel),
  [ADR-0051](0051-ai-voorstel-draagt-een-vage-ring.md) (how a proposal looks).

## Context

A goal link on an activiteit has been made by hand only (`manueel`). FB-026 lets the AI propose them, which makes the
activiteit carry `voorgesteld` and `geweigerd` links for the first time. Several readers counted every link as linked,
among them the R25 delete rule, which the E6-02 audit left for the owner to answer before this path landed.

## Decision

1. **A proposal is a goal link on the activiteit** (`DoelKoppeling`, status `voorgesteld`, with the AI's motivation), as
   Art. IX.2 already describes. Accepting sets it to `aanvaard`, rejecting to `geweigerd`; both stay stored.
2. **Who asks and decides** is who may link the activiteit's goals: the `DoelenKoppelen` row. For a shared activiteit a
   hoofdleerkracht of its jaarfase or directie; for an own activiteit its owner or directie.
3. **Candidates** are the leerplandoelen of the subthema's leeftijd that are still in Op.stap, minus every goal already
   on the activiteit in any status. A run replaces the activiteit's open proposals and adds at most
   `ActiviteitDoelsuggesties:MaxVoorstellen` (configuration, default 5) new ones. A rejected goal is never proposed
   again: it is not a candidate, and the prompt names none. A code outside the candidates is dropped, not stored. An
   unreadable answer stores nothing (422).
4. **An accepted goal that is not yet a subdoel of the activiteit's subthema is proposed as subdoel** of that subthema: a
   `Subdoelvoorstel` in the existing subthema, carrying the activiteit it came from and the AI's motivation. It shows
   beside FB-057's proposals in that subthema and is decided the same way (`SubdoelplaatsingBeslissen`). No second one
   is made when that goal already waits in, or was rejected for, that subthema. An FB-057 run replaces only its own open
   proposals, never one that came from an activiteit, and does not place a goal that already waits there.
5. **"Linked" means decided.** Wherever a rule asks whether an activiteit carries a goal link (R25's delete by its maker,
   the move by a leerkracht of the leeftijd, the wizard's I27 and Q4 guards, the library count), only an `aanvaard` or
   `manueel` link counts. A proposal or a rejected goal does not, and goes with the activiteit when it is deleted.
6. **Linking by hand a goal that waits or was rejected** turns that link into a `manueel` one, without the AI motivation,
   instead of refusing it.
7. **The thema gets nothing of its own:** it shows an accepted goal through FB-009.

## Consequences

- A proposal on a shared activiteit shows in the dekkingsprognose as undecided, as an undecided subdoel does; it counts
  for the dekking only once accepted (Art. V.1).
- A subdoel proposed from an own activiteit reaches the hoofdleerkrachten, who decide whether the subthema takes it; the
  own activiteit still never counts through its subthema.
- The maximum is one value for the whole app. A school setting would need a screen and a column; not built.
