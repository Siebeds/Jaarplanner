---
id: TB-049
titel: Themalijst in de mockmodus toont het aantal subthema's, activiteiten en doelen
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-17
bijgewerkt: 2026-09-17 00:25
opgepakt-door: mock-thematellers
branch: ticket/mock-thematellers
pr: 131
geblokkeerd:
fr: []
---

## Aanleiding

In de mockmodus (TB-046, TB-047) toont de themalijst bij elk thema "0 subthema's, 0 activiteiten, 0 doelen", terwijl
de thema's er wel hebben. De bibliotheek op `main` stuurt drie tellers mee (`aantalSubthemas`, `aantalActiviteiten`,
`aantalDoelkoppelingen`) die de mock niet vult. De eigenaar zag het op 2026-09-17.

## Voorgestelde wijziging

`frontend/src/mocks/toestand.ts`: de bibliotheek van de mock telt per thema zijn subthema's, zijn activiteiten en zijn
doelkoppelingen, en stuurt ze mee. Een test in `frontend/src/mocks/routes.test.ts`.

## Acceptatiecriteria

- [x] Gegeven de mockmodus, wanneer je Thema's opent, dan toont elk thema zijn werkelijke aantal subthema's, activiteiten en doelen, niet nul.
- [x] `pnpm lint` en `pnpm test` zijn groen.

## Buiten scope

De tellers opnemen in `ThemaBibliotheekItem` in `lib/types.ts`: dat hoort bij wie dat bestand bijwerkt.

## Open vragen

Geen.

## Werklog

- 2026-09-17 00:21 · mock-thematellers · aangemaakt (status in-uitvoering)
- 2026-09-17 00:24 · mock-thematellers · mockbibliotheek stuurt de drie tellers zoals de server ze telt; test in routes.test.ts, browser toont 3/31/64 en 3/18/37; lint en 1018 tests groen; antagonist COMPLIANT, MINOR open: inline type weg zodra de tellers in ThemaBibliotheekItem staan
- 2026-09-17 00:24 · mock-thematellers · in-uitvoering → klaar: themalijst in de mockmodus toont de echte tellers; gates groen, antagonist COMPLIANT
- 2026-09-17 00:25 · mock-thematellers · PR #131
