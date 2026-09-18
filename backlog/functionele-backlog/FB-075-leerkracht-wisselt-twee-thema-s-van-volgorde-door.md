---
id: FB-075
titel: Leerkracht wisselt twee thema's van volgorde door te slepen, de agenda verhuist mee
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:47
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-6.2, FR-7.2]
---

## Aanleiding

In het jaarplan wil een leerkracht de volgorde van twee thema's omdraaien, bijvoorbeeld omdat een thema beter na de
herfstvakantie past. Vandaag moet ze daarvoor datums van plaatsingen apart verschuiven, en ziet ze niet goed wat er
gebeurt. Een themaplaatsing heeft eigen begin- en einddagen, en twee plaatsingen delen nooit een dag (ADR-0053).

## Gewenst gedrag

- De leerkracht sleept een thema op een ander thema in het jaarplan, en de twee wisselen van **volgorde**.
- Elk thema houdt zijn eigen lengte in schooldagen. Thema B (5 weken) begint waar thema A (3 weken) begon; A volgt
  meteen na B. Vakanties splitsen een plaatsing zoals vandaag.
- Wat aan een thema hangt, verhuist mee naar de nieuwe dagen van dat thema: de geplande subthema's, de activiteiten in
  de agenda en de hoekverrijkingen.
- Tijdens het slepen ziet de leerkracht waar elk thema terechtkomt, voor ze loslaat.
- Is een van beide plaatsingen vergrendeld, dan wisselt de app niet, en zegt ze waarom.
- De gewisselde plaatsingen zijn daarna een beslissing van de leerkracht: een (her)generatie gooit ze niet weg.

## Acceptatiecriteria

- [ ] Gegeven thema A (3 weken) gevolgd door thema B (5 weken), wanneer de leerkracht B op A sleept, dan begint B op de eerste dag van A, en volgt A meteen na B, elk met zijn eigen lengte.
- [ ] Gegeven activiteiten en subthema's in de agenda tijdens thema A, wanneer A en B gewisseld zijn, dan staan die onder A op de nieuwe dagen van A, in dezelfde volgorde binnen het thema.
- [ ] Gegeven een vakantie in de nieuwe periode van een thema, wanneer de thema's wisselen, dan wordt het thema door de vakantie gesplitst en valt er niets op een vakantiedag.
- [ ] Gegeven een vergrendelde plaatsing, wanneer de leerkracht ze wil wisselen, dan gebeurt er niets en zegt de app dat de plaatsing vergrendeld is.
- [ ] Gegeven twee gewisselde thema's, wanneer de leerkracht het jaarplan opnieuw laat genereren, dan blijven beide plaatsingen staan.

## Testscenario's

1. Meld aan als leerkracht van een klas. Open het jaarplan met twee thema's na elkaar, A van 3 weken en B van 5 weken.
   Plan in A een subthema en een activiteit.
2. Sleep B op A. Tijdens het slepen zie je waar B en A zullen staan.
3. Laat los: B begint op de oude eerste dag van A, A volgt meteen erna. Open de agenda in de nieuwe weken van A: het
   subthema en de activiteit staan er.
4. Vergrendel een plaatsing en probeer ze te wisselen: er gebeurt niets, en de app zegt waarom.
5. Laat het jaarplan opnieuw genereren: de twee gewisselde thema's staan nog op hun plaats.

## Buiten scope

- Een thema naar een willekeurige datum slepen (bestaat al).
- Meer dan twee thema's tegelijk herschikken.

## Open vragen

- Staat er tussen A en B een ander thema of een lege periode, wisselen dan alleen A en B van plaats, terwijl wat ertussen
  staat mee schuift? De bouwsessie legt dit voor aan de eigenaar voor ze begint.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
