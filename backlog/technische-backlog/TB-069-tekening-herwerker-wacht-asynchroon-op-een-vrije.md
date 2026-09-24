---
id: TB-069
titel: Tekening-herwerker wacht asynchroon in plaats van een thread te blokkeren
soort: technisch
status: klaar
prioriteit: laag
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-24 12:56
opgepakt-door: claude-tb069
branch: ticket/TB-069-tekening-herwerker-async
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Gevonden bij de securityscan van 2026-09-23. `SkiaTekeningHerwerker`
(`Infrastructure/Ontwikkelingsrapport/SkiaTekeningHerwerker.cs:64`) laat hoogstens twee tekeningen tegelijk decoderen
en wacht op een vrije plaats met een synchrone `Gelijktijdig.Wait()`, midden in een asynchroon verzoek. Komen er veel
uploads tegelijk, dan blokkeert elk wachtend verzoek een thread van de threadpool in plaats van netjes in de rij te
wachten. Bij genoeg gelijktijdige uploads raakt de threadpool op en wordt de hele API traag.

## Voorgestelde wijziging

- `Gelijktijdig.WaitAsync(cancellationToken)` in plaats van `Wait()`, en het pad volledig asynchroon tot aan de
  controller.
- Code: `SkiaTekeningHerwerker.cs`, zijn interface en de aanroeper in `OntwikkelingsrapportenController`.

## Acceptatiecriteria

- [x] Gegeven de tekening-herwerker, dan wacht hij op een vrije plaats zonder een thread te blokkeren: er staat geen
  `.Wait()` of `.Result` meer in dat pad.
- [x] Gegeven een wachtend verzoek dat de browser afbreekt, dan stopt het wachten.
- [x] Gegeven een gewone upload van een tekening, dan werkt ze zoals vandaag en slagen de bestaande tests.

## Buiten scope

- De limiet van twee gelijktijdige decodes en de maximale beeldgrootte: die blijven.

## Open vragen

Geen.

## Werklog

- 2026-09-23 00:22 · claude-securityscan · aangemaakt (status nieuw)
- 2026-09-24 12:46 · claude-tb069 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten (opdracht via zijn sessie)
- 2026-09-24 12:56 · claude-tb069 · criteria afgevinkt: geen Wait()/Result meer in het pad (grep), unit tests wachten-zonder-blokkeren en afbreken-tijdens-wachten, bestaande tekeningtests groen
- 2026-09-24 12:56 · claude-tb069 · antagonist: COMPLIANT, 1 MINOR open (default-token op de interface, enige aanroeper geeft hem mee)
- 2026-09-24 12:56 · claude-tb069 · in-uitvoering → klaar: HerwerkAsync wacht met WaitAsync(token), async tot de controller; dotnet test (unit 2359, integratie 616 tegen Postgres) en dotnet format groen
