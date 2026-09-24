---
id: TB-077
titel: AI-knop toont tijdens een run geen dubbele puntjes meer
soort: technisch
status: in-uitvoering
prioriteit: laag
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 10:48
opgepakt-door: tb-bezig-puntjes
branch: ticket/TB-ai-bezig-puntjes
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Tijdens een AI-run toont een AI-knop twee keer puntjes: het label eindigt op "…" (bv. "Plaatsen zoeken…") en
`AiKnop` zet er zelf nog drie huppelende puntjes achter (TB-044).

## Voorgestelde wijziging

Het beletselteken weghalen uit de zeven bezig-labels die een `AiKnop` toont (`nl.json`: `thema.suggestiesBezig`,
`plan.genereerBezig`, `woordweb.voorstellenBezig`, `plaatsing.vraagBezig`, `doelvoorstel.vraagBezig`,
`activiteitvoorstel.vraagBezig`, `weekvoorstel.vraagBezig`), en in `frontend/src/i18n/catalogus.test.ts` een
bewaking die elke catalogussleutel binnen een `<AiKnop>` controleert.

## Acceptatiecriteria

- [ ] Gegeven een AI-knop, wanneer de AI bezig is, dan staan achter het label alleen de drie huppelende puntjes, geen "…".
- [ ] Gegeven een label dat op "…" eindigt in een `AiKnop`, wanneer de frontendtests lopen, dan faalt `catalogus.test.ts` met het bestand en de sleutel.

## Buiten scope

Bezig-labels op gewone knoppen (zonder huppelende puntjes) houden hun "…".

## Open vragen

Geen.

## Werklog

- 2026-09-24 10:48 · tb-bezig-puntjes · aangemaakt (status in-uitvoering)
