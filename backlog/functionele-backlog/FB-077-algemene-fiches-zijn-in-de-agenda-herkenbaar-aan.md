---
id: FB-077
titel: Algemene fiches zijn in de agenda herkenbaar aan een eigen kleur en icoon
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:47
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-6.1]
---

## Aanleiding

In de agenda lijken algemene (terugkerende) fiches, zoals een kringmoment of turnen, op activiteiten van het thema. De
leerkracht ziet niet in één oogopslag wat terugkerend is en wat bij het thema hoort.

## Gewenst gedrag

- Een algemene fiche heeft in de agenda en in de zijbalk een **eigen, rustige kleur** en een **icoon**, zodat ze nooit
  alleen door kleur herkenbaar is.
- Alle algemene fiches delen die ene kleur en dat icoon; activiteiten blijven eruitzien zoals vandaag.
- De kleur botst niet met de kleuren die al vergeven zijn: de doelsoorten, de status van voorstellen, de dekking en het
  accent.

## Acceptatiecriteria

- [ ] Gegeven een algemene fiche en een activiteit in dezelfde week, wanneer de leerkracht de agenda bekijkt, dan heeft de fiche een andere kleur én een icoon dat de activiteit niet heeft.
- [ ] Gegeven de zijbalk, dan dragen de algemene fiches daar dezelfde kleur en hetzelfde icoon als in de agenda.
- [ ] Gegeven de tekst op een algemene fiche, dan haalt die een contrast van minstens 4,5:1, gemeten in de browser.
- [ ] Gegeven een schermlezer, dan wordt een algemene fiche aangekondigd als algemene fiche.

## Testscenario's

1. Meld aan als leerkracht en open de agenda van een week met een algemene fiche en een activiteit.
2. De algemene fiche heeft een eigen kleur en een icoon; de activiteit heeft ze niet.
3. Open de zijbalk: de algemene fiches dragen daar dezelfde kleur en hetzelfde icoon.
4. Bekijk het op een breedte van ongeveer 390px: kleur en icoon zijn nog zichtbaar.

## Buiten scope

- Een eigen kleur per algemene fiche.
- Een vast uurrooster voor algemene fiches.

## Open vragen

Geen. De kleur en het icoon kiest de bouwsessie met de frontend-design-skill.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
