---
id: TB-014
titel: Tijdraster licht het kwartier onder de muis op en plant een activiteit door te slepen
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 16:26
opgepakt-door: agenda-sleep
branch: ticket/agenda-sleep-om-te-plannen
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vroeg op 2026-09-14 om twee wijzigingen aan de dag- en weekweergave van de agenda (het tijdraster, ADR-0028):

1. Wie over een lege plek in het raster beweegt, ziet vandaag niet welk uur een klik zou kiezen. De eigenaar wil dat het kwartier onder de muis even oplicht, zodat de leerkracht ziet welk uur ze gaat aanduiden.
2. Een klik op een lege plek plant vandaag een activiteit op dat uur met de standaardlengte van de activiteit. De eigenaar wil ook kunnen klikken en slepen: hoe ver je sleept, dat urenbereik wordt het bereik van de activiteit.

## Voorgestelde wijziging

- `frontend/src/features/plan/Tijdraster.tsx`, in de dagkolom:
  - Met een muis of pen licht het kwartier onder de aanwijzer op, met het beginuur erin geschreven (dus nooit alleen kleur, Art. XII). In inkt, niet in het accent: het accent is op vijf toepassingen gerantsoeneerd (ADR-0024).
  - Een klik kiest het kwartier dat oplicht (afgerond naar beneden), niet meer het dichtstbijzijnde kwartier: anders zou een klik in de onderste helft van een oplichtend kwartier een ander uur kiezen dan het raster toonde.
  - Indrukken en slepen tekent het bereik dat ontstaat, met de uren erin, in dezelfde vorm als het voorbeeld dat een verplaatste activiteit al toont. Loslaten opent de kiezer voor dat bereik. Escape breekt het slepen af. Een sleep die in zijn eigen kwartier blijft, is een gewone klik.
- `frontend/src/features/plan/Agendascherm.tsx`: de kiezer en het blad voor een nieuwe activiteit krijgen een optioneel einde. Is er een bereik gesleept, dan wordt de activiteit op dat bereik gepland in plaats van op haar standaardlengte.
- `Activiteitkiezer.tsx` en `Nieuweactiviteitblad.tsx`: de titel en de zin onder het formulier noemen het bereik ("van 9:00 tot 10:30") in plaats van enkel het beginuur. Twee nieuwe sleutels in `nl.json` onder `tijdraster`.

## Acceptatiecriteria

- [x] Gegeven de week- of dagweergave op een lesdag, wanneer de leerkracht met de muis over een lege plek beweegt, dan licht het kwartier onder de muis op met zijn beginuur erin, en het verdwijnt boven een blok en buiten het raster.
- [x] Gegeven een oplichtend kwartier, wanneer de leerkracht klikt, dan opent de kiezer op precies dat beginuur en krijgt de gekozen activiteit haar standaardlengte, zoals vandaag.
- [x] Gegeven een lesdag, wanneer de leerkracht indrukt op 9:00 en sleept tot in het kwartier van 10:15, dan toont het raster tijdens het slepen het bereik 9:00 - 10:30, opent de kiezer bij het loslaten met "van 9:00 tot 10:30" in de titel, en wordt de gekozen activiteit van 9:00 tot 10:30 gepland. Omhoog slepen geeft hetzelfde bereik in omgekeerde richting.
- [x] Gegeven een gesleept bereik, wanneer de leerkracht in de kiezer een nieuwe activiteit maakt, dan noemt het blad hetzelfde bereik en wordt de nieuwe activiteit op dat bereik gepland.
- [x] Gegeven een lopende sleep, wanneer de leerkracht Escape drukt, dan verdwijnt het bereik en opent er niets.
- [x] De frontend-tests en `pnpm lint` zijn groen, en het raster is in een echte browser bekeken op desktop en op ~390px.

## Buiten scope

- Slepen om te plannen op een aanraakscherm: daar scrolt een veeg door de uren, en een tik blijft een kwartier kiezen zoals vandaag. Oplichten bij hoveren bestaat op een aanraakscherm niet.
- De maandweergave: die heeft geen uren.
- Een hoek of een algemene fiche plannen door te slepen in het raster: die komen uit het paneel naast de agenda, zoals vandaag.
- De toetsenbordroute verandert niet: Enter op een lege dag kiest nog altijd 8:30, en de uren van een geplande activiteit blijven in haar blad aanpasbaar (WCAG 2.2 SC 2.5.7).

## Open vragen

Geen.

## Werklog

- 2026-09-14 16:03 · agenda-sleep · aangemaakt (status in-uitvoering)
- 2026-09-14 16:16 · agenda-sleep · gebouwd (73d944a): kwartier licht op onder muis/pen, klik kiest dat kwartier, slepen tekent en plant het bereik, Escape laat los; kiezer en nieuw-blad noemen het bereik; nl.json: twee sleutels toegevoegd op uitdrukkelijke toestemming van de eigenaar terwijl E6-02 de claim hield; pnpm lint schoon, vitest 40 bestanden/277 tests groen (6 nieuw)
- 2026-09-14 16:26 · agenda-sleep · browsercontrole headless Chrome (playwright-core) op wegwerpdatabase jaarplanner_tb014, API 5189/Vite 5181: kwartier licht op met beginuur (12:15 op de juiste hoogte, tekst 5,51:1 licht en 8,97:1 donker), niet boven een blok of in de urenkolom; slepen 9:00-10:20 toont en plant 9:00 - 10:30 (blok in het raster), omhoog 14:20-13:05 geeft 13:00-14:30, klik op 11:12 kiest 11:00, Enter kiest 8:30, Escape laat los zonder blad, nieuw-blad noemt het bereik; 390px zonder overloop, tik kiest zijn kwartier; geen consolefouten; alle zes criteria afgevinkt
