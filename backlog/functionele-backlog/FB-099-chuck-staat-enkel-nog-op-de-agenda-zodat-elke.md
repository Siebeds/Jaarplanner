---
id: FB-099
titel: Chuck staat enkel nog op de agenda, zodat elke pagina op dezelfde hoogte begint
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 23:52
opgepakt-door: claude-fb099
branch: ticket/FB-099-chuck-enkel-agenda
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Chuck ligt vandaag rechtsboven in de kop van bijna elk scherm (thema's, doelen, dekking, instellingen, ...). Zijn
mandje, en op sommige schermen ook zijn tekstballon, maakt de kop hoger en verschuift de titel en de knoppen. Daardoor
begint de inhoud van de pagina's niet op dezelfde hoogte: wie van Thema's naar Doelen of Agenda klikt, ziet de titel
telkens op een andere plaats staan.

## Gewenst gedrag

Chuck woont enkel nog op de agendapagina. Op alle andere schermen is hij weg, en staan de titel en de inhoud van elke
pagina op dezelfde hoogte, zodat wisselen tussen schermen rustig oogt.

## Acceptatiecriteria

- [ ] Gegeven een aangemelde gebruiker, wanneer ze de agenda opent, dan ligt Chuck daar rechtsboven zoals vandaag en opent hij bij een klik zijn venster.
- [ ] Gegeven een aangemelde gebruiker, wanneer ze Thema's, een thema, Doelen, Dekking, Inladen of een instellingenscherm opent, dan staat Chuck daar niet.
- [ ] Gegeven een breed scherm, wanneer ze wisselt tussen Thema's, Doelen en Dekking, dan staat de paginatitel telkens op dezelfde hoogte.
- [ ] Gegeven de themapagina, wanneer ze de kop bekijkt, dan staan "Bewerken" en het "..."-menu rechts in de kop, vrij klikbaar.
- [ ] Gegeven een telefoon (~390px), wanneer ze een scherm zonder Chuck opent, dan gebruikt de kop de volle breedte en blijft de titel leesbaar.

## Testscenario's

1. Meld aan als leerkracht en open de agenda. Verwacht: Chuck ligt rechtsboven; een klik opent zijn venster.
2. Open Thema's, Doelen en Dekking na elkaar op een breed scherm. Verwacht: geen Chuck, en de titel staat telkens op dezelfde hoogte.
3. Open een thema. Verwacht: geen Chuck; "Bewerken" en "..." staan rechts in de kop en werken.
4. Open een instellingenscherm (bv. Klassen). Verwacht: geen Chuck.
5. Verklein het venster tot ~390px en herhaal 2. Verwacht: geen Chuck, de titel is leesbaar.

## Buiten scope

Chuck zelf (tekening, houdingen, ballonnen, venster en chat) en wat hij op de agenda doet.

## Open vragen

Geen.

## Werklog

- 2026-09-23 23:51 · Siebeds · aangemaakt (status nieuw)
- 2026-09-23 23:52 · claude-fb099 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
