# ADR-0068 — Chuck lies on the agenda only

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Project owner (FB-099).
- **Relates to:** [ADR-0059](0059-de-kat-proactieve-agent.md) K4 (the cat sleeps top right in a basket),
  [ADR-0065](0065-chuck-de-kat-in-de-app.md) §4 and §8.
- **Supersedes:** ADR-0065 §8 in its mechanism only: the rapport's screens no longer pass `zonderKat`, because no screen
  but the agenda draws him.
- **Constitution:** unchanged (Art. IV.8, VI.7).

## Context

Chuck lay in the header of every screen that drew a `Schermkop`. His basket, and on some screens his balloon, made that
header taller than the others, so the title and the content started at a different height from screen to screen. The
owner: *"het stoort mij dat de content van alle pagina niet op dezelfde hoogte staan ... ik denk dat ik chuck enkel wil
op de agenda pagina."*

## Decision

1. **Chuck is drawn on the agenda only**, in its header, including its state without a klas. A header draws him only
   when the screen asks for him (`metKat`); by default it does not. K4 still holds: on the agenda he sleeps top right.
2. **The ontwikkelingsrapport and the export carry no cat** (ADR-0065 §8), now by that default rather than an opt-out.
3. **Every title stands at the same height:** the title row is at least a button tall and sits at the top of its row,
   whether or not a control or Chuck is beside it.

## Consequences

**Positive:** screens line up; the narrow screens lose the offset that kept Chuck's corner (FB-095).
**Negative:** what Chuck brought is seen only by someone who opens the agenda. The agenda is the screen every teacher
starts on, and its route is open to everyone, so nothing he prepares becomes unreachable.
