---
id: FB-041
titel: Doelenregister opent zonder een uitgeklapt leergebied of discipline
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 15:07
opgepakt-door: claude-fb-041
branch: ticket/FB-041-register-ingeklapt
pr: 109
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

- [x] Gegeven een leerkracht met een klas, wanneer ze naar Doelen gaat, dan is in het register van de leerplandoelen
  geen enkele discipline uitgeklapt.
- [x] Gegeven dezelfde leerkracht, wanneer ze naar de minimumdoelen gaat, dan is geen enkel leergebied uitgeklapt.
- [x] Gegeven het register, wanneer de leerkracht een zoekterm intikt, dan blijven alle groepen ingeklapt.
- [x] Gegeven een groep die de leerkracht openklapte, dan blijft die open tot zij ze sluit of een filter wijzigt.

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
- 2026-09-16 14:28 · claude-fb-041 · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-16 14:32 · claude-fb-041 · registers openen volledig ingeklapt, ook na een filter of zoekterm; Vitest (968) en lint groen
- 2026-09-16 14:33 · claude-fb-041 · antagonist: COMPLIANT, geen blokkerende bevindingen; één MINOR (test op textContent)
- 2026-09-16 14:40 · claude-fb-041 · in-uitvoering → te-testen: gebouwd: registers openen altijd ingeklapt, ook na zoeken of filteren; browsercheck PASS op desktop en 390px (backlog/worklogs/FB-041), Vitest 968 en lint groen, antagonist COMPLIANT
- 2026-09-16 15:07 · claude-fb-041 · PR #109
