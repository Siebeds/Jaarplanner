---
id: TB-060
titel: Smal blok op telefoonbreedte smoort zijn icoon en naam onder het doel-icoon
soort: technisch
status: nieuw
prioriteit: laag
aangemaakt: 2026-09-22
bijgewerkt: 2026-09-22 21:40
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Gezien tijdens de browsercontrole van FB-077, op een breedte van ongeveer 390px. Wanneer twee blokken op dezelfde dag
staan, is elk blok nog ongeveer 40px breed. Daarvan gaat 16px naar de eigen marge en 28px naar de plek die voor het
doel-icoon gereserveerd wordt (`pr-7`, FB-018). Wat overblijft voor naam en icoon samen is 4,4px.

Het gevolg: de naam is helemaal weg, en sinds FB-077 wordt ook het icoon van een algemene fiche voor twee derde
afgesneden. Het blok toont dan nog zijn vlak, het doel-icoon en het beginuur. Een fiche die alleen op haar dag staat,
heeft op diezelfde breedte 50,4px en toont haar icoon volledig.

Dit raakt elk blok, niet alleen een fiche: bij een activiteit verdwijnt op dezelfde manier de naam. De leerkracht kan
het blok wel aantikken, en het blad dat dan opent zegt alles.

## Voorgestelde wijziging

- In `frontend/src/features/plan/Tijdraster.tsx` de gereserveerde plek voor het doel-icoon laten meebewegen met de
  breedte van het blok, in plaats van ze altijd te reserveren. Tailwind v4 heeft `@container`, dus het blok kan zelf
  de container zijn en onder een drempel het doel-icoon weglaten of de marge intrekken.
- Beslis daarbij wat voorrang heeft in de laatste tientallen pixels: het doel-icoon (FB-018) of de identiteit van het
  blok (naam en, voor een fiche, haar icoon, FB-077).
- De 24px die WCAG 2.2 AA voor een raakdoel vraagt, blijft gelden voor het doel-icoon zolang het getoond wordt.

## Acceptatiecriteria

- [ ] Gegeven twee blokken op dezelfde dag op een breedte van ongeveer 390px, wanneer de leerkracht de agenda bekijkt, dan is het icoon van een algemene fiche volledig zichtbaar.
- [ ] Gegeven datzelfde blok, dan is er van de naam nog iets leesbaar, of zegt het blok zichtbaar niets en staat alles in het blad dat het opent.
- [ ] Gegeven een blok dat breed genoeg is, dan verandert er niets aan wat het vandaag toont.
- [ ] Gegeven het doel-icoon wanneer het getoond wordt, dan haalt het nog altijd een raakdoel van minstens 24px.

## Buiten scope

- De keuze van het vlak en het icoon van een algemene fiche zelf: dat is FB-077.
- De agenda op desktop: daar is er plaats genoeg.

## Open vragen

Geen.

## Werklog

- 2026-09-22 21:40 · claude-fb077 · aangemaakt (status nieuw)
- 2026-09-22 21:40 · claude-fb077 · gezien in de browsercontrole van FB-077, gemeten op 390px: inhoudsrij 4,4px bij twee blokken op één dag, 50,4px bij één blok
