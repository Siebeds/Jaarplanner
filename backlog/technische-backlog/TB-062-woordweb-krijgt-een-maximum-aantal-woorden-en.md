---
id: TB-062
titel: Woordweb krijgt een maximum aantal woorden en valt onder de promptbegrenzing
soort: technisch
status: klaar
prioriteit: hoog
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 12:35
opgepakt-door: claude-tb062
branch: ticket/TB-062-woordweb-maximum
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Gevonden bij de securityscan van 2026-09-23. Elke aangemelde gebruiker mag een eigen woordweb maken op elk subthema
(ADR-0043 D2), ook iemand zonder enig ander recht. Daarbij ontbreken twee grenzen:

- **Geen maximum aantal woorden.** `Woordweb.VoegWoordenToe` (`Domain/Schoolcontent/Woordweb.cs:76`) begrenst alleen de
  lengte van een woord (64 tekens), niet hoeveel woorden één verzoek of één web bevat. Alleen de standaardlimiet van
  Kestrel (ongeveer 30 MB) houdt de body tegen. Per woord lopen `Zoek` en `VolgendVolgnummer` lineair over het hele
  web, dus één groot verzoek is kwadratisch werk: het houdt een thread lang bezig en vult de databank.
- **Geen promptbegrenzing.** `WoordwebService.StelWoordenVoorAsync` zet elk woord van het web in de prompt
  (`WoordwebPromptBuilder`) en roept `Promptbegrenzing.Bewaak` niet aan, anders dan de andere AI-routes (TB-007). Een
  web met duizenden woorden maakt van elke vraag om woordvoorstellen een aanroep van meer dan 100.000 tokens, en de
  eigenaar van het web mag die in een lus herhalen.

## Voorgestelde wijziging

- Een maximum aantal woorden per verzoek en per woordweb, in het domein (`Woordweb`) zodat elke route het krijgt, met
  een Nederlandse melding die de leerkracht begrijpt. Het maximum ligt ruim boven wat een echt woordweb nodig heeft.
- `VoegWoordenToe` controleert dubbels met een set en houdt het volgnummer bij, in plaats van per woord over het web te
  lopen.
- `WoordwebService.StelWoordenVoorAsync` laat de prompt eerst door `Promptbegrenzing.Bewaak` gaan, zoals de andere
  AI-routes.
- Code: `Domain/Schoolcontent/Woordweb.cs`, `Infrastructure/Woordwebs/WoordwebService.cs`,
  `Api/Controllers/WoordwebsController.cs`, `nl.json` voor de melding, en tests in domein en integratie.

## Acceptatiecriteria

- [x] Gegeven een woordweb, wanneer iemand in één verzoek meer woorden stuurt dan het maximum, dan weigert de server
  met een Nederlandse melding en wordt er niets bewaard.
- [x] Gegeven een woordweb dat het maximum bereikt heeft, wanneer iemand nog een woord toevoegt, dan weigert de server
  met dezelfde soort melding.
- [x] Gegeven een prompt voor woordvoorstellen die boven `AiPrompt:MaxTokens` uitkomt, wanneer iemand voorstellen
  vraagt, dan wordt het model niet aangeroepen en krijgt de gebruiker de melding van de promptbegrenzing.
- [x] Gegeven een woordweb van normale grootte, dan werken woorden toevoegen en voorstellen vragen zoals vandaag.

## Buiten scope

- Een limiet op hoe vaak iemand AI-vragen stelt: het maandbudget van FB-055 begrenst de kost, en de vraag naar een
  limiet per gebruiker staat daar.
- Wie een woordweb mag maken: ADR-0043 blijft gelden.

## Open vragen

- Het maximum aantal woorden per woordweb. Voorstel: 200, tenzij de eigenaar een echt woordweb kent dat groter is.

## Werklog

- 2026-09-23 00:21 · claude-securityscan · aangemaakt (status nieuw)
- 2026-09-23 12:19 · claude-tb062 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-23 12:33 · claude-tb062 · gebouwd: maximum 200 woorden in het web en 400 bewaard, lineaire toevoeging, bodylimiet 128 KB, promptbegrenzing op woordvoorstellen; 2264 unit- en 601 integratietests groen, dotnet format schoon
- 2026-09-23 12:35 · claude-tb062 · antagonist: COMPLIANT; open: maximum 200 (en 400 bewaard) wacht op bevestiging eigenaar; niet opgelost (MINOR): capaciteitscontrole en bewaren niet atomair bij gelijktijdige verzoeken van dezelfde eigenaar, 413 zonder Nederlandse zin boven 128 KB; melding komt van de server, niet uit nl.json
- 2026-09-23 12:35 · claude-tb062 · in-uitvoering → klaar: criteria afgevinkt met de unit- en integratietests in WoordwebTests, PromptbegrenzingTests en WoordwebEndpointsTests; alle backendtests groen, dotnet format schoon, geen frontendwijziging
