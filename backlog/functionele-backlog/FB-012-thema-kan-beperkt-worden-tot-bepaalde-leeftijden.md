---
id: FB-012
titel: Thema kan beperkt worden tot bepaalde leeftijden
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-24 17:51
opgepakt-door: thema-leeftijden
branch: ticket/FB-012-thema-leeftijden
pr:
geblokkeerd:
fr: [FR-3.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"thema niet per se schoolbreed maken"*.

Vandaag is elk thema schoolbreed: elke klas ziet het in haar keuzes, ook een thema dat de school alleen in de derde
kleuter geeft. Dat maakt de lijsten lang en laat een klas een thema kiezen dat niet voor haar leeftijd bedoeld is.

**Beslissing van de eigenaar, 2026-09-15:** een thema blijft gedeeld, maar kan **beperkt worden tot bepaalde
leeftijden**. Een thema per klas of een persoonlijk thema is niet gevraagd.

## Gewenst gedrag

- Wie thema's mag bewerken (directie en themabeheer), duidt bij een thema aan voor welke leeftijden (jaarfasen) het
  geldt. Standaard, en voor elk bestaand thema, zijn dat alle leeftijden.
- Een klas van een leeftijd waarvoor het thema niet geldt, ziet het thema niet meer in haar keuzes: een thema in het
  jaarplan zetten, de jaarplangeneratie, de keuze van een subthema of activiteit in de agenda.
- Een subthema kan alleen gemaakt worden voor een leeftijd waarvoor het thema geldt.
- De themalijst toont bij elk thema voor welke leeftijden het geldt.

## Acceptatiecriteria

- [x] Gegeven een thema beperkt tot K2 en K3, wanneer een JK-klas een thema in haar jaarplan wil zetten, dan staat dit
  thema niet in de keuze, en een K3-klas ziet het wel.
- [x] Gegeven dat thema, wanneer het jaarplan van een JK-klas gegenereerd wordt, dan plaatst de generatie het niet.
- [x] Gegeven dat thema, wanneer een hoofdleerkracht een subthema wil maken, dan kan ze alleen K2 of K3 kiezen.
- [x] Gegeven een bestaand thema, dan geldt het na deze wijziging voor alle leeftijden, zodat niets verdwijnt.
- [x] Gegeven een thema dat al in het jaarplan van een JK-klas staat of een JK-subthema heeft, wanneer iemand JK uit
  zijn leeftijden haalt, dan weigert de tool met een Nederlandse melding die zegt welke klassen en subthema's in de weg
  staan.

## Testscenario's

1. Meld aan als themabeheer. Open een thema en beperk het tot K2 en K3. De themalijst toont "K2, K3" bij het thema.
2. Meld aan als leerkracht van een JK-klas en open het jaarplan. Het thema staat niet in de keuze om een thema te plaatsen.
3. Meld aan als leerkracht van een K3-klas. Het thema staat er wel.
4. Probeer als themabeheer K3 weg te halen bij een thema dat in het jaarplan van een K3-klas staat. De tool weigert en
   noemt de klas.
5. Maak als hoofdleerkracht een subthema bij het beperkte thema. Alleen K2 en K3 zijn te kiezen.

## Buiten scope

- Een thema per klas of een persoonlijk thema: niet gevraagd (beslissing 2026-09-15).
- Wie een thema mag zien of bewerken, los van de leeftijd: dat blijft Art. VI.1.

## Open vragen

- **Grondwet:** Art. IX.2 noemt een thema *"school-scoped, shared school-wide"*, en Art. XIV legt die schaal vast als
  beslist. De eigenaar besliste op 2026-09-15 dat een thema beperkt kan worden tot leeftijden. Die wijziging van Art. IX.2
  (Art. XI) hoort bij de bouw van dit ticket, vóór de code.
- Wat met een thema dat al gebruikt wordt door een leeftijd die men wil weghalen? **Standaard** weigert de tool
  (criterium 5). Moet ze in plaats daarvan iets opruimen?

## Werklog

- 2026-09-15 14:09 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-24 16:48 · thema-leeftijden · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-24 16:58 · thema-leeftijden · Grondwet Art. IX.2 gewijzigd en ADR-0069 vastgelegd; een gebruikte leeftijd weghalen wordt geweigerd (standaard uit het ticket).
- 2026-09-24 17:50 · thema-leeftijden · Antagonist: COMPLIANT, geen CRITICAL of MAJOR; de MINOR over het formulier zonder geladen jaarfasen is opgelost, de rest staat in backlog/worklogs/FB-012/antagonist.md.
- 2026-09-24 17:51 · thema-leeftijden · Browserpas op een wegwerpkopie, desktop en 390px: alle vijf criteria gezien; de weigering raadt nu alleen aan wat echt in de weg staat.
