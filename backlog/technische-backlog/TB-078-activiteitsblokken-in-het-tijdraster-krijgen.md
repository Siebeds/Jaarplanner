---
id: TB-078
titel: Activiteitsblokken in het tijdraster krijgen minder afgeronde hoeken
soort: technisch
status: klaar
prioriteit: laag
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 11:25
opgepakt-door: claude-tb-hoeken
branch: ticket/TB-activiteit-hoeken
pr: 184
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vindt de blokken in het tijdraster van de agenda te rond: met `rounded-veld` (12 px) lezen ze als losse kaartjes in plaats van als tijdvakken in een rooster.

## Voorgestelde wijziging

In `frontend/src/features/plan/Tijdraster.tsx` krijgen het blok zelf en het landingsvak (waar een blok terechtkomt tijdens slepen) `rounded-md` (6 px) in plaats van `rounded-veld`. Het token `--radius-veld` blijft ongewijzigd, want velden en knoppen elders gebruiken het.

## Acceptatiecriteria

- [x] Gegeven de agenda van een klas, wanneer de leerkracht naar het tijdraster kijkt, dan hebben de blokken (activiteiten en fiches) duidelijk minder afgeronde hoeken dan voorheen.
- [ ] Gegeven een blok dat gesleept wordt, wanneer het landingsvak verschijnt, dan heeft dat dezelfde hoekafronding als het blok.
- [x] Gegeven andere velden en kaarten in de app, dan is hun afronding ongewijzigd.

## Buiten scope

De afronding van velden, knoppen en kaarten elders in de app.

## Open vragen

Geen.

## Werklog

- 2026-09-24 11:21 · claude-tb-hoeken · aangemaakt (status in-uitvoering)
- 2026-09-24 11:25 · claude-tb-hoeken · blok en landingsvak rounded-md; criteria 1 en 3 afgevinkt na screenshot van de mockagenda op 1440 en 390 px, het landingsvak alleen in de code nagekeken
- 2026-09-24 11:25 · claude-tb-hoeken · in-uitvoering → klaar: gebouwd; plan-tests (291) en pnpm lint groen
- 2026-09-24 11:25 · claude-tb-hoeken · PR #184
