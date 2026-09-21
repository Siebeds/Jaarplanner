---
id: TB-037
titel: Zoekveld van het doelenregister toont één wisknop, ook op de telefoon
soort: technisch
status: in-uitvoering
prioriteit: laag
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-21 22:26
opgepakt-door: zoekveld-wisknop
branch: ticket/TB-037-zoekveld-wisknop
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Bij de browsercontrole van FB-041 (2026-09-16) toonde het zoekveld van het doelenregister op 390px twee kruisjes om te
wissen: dat van de browser zelf en de eigen knop "zoek wissen" van de app (schermafbeelding
`backlog/worklogs/FB-041/mobiel-03-minimumdoelen-zoek-tellen.png` op de branch van FB-041). Twee knoppen die hetzelfde
doen, zijn verwarrend en nemen ruimte in.

## Voorgestelde wijziging

`frontend/src/features/doelen/DoelenScherm.tsx` (rond regel 193) gebruikt `<Invoer type="search">` met een eigen
wisknop. Verberg de ingebouwde wisknop van de browser (bv. `::-webkit-search-cancel-button` in
`frontend/src/index.css`, of in de `Invoer`-component voor alle zoekvelden), zodat alleen de eigen knop overblijft.
Kijk na of andere zoekvelden met `type="search"` hetzelfde probleem hebben.

## Acceptatiecriteria

- [x] Gegeven het doelenregister op ~390px, wanneer de leerkracht een zoekterm intikt, dan staat er precies één
  wisknop in het zoekveld.
- [x] Gegeven dezelfde situatie op desktop (Chrome en Edge), dan staat er ook precies één wisknop.
- [x] Gegeven die knop, wanneer men erop klikt, dan is het veld leeg, zoals nu.
- [x] Nagekeken in een echte browser op desktop en ~390px.

## Buiten scope

Het gedrag van het zoeken zelf.

## Open vragen

Geen.

## Werklog

- 2026-09-16 15:58 · claude-fb-reeks · aangemaakt (status nieuw)
- 2026-09-21 22:05 · zoekveld-wisknop · nieuw → in-uitvoering: opgepakt: eigenaar wil starten, fout geverifieerd in de browser
- 2026-09-21 22:10 · zoekveld-wisknop · utility eigen-wisknop in index.css, op het doelenregister en het bestemmingsblad; lint, 1232 tests en build groen; browsercontrole loopt
- 2026-09-21 22:26 · zoekveld-wisknop · browsercontrole geslaagd op 1280x800 en 390x844: native kruisje gemeten in de shadow DOM (display none, geen boxmodel), met controleproef zonder de klasse; Edge niet apart geopend, zelfde Chromium-engine en zelfde pseudo-element
