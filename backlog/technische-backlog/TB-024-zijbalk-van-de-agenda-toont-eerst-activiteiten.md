---
id: TB-024
titel: Zijbalk van de agenda toont eerst Activiteiten, dan Algemene fiches, dan Hoekenfiches
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 17:11
opgepakt-door: zijbalk-volgorde
branch: ticket/zijbalk-volgorde
pr: 87
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"kan je in de linker side pane de volgorde veranderen van de fiches? ik wil eerst
activiteiten zien, dan algemene fiches en dan hoekenfiches"*.

Vandaag staan de schakelaars van de agenda in de volgorde Hoekenfiches, Algemene fiches, Activiteiten (FB-017 voegde
Activiteiten achteraan toe).

## Voorgestelde wijziging

De volgorde wordt Activiteiten, Algemene fiches, Hoekenfiches, op beide plaatsen waar de schakelaars staan:

- de zijbalk vanaf `lg` (`frontend/src/app/Navigatie.tsx`);
- de chips in de werkbalk van de agenda op gsm (`frontend/src/features/plan/Agendascherm.tsx`).

Een test in `Navigatie.test.tsx` legt de volgorde vast.

## Acceptatiecriteria

- [x] Gegeven de agenda op desktop voor wie de klas mag plannen, dan staan de schakelaars in de zijbalk in de volgorde
  Activiteiten, Algemene fiches, Hoekenfiches.
- [x] Gegeven de agenda op ~390px, dan staan de chips in de werkbalk in dezelfde volgorde.
- [x] Gegeven wie de klas alleen mag inkijken, dan staat alleen Activiteiten er, zoals voordien.

## Buiten scope

- Welke lijst het paneel toont bij het openen: elke schakelaar opent zijn eigen lijst, zoals voordien.

## Open vragen

Geen.

## Werklog

- 2026-09-15 17:01 · zijbalk-volgorde · aangemaakt (status in-uitvoering)
- 2026-09-15 17:05 · zijbalk-volgorde · Volgorde omgedraaid in de zijbalk (Navigatie) en de gsm-chips (Agendascherm), met een test op de volgorde voor elk. Vitest 775/775, lint groen.
- 2026-09-15 17:11 · zijbalk-volgorde · PR #87
