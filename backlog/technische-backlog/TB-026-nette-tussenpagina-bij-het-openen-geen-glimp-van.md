---
id: TB-026
titel: Nette tussenpagina bij het openen, geen glimp van de app voor de aanmelding
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 19:47
opgepakt-door: tussenpagina
branch: ticket/tussenpagina-aanmelding
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Wie de app op Azure opent zonder sessie, ziet eerst kort de volledige jaarplanner (navigatie en agenda) en wordt pas
daarna doorgestuurd naar de Microsoft-aanmelding. Dat oogt slordig. De eigenaar wil een nette tussenpagina.

Oorzaak: de schil tekent meteen, en pas wanneer `/api/ik` met 401 antwoordt, stuurt `aanmeldOmleiding` de browser
door naar `/api/aanmelden`.

## Voorgestelde wijziging

- **Frontend, `App.tsx`:** een aanmeldpoort rond de route van de schil. Zolang `useIk` nog laadt of met 401 faalt,
  toont ze een tussenpagina in plaats van de schil; pas wanneer de persoon bekend is, tekent de schil. Een andere fout
  (server onbereikbaar) toont een melding met "Opnieuw proberen". `/geen-toegang` en `/aanmelden-mislukt` blijven
  buiten de poort.
- **Tussenpagina:** het merk (woordmerk met de jaarbalk) gecentreerd, met een korte statusregel die pas na een
  ogenblik verschijnt, zodat een aangemelde leerkracht bij een snelle laadtijd geen tekst ziet flitsen.
- **`index.html`:** hetzelfde merk statisch in `#root`, zodat er ook vóór het laden van het script niets anders te zien
  is en React naadloos overneemt.
- Teksten in `nl.json`.

## Acceptatiecriteria

- [ ] Gegeven een browser zonder sessie, wanneer ik de app open, dan zie ik tot de doorsturing naar Microsoft alleen de tussenpagina en nooit de navigatie of een scherm van de app.
- [ ] Gegeven een aangemelde gebruiker, wanneer die de app opent, dan gaat de tussenpagina zonder flitsende tekst over in de app.
- [ ] Gegeven dat `/api/ik` faalt met iets anders dan 401, wanneer de tussenpagina dat merkt, dan toont ze een melding en een knop "Opnieuw proberen" die de vraag opnieuw stelt.
- [ ] Gegeven `/geen-toegang` of `/aanmelden-mislukt`, wanneer ik die open, dan werken ze zoals voorheen en vragen ze de API niets bij het openen.
- [ ] De tussenpagina haalt WCAG 2.2 AA (contrast gemeten in de browser, statusregel via `role="status"`), in licht en donker, op desktop en op ~390px.

## Buiten scope

De huisstijl van de Microsoft-aanmeldpagina zelf (company branding in Entra). Een doorsturing aan de serverkant
zonder de SPA te laden.

## Open vragen

Geen.

## Werklog

- 2026-09-15 19:34 · tussenpagina · aangemaakt (status in-uitvoering)
- 2026-09-15 19:47 · tussenpagina · Aanmeldpoort en tussenpagina gebouwd; vitest 876/876 groen, pnpm lint en pnpm build groen
