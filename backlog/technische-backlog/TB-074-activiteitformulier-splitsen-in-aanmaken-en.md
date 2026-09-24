---
id: TB-074
titel: Activiteitformulier splitsen in aanmaken en bewerken
soort: technisch
status: klaar
prioriteit: laag
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-24 13:38
opgepakt-door: claude-tb074
branch: ticket/TB-074-activiteitformulier-splitsen
pr: 192
geblokkeerd:
fr: []
---

## Aanleiding

`features/activiteiten/Activiteitformulier.tsx` maakt zowel een nieuwe activiteit aan als dat het een bestaande
bewerkt, met 18 props. Een deel geldt alleen bij bewerken (`onKoppel`, `onOntkoppel`, `alleenLezen`, `themaId`,
`onGebruik`, `gebruikBezig`), een deel alleen bij aanmaken (`leeftijd`, `subdoelen`), en het component leidt zijn
modus af uit welke props er zijn (`leeftijd === undefined ? …`). Niets houdt een aanroeper tegen die een onmogelijke
combinatie meegeeft, en `features/themas/ThemadetailScherm.tsx` herhaalt voor elke prop
`bladActiviteit ? … : undefined`. De Vercel-regels `patterns-explicit-variants` en
`architecture-avoid-boolean-props` raden twee expliciete varianten aan.

## Voorgestelde wijziging

- Twee componenten, bijvoorbeeld `NieuweActiviteit` en `BestaandeActiviteit`, elk met alleen de props van hun modus.
- De gedeelde velden en de doelensectie worden gedeelde onderdelen die beide gebruiken.
- De aanroepers kiezen expliciet: `plan/Nieuweactiviteitblad.tsx` en `plan/Activiteitensectie.tsx` maken aan,
  `plan/Activiteitblad.tsx` bewerkt, en `themas/ThemadetailScherm.tsx` kiest per geval.

## Acceptatiecriteria

- [x] Gegeven de code, wanneer je de twee componenten bekijkt, dan heeft geen van beide een prop die alleen in de
      andere modus betekenis heeft, en leidt geen van beide zijn modus af uit ontbrekende props.
- [x] Gegeven de vier plekken waar een activiteit aangemaakt of bewerkt wordt, wanneer een leerkracht dat doet, dan
      werkt het zoals voordien, ook alleen-lezend voor wie de activiteit niet mag bewerken.
- [x] Gegeven de bestaande tests van het formulier en de bladen, aangepast aan de nieuwe namen, wanneer ze draaien,
      dan slagen ze.

## Buiten scope

Het uitzicht of het gedrag van het formulier veranderen.

## Open vragen

Geen.

## Werklog

- 2026-09-23 09:49 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-24 13:16 · claude-tb074 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten (opdracht via orchestrerende sessie)
- 2026-09-24 13:24 · claude-tb074 · Formulier gesplitst in NieuweActiviteit en BestaandeActiviteit met gedeelde onderdelen; pnpm test (1394) en pnpm lint groen.
- 2026-09-24 13:37 · claude-tb074 · Browsercheck op wegwerpkopie (desktop en 390px): aanmaken en bewerken op de themapagina, nieuw en bestaand in de agenda, nieuw vanuit het activiteitenpaneel, en alleen-lezend met Gebruiken voor een leerkracht; alles zoals voordien. Criteria afgevinkt op basis daarvan en van de tests.
- 2026-09-24 13:37 · claude-tb074 · Antagonist: COMPLIANT, geen blokkerende bevindingen; twee MINOR (verouderd commentaar, testnotitie) opgelost, twee MINOR bewust gelaten (overlappende test, bestandsnaam Activiteitformulier.tsx voor de gedeelde onderdelen).
- 2026-09-24 13:37 · claude-tb074 · in-uitvoering → klaar: Gesplitst in NieuweActiviteit en BestaandeActiviteit met gedeelde onderdelen, gedrag ongewijzigd; pnpm test (1394) en pnpm lint groen, browsercheck en antagonist in orde.
- 2026-09-24 13:38 · claude-tb074 · PR #192
