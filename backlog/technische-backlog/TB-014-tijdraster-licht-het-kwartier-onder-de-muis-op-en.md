---
id: TB-014
titel: Tijdraster licht het kwartier onder de muis op en plant een activiteit door te slepen
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 16:03
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

- [ ] Gegeven de week- of dagweergave op een lesdag, wanneer de leerkracht met de muis over een lege plek beweegt, dan licht het kwartier onder de muis op met zijn beginuur erin, en het verdwijnt boven een blok en buiten het raster.
- [ ] Gegeven een oplichtend kwartier, wanneer de leerkracht klikt, dan opent de kiezer op precies dat beginuur en krijgt de gekozen activiteit haar standaardlengte, zoals vandaag.
- [ ] Gegeven een lesdag, wanneer de leerkracht indrukt op 9:00 en sleept tot in het kwartier van 10:15, dan toont het raster tijdens het slepen het bereik 9:00 - 10:30, opent de kiezer bij het loslaten met "van 9:00 tot 10:30" in de titel, en wordt de gekozen activiteit van 9:00 tot 10:30 gepland. Omhoog slepen geeft hetzelfde bereik in omgekeerde richting.
- [ ] Gegeven een gesleept bereik, wanneer de leerkracht in de kiezer een nieuwe activiteit maakt, dan noemt het blad hetzelfde bereik en wordt de nieuwe activiteit op dat bereik gepland.
- [ ] Gegeven een lopende sleep, wanneer de leerkracht Escape drukt, dan verdwijnt het bereik en opent er niets.
- [ ] De frontend-tests en `pnpm lint` zijn groen, en het raster is in een echte browser bekeken op desktop en op ~390px.

## Buiten scope

- Slepen om te plannen op een aanraakscherm: daar scrolt een veeg door de uren, en een tik blijft een kwartier kiezen zoals vandaag. Oplichten bij hoveren bestaat op een aanraakscherm niet.
- De maandweergave: die heeft geen uren.
- Een hoek of een algemene fiche plannen door te slepen in het raster: die komen uit het paneel naast de agenda, zoals vandaag.
- De toetsenbordroute verandert niet: Enter op een lege dag kiest nog altijd 8:30, en de uren van een geplande activiteit blijven in haar blad aanpasbaar (WCAG 2.2 SC 2.5.7).

## Open vragen

Geen.

## Werklog

- 2026-09-14 16:03 · agenda-sleep · aangemaakt (status in-uitvoering)
