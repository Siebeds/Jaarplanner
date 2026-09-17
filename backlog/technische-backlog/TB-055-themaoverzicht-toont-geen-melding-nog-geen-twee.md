---
id: TB-055
titel: Themaoverzicht toont geen melding 'Nog geen twee themadoelen' meer
soort: technisch
status: in-uitvoering
prioriteit: laag
aangemaakt: 2026-09-17
bijgewerkt: 2026-09-17 09:01
opgepakt-door: geen-twee-themadoelen
branch: ticket/geen-twee-themadoelen-weg
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Op het overzicht van alle thema's staat op elke kaart met minder dan twee minimumdoelen de melding "Nog geen twee
themadoelen", in de attentiekleur. De eigenaar wil die melding weg: twee themadoelen is maar een advies (Art. IX.2),
en de melding maakt het overzicht onrustig (eigenaar, 2026-09-17).

## Voorgestelde wijziging

- `frontend/src/features/themas/ThemasScherm.tsx`: de melding op de themakaart verdwijnt.
- `frontend/src/i18n/nl.json`: de sleutel `themas.teWeinigDoelen` verdwijnt.
- `heeftVoldoendeThemadoelen` blijft in de API; alleen het overzicht toont het niet meer.

## Acceptatiecriteria

- [ ] Gegeven een thema met nul of één minimumdoel, wanneer ik het overzicht van alle thema's open, dan staat er op
  zijn kaart geen melding "Nog geen twee themadoelen".
- [ ] Gegeven de wijziging, wanneer de frontendtests en `pnpm lint` draaien, dan slagen ze.

## Buiten scope

- Het veld `heeftVoldoendeThemadoelen` uit de API halen.
- De bevestiging bij het ontkoppelen van een minimumdoel (TB-051), die nog kan zeggen dat het thema minder dan twee
  themadoelen overhoudt.

## Open vragen

Geen.

## Werklog

- 2026-09-17 09:01 · geen-twee-themadoelen · aangemaakt (status in-uitvoering)
