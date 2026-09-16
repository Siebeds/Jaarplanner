---
id: FB-052
titel: Themabeheer importeert minimumdoelen als themadoel met het Excelbestand
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 15:31
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-1.1, FR-1.2, FR-1.3]
---

## Aanleiding

Sinds FB-043 is een themadoel een **minimumdoel**, zonder maximum (ADR-0046). Op de themapagina kan men geen
leerplandoel meer als themadoel koppelen. Het Excelbestand van de import (FR-1) draagt in de kolom *Themadoelen*
echter nog altijd leerplandoelcodes, en de import houdt er hoogstens drie over. Zo'n themadoel is op de themapagina
niet zichtbaar, maar telt wel mee voor de dekking.

De eigenaar besliste op 2026-09-16 dat de import ook minimumdoelen moet kunnen dragen, en dat dit in een eigen ticket
besproken en gebouwd wordt (FB-043, *Open vragen*).

## Gewenst gedrag

- Wie themabeheer heeft (of directie) kan in het Excelbestand **minimumdoelen** als themadoel opgeven, en na de import
  staan ze als themadoel op het thema, zoals op de themapagina.
- De voorbeeldweergave toont welke minimumdoelen per thema gekoppeld worden, en meldt per rij een minimumdoel dat niet
  bij de ingeladen Op.stap-doelen staat.
- Er is geen maximum aan themadoelen per thema, ook niet bij de import.
- Het downloadbare sjabloon toont een voorbeeld met minimumdoelen.

## Acceptatiecriteria

- [ ] Gegeven een Excelbestand met twee minimumdoelen als themadoel van een thema, wanneer het ingelezen wordt, dan staan
  beide minimumdoelen als themadoel op dat thema.
- [ ] Gegeven een onbekend minimumdoel in het bestand, wanneer de voorbeeldweergave opent, dan meldt ze die rij in gewone
  taal en koppelt de import dat minimumdoel niet.
- [ ] Gegeven een thema met meer dan drie minimumdoelen in het bestand, wanneer het ingelezen wordt, dan staan ze er
  allemaal.
- [ ] Gegeven een herimport van hetzelfde bestand, dan komt geen minimumdoel dubbel op het thema.
- [ ] Gegeven het sjabloon, wanneer men het downloadt, dan toont het een voorbeeld met minimumdoelen als themadoel.

## Testscenario's

1. Download het sjabloon bij *Importeren* en vul voor één thema twee minimumdoelen in als themadoel.
2. Laad het bestand op. De voorbeeldweergave toont het thema met die twee minimumdoelen.
3. Lees het in en open het thema. Beide minimumdoelen staan bij de themadoelen en klappen open per leeftijd.
4. Zet in het bestand een minimumdoel dat niet bestaat en laad het opnieuw op. De voorbeeldweergave meldt die rij.
5. Zet vijf minimumdoelen bij één thema en lees het in. Ze staan er alle vijf.
6. Lees hetzelfde bestand nog eens in. Er staat geen minimumdoel dubbel.

## Buiten scope

- Themadoelen op de themapagina: dat is FB-043.
- Het gegevensmodel van de themadoelen die een leerplandoel zijn opruimen: TB-034.

## Open vragen

- **Wat met een leerplandoelcode in de kolom Themadoelen?** Weigeren met een melding, omzetten naar het minimumdoel
  waarnaar het leerplandoel leidt, of blijven inlezen als leerplandoel-themadoel? Tot de eigenaar beslist, blijft de
  import leerplandoelen inlezen zoals vandaag.
- **Eén kolom of twee?** Minimumdoelen en leerplandoelen in dezelfde kolom *Themadoelen* (herkend aan hun code), of een
  nieuwe kolom *Minimumdoelen*?
- **Herimport:** verdwijnt een minimumdoel van het thema als het bestand het niet meer draagt, zoals nu bij de
  themadoelen (alleen met de optie van de directie om menselijke beslissingen te verwijderen)?

## Werklog

- 2026-09-16 15:31 · claude-fb043 · aangemaakt (status nieuw)
