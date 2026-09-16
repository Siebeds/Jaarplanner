---
id: FB-056
titel: Directie vraagt extra AI-tokens aan voor de lopende maand
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 22:23
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-12]
---

## Aanleiding

Met het maandbudget van FB-055 kan een school midden in de maand zonder AI vallen, bijvoorbeeld in de drukke weken
waarin de thema's opgebouwd worden. De directie moet dan extra tokens kunnen krijgen. Die extra tokens worden
betaald; de betaling loopt buiten de app, via een factuur.

## Gewenst gedrag

- In Instellingen, AI-verbruik, kan de directie **extra tokens aanvragen** voor de lopende maand. Ze kiest een
  hoeveelheid en ziet dat de uitbreiding gefactureerd wordt.
- De aanvraag wordt bewaard (wie, wanneer, hoeveel) en staat als **aangevraagd** in het onderdeel, tot ze toegekend is.
  Wie de app technisch beheert, krijgt een melding van de aanvraag.
- Wie de app technisch beheert, **kent de extra tokens toe**. Vanaf dan is het budget van de lopende maand het
  basisbudget plus de extra tokens; de voortgangsbalk rekent met dat totaal en toont de extra tokens apart.
- Extra tokens gelden **alleen voor de lopende maand**. Op de eerste van de volgende maand valt de school terug op het
  basisbudget.
- Een lijst in het onderdeel toont de aanvragen van dit schooljaar met hun status, zodat directie en facturatie
  dezelfde cijfers zien.

## Acceptatiecriteria

- [ ] Gegeven de directie in Instellingen, AI-verbruik, wanneer ze 1.000.000 extra tokens aanvraagt, dan staat de
  aanvraag als aangevraagd in de lijst en is het budget nog niet veranderd.
- [ ] Gegeven een aangevraagde uitbreiding, wanneer die toegekend wordt, dan is het budget van de lopende maand het
  basisbudget plus 1.000.000, en toont de balk de extra tokens apart.
- [ ] Gegeven een budget dat op was, wanneer de uitbreiding toegekend is, dan werken de AI-knoppen weer.
- [ ] Gegeven een uitbreiding in september, wanneer 1 oktober begint, dan is het budget weer het basisbudget.
- [ ] Gegeven een gebruiker zonder directierecht, dan kan die geen extra tokens aanvragen; de server weigert het ook.

## Testscenario's

1. Meld aan als directie en open Instellingen, AI-verbruik.
2. Vraag 1.000.000 extra tokens aan. De aanvraag staat in de lijst als aangevraagd, met je naam en de datum, en er staat
   dat de uitbreiding gefactureerd wordt. De balk is niet veranderd.
3. Ken de uitbreiding toe op de manier die voor de technische beheerder gebouwd is. Herlaad het onderdeel: de balk
   rekent met het hogere budget en toont de extra tokens apart.
4. Is het budget op (zie FB-055), vraag dan na het toekennen opnieuw doelsuggesties. Dat lukt weer.

## Buiten scope

- Online betalen in de app, en de factuur zelf.
- Het basisbudget blijvend verhogen.

## Open vragen

- **Hoe kent de technische beheerder de tokens toe?** De app heeft vandaag geen rol boven de directie. Mogelijkheden:
  een instelling of script per omgeving, of een eigen beheerrol in de app.
- **Hoe krijgt de technische beheerder de melding** van een aanvraag: een e-mail, of alleen via een lijst?
- **Welke hoeveelheden** kan de directie kiezen: een vrij getal, of vaste pakketten (bijvoorbeeld 1 of 3 miljoen)?

## Werklog

- 2026-09-16 22:23 · eigenaar · aangemaakt (status nieuw)
