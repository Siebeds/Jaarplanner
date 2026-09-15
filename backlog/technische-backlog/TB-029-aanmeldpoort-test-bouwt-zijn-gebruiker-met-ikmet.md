---
id: TB-029
titel: Aanmeldpoort-test bouwt zijn gebruiker met ikMet, zodat de frontend-check weer slaagt
soort: technisch
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 20:27
opgepakt-door: kindtekening
branch: ticket/aanmeldpoort-leerlingzorg
pr:
geblokkeerd:
fr: []
---

## Aanleiding

TB-026 (tussenpagina) is gemerged na FB-008 (Leerlingzorg). De nieuwe test `Aanmeldpoort.test.tsx` van TB-026 bouwt
zijn aangemelde gebruiker als een volledig `Ik`-object met de hand, zonder het veld `heeftLeerlingzorg` dat FB-008
verplicht maakte. Daardoor faalt `tsc` in `pnpm lint`, en is de frontend-check rood op `main` en op elke nieuwe PR.

## Voorgestelde wijziging

- `frontend/src/app/Aanmeldpoort.test.tsx` bouwt zijn gebruiker met de gedeelde helper `ikMet` uit
  `frontend/src/test/rechten.ts`. Die geeft elk recht een standaardwaarde, zodat een volgend nieuw veld in `Ik` deze
  test niet opnieuw breekt.
- Geen wijziging aan de app zelf.

## Acceptatiecriteria

- [ ] Gegeven `main` met TB-026 en FB-008, wanneer `pnpm lint` draait, dan meldt `tsc` geen fout meer in
  `Aanmeldpoort.test.tsx`.
- [ ] Gegeven de frontend-tests, wanneer ze draaien, dan slagen de tests van `Aanmeldpoort` zoals voorheen.

## Buiten scope

- De backend-check op `main`: die herstelt TB-028.

## Open vragen

Geen.

## Werklog

- 2026-09-15 20:27 · kindtekening · aangemaakt (status in-uitvoering)
