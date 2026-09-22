---
id: FB-086
titel: Gekozen knop in de weergaveschakelaar ligt vlak, zonder rand of schaduw
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-22
bijgewerkt: 2026-09-22 23:45
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-6.3]
---

## Aanleiding

In de agenda kies je met de weergaveschakelaar tussen Maand, Week, Werkweek en Dag. De gekozen knop heeft vandaag
een donkere rand en een schaduw eronder, waardoor hij boven de balk lijkt te zweven. Dat oogt onrustig. Dezelfde
schakelaar staat ook op andere schermen (Dekking, Doelen, Import, Instellingen, het activiteitformulier en de
subthemaplanner) en heeft daar hetzelfde probleem.

## Gewenst gedrag

De gekozen knop ligt vlak in de balk: een witte vulling met vette, donkere tekst, zonder rand en zonder schaduw. De
andere knoppen blijven zoals ze zijn. Dit geldt voor elke weergaveschakelaar in de app, niet alleen in de agenda.
Wie de schakelaar gebruikt, ziet nog altijd meteen welke keuze actief is, ook in de donkere modus.

## Acceptatiecriteria

- [ ] Gegeven de agenda, wanneer een weergave gekozen is, dan heeft de gekozen knop een witte vulling en vette donkere tekst, zonder rand en zonder schaduw.
- [ ] Gegeven een ander scherm met een weergaveschakelaar (bv. Dekking of Instellingen), wanneer je het opent, dan ziet de gekozen knop er hetzelfde uit als in de agenda.
- [ ] Gegeven de donkere modus, wanneer je de schakelaar bekijkt, dan is de gekozen knop even duidelijk te onderscheiden van de andere.
- [ ] Gegeven de nieuwe stijl, wanneer de bouwer het contrast in een echte browser meet, dan onderscheidt de gekozen knop zich volgens WCAG 2.2 AA van de andere; lukt dat niet, dan meldt de bouwer het aan de eigenaar in plaats van het zelf anders op te lossen.
- [ ] Gegeven een schermlezer of het toetsenbord, wanneer je door de schakelaar gaat, dan wordt de gekozen knop nog steeds als gekozen aangekondigd en blijft de focusrand zichtbaar.

## Testscenario's

1. Open de agenda. De gekozen weergave (bv. Werkweek) is een witte knop met vette tekst, zonder rand en zonder schaduw eronder; hij zweeft niet meer.
2. Kies Maand, dan Dag. Telkens krijgt de nieuwe keuze die stijl en verliest de vorige ze.
3. Open het dekkingsoverzicht en Instellingen. De schakelaars daar zien er hetzelfde uit.
4. Zet de donkere modus aan. De gekozen knop is nog duidelijk herkenbaar.
5. Bekijk de agenda op een smal scherm (~390px). De schakelaar past en de gekozen knop is herkenbaar.

## Buiten scope

De plaats, de volgorde en de namen van de weergaven, en de knop Naar jaarplan naast de schakelaar.

## Open vragen

Geen.

## Werklog

- 2026-09-22 23:45 · Siebeds · aangemaakt (status nieuw)
