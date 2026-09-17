---
id: TB-054
titel: Generatie mikt op minimumdoelen en het rapport toont het minimumdoelvooruitzicht
soort: technisch
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-17
bijgewerkt: 2026-09-17 08:58
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

TB-052 liet het voortgangsendpoint de minimumdoelen tellen: hoeveel er nu gedekt zijn, en hoeveel na het aanvaarden
van de voorgestelde themaplaatsingen (`AantalMinimumdoelenGedekt`, `AantalMinimumdoelenMogelijkGedekt`,
`AantalMinimumdoelen`). Twee punten bleven open, omdat de generatie uitstaat en er geen rapportscherm is:

1. Geen scherm toont het minimumdoelvooruitzicht. Een leerkracht die een gegenereerd plan krijgt, ziet dus niet hoeveel
   minimumdoelen het plan zou dekken. Criterium 3 van TB-052 ("de tekst zegt dat het om minimumdoelen gaat") wacht
   hierop (besluit eigenaar 2026-09-17).
2. De generatieprompt (`JaarplanGeneratiePromptBuilder`) vraagt het model nog "zoveel mogelijk verschillende
   leerplandoelen" te dekken. Sinds ADR-0052 dekt een thema alleen minimumdoelen, via zijn themadoelen, dus de prompt
   stuurt naar iets wat de dekking niet telt.

Beide horen bij de herwerking van de generatie voor datums (TB-053) en worden gebouwd zodra dat rapport en dat
promptcontract er staan.

## Voorgestelde wijziging

- Het rapport na een generatierun toont het minimumdoelvooruitzicht uit `GET …/dekking/voortgang`: gedekt nu en
  gedekt als je het plan aanvaardt, met het totaal. De tekst staat in `nl.json` en zegt "minimumdoelen". Het
  plafond wordt nooit als dekking voorgesteld (Art. IV.1) en blijft weg zolang `isBetrouwbaar` onwaar is.
- De prompt geeft per thema zijn themadoelen (minimumdoelen) mee in plaats van leerplandoelen, en vraagt het model
  zoveel mogelijk verschillende minimumdoelen van de mijlpaal van de klas te dekken. Alleen geladen Op.stap-doelen
  (Art. IV.4); de server beoordeelt de dekking, niet het model.
- Code: `Application/Planning/Generatie` (`JaarplanGeneratiePromptBuilder` en de tests ervan), het rapport in
  `frontend/src/features/plan`, `nl.json`, en `frontend/src/i18n/catalogus.test.ts` voor de voorwaardelijke zin.

## Acceptatiecriteria

- [ ] Gegeven een gegenereerd plan met een voorgesteld thema dat drie nog niet gedekte minimumdoelen als themadoel
  heeft, wanneer het rapport verschijnt, dan toont het "als je het plan aanvaardt" drie hoger dan het huidige cijfer,
  en de tekst zegt "minimumdoelen".
- [ ] Gegeven een plan met een vervallen plaatsing die niet geweigerd is, wanneer het rapport verschijnt, dan toont
  het geen cijfers en zegt het waarom.
- [ ] Gegeven de school heeft thema's met themadoelen, wanneer de prompt gebouwd wordt, dan noemt ze per thema zijn
  minimumdoelen en vraagt ze geen leerplandoelen te dekken.
- [ ] `dotnet test`, `dotnet format`, `pnpm test` en `pnpm lint` zijn groen, en het rapport is bekeken in de browser
  op desktop en op ~390px.

## Buiten scope

- De generatierun met datums zelf, het rapport van wat nieuw is, bleef of niet paste, en het aanzetten van de knop
  (TB-053).
- De Dekkingsbalk boven de agenda: die blijft leerplandoelen tonen.
- Het dekkingsoverzicht.

## Open vragen

- Waar staat het rapport na een run, en hoe ziet het eruit? Dat beslist TB-053; dit ticket vult het aan.

## Werklog

- 2026-09-17 08:58 · claude-53c162c3 · aangemaakt (status nieuw)
