---
id: FB-041
titel: Doelenregister opent zonder een uitgeklapt leergebied of discipline
soort: functioneel
status: klaar-voor-bouw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 14:27
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
- Ook een zoekterm of een andere filter klapt niets vanzelf open: de groepen met resultaten blijven dicht tot de
  leerkracht er zelf een openklapt.

## Acceptatiecriteria

- [ ] Gegeven een leerkracht met een klas, wanneer ze naar Doelen gaat, dan is in het register van de leerplandoelen
  geen enkele discipline uitgeklapt.
- [ ] Gegeven dezelfde leerkracht, wanneer ze naar de minimumdoelen gaat, dan is geen enkel leergebied uitgeklapt.
- [ ] Gegeven het register, wanneer de leerkracht een zoekterm intikt, dan blijven alle groepen ingeklapt.
- [ ] Gegeven een groep die de leerkracht openklapte, dan blijft die open tot zij ze sluit of een filter wijzigt.

## Testscenario's

1. Meld aan als leerkracht van een K3-klas en kies Doelen. Alle disciplines staan ingeklapt; Nederlands ook.
2. Schakel naar de minimumdoelen. Alle leergebieden staan ingeklapt.
3. Tik een zoekterm in, bv. "tellen". Alle groepen blijven dicht.
4. Wis de zoekterm en klap Wiskunde open. Wiskunde staat open, de rest blijft dicht.

## Buiten scope

Welke filter standaard actief is bij het binnenkomen: dat blijft zoals nu.

## Open vragen

- ~~Moet een zoekterm de eerste groep nog openen, of wil je ook dan alles dicht?~~ **Beantwoord door de eigenaar,
  2026-09-16:** altijd alles dicht, ook na een zoekterm.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-16 14:27 · eigenaar · nieuw → klaar-voor-bouw: open vragen beantwoord door de eigenaar; klaar voor bouw
