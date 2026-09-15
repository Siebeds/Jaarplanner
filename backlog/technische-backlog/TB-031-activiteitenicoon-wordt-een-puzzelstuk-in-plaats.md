---
id: TB-031
titel: Activiteitenicoon wordt een puzzelstuk in plaats van een ruit
soort: technisch
status: klaar
prioriteit: laag
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 21:30
opgepakt-door: activiteitenicoon
branch: ticket/activiteitenicoon-puzzelstuk
pr: 102
geblokkeerd:
fr: []
---

## Aanleiding

Het activiteitenicoon in het zijpaneel van de agenda (FB-017) is één plat blad uit de stapel van het themaicoon. Zonder
de stapel eronder leest het op 20 pixels als een ruit, een oog of een diamant, en zegt het een leerkracht niets. De
eigenaar koos uit vier kandidaten (puzzelstuk, bouwsteen, klembord met vink, schaar) voor het puzzelstuk: een stukje
van het thema, herkenbaar in een kleuterklas, en het botst met geen ander icoon van de app.

## Voorgestelde wijziging

`IcoonActiviteit` in `frontend/src/components/Iconen.tsx` tekent een puzzelstuk (een vierkant met een nop bovenaan en
rechts), in dezelfde geometrie als de rest van de set: 24-raster, lijn 1,6, ronde uiteinden en hoeken, geen vulling.
Het commentaar erboven legt de nieuwe keuze uit. De drie plaatsen die het icoon tonen (de schakelaar in het zijpaneel
in `Navigatie.tsx`, de kop van `Hoekenpaneel.tsx` en de schakelaar boven de agenda in `Agendascherm.tsx`) gebruiken
hetzelfde component en veranderen zelf niet.

## Acceptatiecriteria

- [x] Gegeven de agenda op desktop, wanneer het zijpaneel smal of breed staat, dan toont de schakelaar Activiteiten een puzzelstuk naast het fiche- en het hoekicoon.
- [x] Gegeven het geopende activiteitenpaneel, dan toont de kop hetzelfde puzzelstuk.
- [x] Gegeven de schakelaar boven de agenda (Activiteiten, Algemene fiches, Hoekenfiches), dan toont Activiteiten hetzelfde puzzelstuk.
- [x] Gegeven het icoon op 16 en 20 pixels, in het lichte en het donkere thema, dan is het puzzelstuk volledig zichtbaar en niet afgesneden, en blijft het verborgen voor schermlezers: het label draagt de betekenis.
- [x] Gegeven de wijziging, dan slagen `pnpm lint` en `pnpm test`.

## Buiten scope

De andere iconen van de set. Het themaicoon (de stapel bladen) blijft zoals het is.

## Open vragen

Geen.

## Werklog

- 2026-09-15 21:15 · activiteitenicoon · aangemaakt (status in-uitvoering)
- 2026-09-15 21:22 · activiteitenicoon · IcoonActiviteit tekent nu het gekozen puzzelstuk; de drie plaatsen die het tonen nemen het vanzelf over.
- 2026-09-15 21:23 · activiteitenicoon · Gates: pnpm lint groen, pnpm test 962/962 groen.
- 2026-09-15 21:24 · activiteitenicoon · Antagonist: COMPLIANT, geen CRITICAL of MAJOR bevindingen.
- 2026-09-15 21:27 · activiteitenicoon · Browserpas (headless Chrome, wegwerpkopie jp_tb031, daarna verwijderd): puzzelstuk in zijpaneel breed en smal (20px), paneelkop (16px), licht en donker, en in de chip boven de agenda op 390px (16px); oud ruitje nergens meer, icoon aria-hidden. Criteria afgevinkt.
- 2026-09-15 21:27 · activiteitenicoon · in-uitvoering → klaar: Activiteitenicoon is een puzzelstuk; lint, 962 tests, antagonist en browserpas groen.
- 2026-09-15 21:30 · activiteitenicoon · PR #102
