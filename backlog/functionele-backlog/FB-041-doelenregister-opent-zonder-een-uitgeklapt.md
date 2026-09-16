---
id: FB-041
titel: Doelenregister opent zonder een uitgeklapt leergebied of discipline
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 13:46
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-2.2]
---

## Aanleiding

De eigenaar merkte op 2026-09-16 in de demo-omgeving: *"bij het navigeren naar de doelen (minimumdoelen en
leerplandoelen), wordt standaard Nederlands uitgeklapt, doe dit niet"*.

Vandaag opent het doelenregister gefilterd op de klas die open staat, en een actieve filter klapt de eerste groep met
resultaten vanzelf open. Daardoor staat Nederlands altijd open bij het binnenkomen, ook als de leerkracht iets anders
zoekt, en is het overzicht van alle groepen weg.

## Gewenst gedrag

- Wie naar Doelen gaat, ziet in het register van de leerplandoelen en in dat van de minimumdoelen alle groepen
  ingeklapt: disciplines, leergebieden en wat eronder hangt.
- De leerkracht klapt zelf open wat ze wil zien.
- Een zoekopdracht die de leerkracht zelf intikt, mag de eerste groep met resultaten wel openen, zodat een zoekactie
  meteen op de resultaten landt.

## Acceptatiecriteria

- [ ] Gegeven een leerkracht met een klas, wanneer ze naar Doelen gaat, dan is in het register van de leerplandoelen
  geen enkele discipline uitgeklapt.
- [ ] Gegeven dezelfde leerkracht, wanneer ze naar de minimumdoelen gaat, dan is geen enkel leergebied uitgeklapt.
- [ ] Gegeven het register, wanneer de leerkracht een zoekterm intikt, dan opent de eerste groep met resultaten.
- [ ] Gegeven een groep die de leerkracht openklapte, dan blijft die open tot zij ze sluit of een filter wijzigt.

## Testscenario's

1. Meld aan als leerkracht van een K3-klas en kies Doelen. Alle disciplines staan ingeklapt; Nederlands ook.
2. Schakel naar de minimumdoelen. Alle leergebieden staan ingeklapt.
3. Tik een zoekterm in, bv. "tellen". De eerste groep met resultaten klapt open.
4. Wis de zoekterm en klap Wiskunde open. Wiskunde staat open, de rest blijft dicht.

## Buiten scope

Welke filter standaard actief is bij het binnenkomen: dat blijft zoals nu.

## Open vragen

- Moet een zoekterm de eerste groep nog openen, of wil je ook dan alles dicht? **Standaard** opent een zoekterm de
  eerste groep; alleen het binnenkomen met de klasfilter opent niets.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
