---
id: TB-080
titel: Bekijken bij een activiteitvoorstel in Chucks venster opent het subthema
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 11:50
opgepakt-door: claude-tb-katbekijken
branch: ticket/TB-kat-bekijken-activiteitvoorstel
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Een leerkracht klikt in Chucks venster op "Bekijken" bij een activiteitvoorstel en er lijkt niets te gebeuren. De
backend geeft als link `/subthemas/{id}/activiteitvoorstellen` mee, maar die route bestaat niet in de frontend: de
vangroute stuurt door naar `/agenda` en het venster sluit.

## Voorgestelde wijziging

In `DeurmatService` (Infrastructure/Kat) wijst de link van een activiteitvoorstel zonder klas naar het subthema op
zijn themapagina, `/themas/{themaId}?subthema={subthemaId}`, de vorm die de themapagina al leest om een subthema open
te klappen en die Chucks chat al gebruikt. De query haalt daarvoor de `ThemaId` van het al gekoppelde subthema op.
Een test legt de link vast.

## Acceptatiecriteria

- [ ] Gegeven een activiteitvoorstel zonder klas in Chucks venster, wanneer de deurmat wordt opgehaald, dan is de
      verwijzing `/themas/{themaId}?subthema={subthemaId}`.
- [ ] Gegeven dat voorstel, wanneer de leerkracht op "Bekijken" klikt, dan opent de themapagina met dat subthema
      opengeklapt en de voorgestelde activiteiten zichtbaar.
- [ ] Een activiteitvoorstel dat Chuck bij een klas bracht, blijft in het venster zelf beslist (geen verwijzing).

## Buiten scope

De andere voorstelsoorten in het venster; hun link werkt al.

## Open vragen

Geen.

## Werklog

- 2026-09-24 11:50 · claude-tb-katbekijken · aangemaakt (status in-uitvoering)
