---
id: TB-039
titel: Samenvatting van een thema telt subdoelen op dezelfde manier als 'Doelen per leeftijd'
soort: technisch
status: nieuw
prioriteit: laag
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 15:58
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Bij de browsercontrole van FB-044 (2026-09-16) toonde de samenvatting bovenaan een thema "7 op subthema's", terwijl
"Doelen per leeftijd" op dezelfde pagina "6 leerplandoelen" telde. Het verschil: de samenvatting telt koppelingen (een
leerplandoel dat onder twee subthema's hangt, telt twee keer), het overzicht telt verschillende leerplandoelen. Twee
getallen voor hetzelfde lijken op een fout.

## Voorgestelde wijziging

De samenvatting (`frontend/src/features/themas/ThemadetailScherm.tsx`, rond regel 338, `balans.subdoelen` met de
tekst `thema.doelenOpSubthemas`) en het margegetal van `Themadoelenoverzicht.tsx` tellen op dezelfde manier, of de
tekst zegt duidelijk wat er geteld wordt. Welke telling het wordt, is een keuze van de eigenaar (zie Open vragen).

## Acceptatiecriteria

- [ ] Gegeven een thema waarin één leerplandoel onder twee subthema's hangt, dan geven de samenvatting en "Doelen per
  leeftijd" hetzelfde getal, of zegt hun tekst waarom ze verschillen.
- [ ] Gegeven een thema zonder dubbele koppelingen, dan verandert er niets aan de getallen.
- [ ] Een frontendtest dekt het geval met een dubbele koppeling.

## Buiten scope

De dekking (FB-045).

## Open vragen

- Moet de samenvatting **verschillende leerplandoelen** tellen (zoals "Doelen per leeftijd"), of **koppelingen** met
  een duidelijkere tekst? Voorstel: verschillende leerplandoelen.

## Werklog

- 2026-09-16 15:58 · claude-fb-reeks · aangemaakt (status nieuw)
