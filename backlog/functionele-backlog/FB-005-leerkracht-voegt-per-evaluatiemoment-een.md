---
id: FB-005
titel: Leerkracht voegt per evaluatiemoment een kindtekening toe aan het rapport
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-15 18:24
opgepakt-door: kindtekening
branch: ticket/FB-005-kindtekening
pr:
geblokkeerd:
fr: [FR-13.5]
---

## Aanleiding

De eigenaar wil in elk rapport een tekening van het kind, één per evaluatiemoment, als foto of scan (R10). Een foto die
met een telefoon genomen is, draagt vaak metagegevens mee, zoals de plaats waar ze genomen werd. Die mogen niet in de
tool terechtkomen (FR-13.5).

Dit is bouwticket 5 van ADR-0035 §6. **Bouwvolgorde:** na FB-003 (het rapport).

## Gewenst gedrag

- Per rapport (één kind, één moment) is er hoogstens één tekening: de leerkracht voegt ze toe als **JPEG of PNG**,
  vervangt ze of verwijdert ze.
- Het scherm vraagt om een foto van **alleen de tekening**: geen kind, geen andere kinderen en geen geschreven naam. De
  app kan dat niet controleren (ADR-0035 §3.1).
- De app weigert een bestand boven een **grens voor grootte** of voor **aantal pixels**, met een Nederlandse melding die
  de grens noemt. De bouw kiest de grenzen.
- **Geen metagegevens:** de app herwerkt elk beeld voor ze het bewaart, zodat er geen plaats, camera, datum of andere
  metagegevens overblijven.
- De tekening is alleen te zien voor wie het rapport mag lezen: nooit via een openbare of blijvende link.
- **Wie:** zoals bij FB-003. De leerkrachten van de klas voegen toe tijdens het schooljaar en zien de tekening daarna
  nog; de directie kan alles.

**Bindend:** Art. VI.7 en ADR-0035 §3.6, met D15 (de tekening staat in de databank, apart van het rapport, zonder
blijvende URL) en D16 (een bibliotheek die beelden leest of herwerkt, heeft een vrije licentie: MIT, Apache of BSD).
Geen beeld of bestandsnaam in een log.

## Acceptatiecriteria

- [ ] Gegeven een rapport, wanneer de leerkracht een JPEG- of PNG-foto van een tekening toevoegt, dan staat de tekening bij dat rapport en bij geen ander moment, en vervangt een tweede tekening de eerste.
- [ ] Gegeven een foto met een GPS-locatie en andere metagegevens, wanneer ze toegevoegd wordt en daarna vanuit de app bewaard wordt, dan bevat het bewaarde bestand geen van die metagegevens meer.
- [ ] Gegeven een bestand dat geen JPEG of PNG is, of dat boven de grens voor grootte of pixels gaat, wanneer de leerkracht het toevoegt, dan weigert de app met een Nederlandse melding die de grens noemt.
- [ ] Gegeven het adres van een tekening, wanneer iemand zonder recht op het rapport het opent (een leerkracht van een andere klas, of een venster waarin niemand aangemeld is), dan weigert de app.
- [ ] Gegeven een tekening, wanneer de leerkracht ze verwijdert, dan is ze weg uit het rapport; na het schooljaar ziet de leerkracht ze nog, maar kan die ze niet meer vervangen of verwijderen.

## Testscenario's

1. Neem een testfoto met een GPS-locatie in de metagegevens, van een tekening en niet van een kind. Controleer in
   Windows (Eigenschappen, Details) dat er een locatie in staat.
2. Open Rapport 1 van "Fien Proefmans". Het scherm vraagt om een foto van alleen de tekening. Voeg de foto toe: de
   tekening staat bij het rapport.
3. Bewaar de tekening vanuit de app op de pc en open Eigenschappen, Details: geen locatie, geen camera, geen
   opnamedatum.
4. Open Rapport 2: daar staat geen tekening.
5. Voeg een PDF toe, en een heel groot beeld: de app weigert beide met een melding die de grens noemt.
6. Kopieer het adres van de tekening en open het in een privévenster: de app weigert. Meld aan als leerkracht van een
   andere klas en open hetzelfde adres: de app weigert.
7. Vervang de tekening door een andere en verwijder ze daarna: beide lukken.
8. Kies een schooljaar dat voorbij is: de tekening is te zien, zonder knoppen om te vervangen of te verwijderen.

## Buiten scope

- Meer dan één tekening per moment (R10).
- Controleren of er een kind, een gezicht of een naam op de foto staat.
- De tekening bewaren in Azure Blob Storage (D15; een latere ADR kan dat verplaatsen).
- De tekening in het gedownloade rapport (FB-006).

## Open vragen

Geen.

## Werklog

- 2026-09-14 14:38 · rapport-tickets · aangemaakt (status nieuw)
- 2026-09-15 18:24 · eigenaar · nieuw → klaar-voor-bouw: eigenaar geeft de bouw vrij in de sessie
- 2026-09-15 18:24 · kindtekening · klaar-voor-bouw → in-uitvoering: opgepakt
