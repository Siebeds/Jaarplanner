---
id: TB-071
titel: Slepen in de agenda hertekent alleen wat verandert
soort: technisch
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-24 14:10
opgepakt-door: claude-tb071
branch: ticket/TB-071-slepen-hertekent-minder
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Wie in de agenda een blok versleept, laat de app veel meer hertekenen dan nodig. De React Compiler staat niet aan
en er is nergens `React.memo`, dus elke render bovenaan tekent alles eronder opnieuw. Op een tragere schoollaptop
maakt dat het slepen minder vloeiend. De analyse tegen de Vercel-regels (rerender-*) vond vijf plekken:

- `features/plan/Tijdraster.tsx`, `useSleepvoorbeeld`: `onDragMove` maakt bij elke muisbeweging een nieuw
  `{ begin, einde }`-object, ook als het kwartier niet verandert. De dagkolom waarboven je sleept hertekent daardoor
  bij elke beweging, met al haar blokken erbij. Dit is het drukste pad van de app.
- `features/plan/Agendascherm.tsx`: `setSleepNaam` bij begin, loslaten en annuleren van een sleep zet state
  bovenaan het scherm, en hertekent zo de kop, de dekkingsbalk, het hoekenpaneel en alle kolommen en blokken.
- `features/plan/Tijdraster.tsx`: `blokken.filter(b => b.datum === dag.datum)` per kolom maakt telkens een nieuwe
  array, waardoor de `useMemo` op de overlap-indeling in `Dagkolom` nooit iets bewaart. Dat gebeurt ook bij de klok
  (`useNu`) die elke minuut het hele raster hertekent.
- `lib/scherm.ts`, `useMediaQuery`: de `subscribe` staat inline, dus `useSyncExternalStore` schrijft zich bij elke
  render opnieuw in op de mediaquery.
- `lib/queries.ts`, `useThemasVoorKlas`: geeft bij elke render een nieuwe array terug, waardoor de memo-keten in
  `features/plan/Subthemaplanner.tsx` (subthema's, gekozen, activiteiten, voorstellen) bij elke toetsaanslag opnieuw
  rekent, en `SortableContext` telkens nieuwe `items` krijgt.

## Voorgestelde wijziging

- De sleep-preview geeft het vorige object terug als begin en einde gelijk blijven.
- `sleepNaam` verhuist naar een klein kind dat de `DragOverlay` bezit (via `useDndMonitor`), zodat begin en einde
  van een sleep het scherm zelf niet meer hertekenen.
- `Tijdraster` groepeert de blokken per datum in zijn bestaande `useMemo` en geeft elke kolom een stabiele array.
- `useMediaQuery` krijgt een `subscribe` per query die buiten de render leeft.
- `useThemasVoorKlas` combineert zijn resultaten met `useQueries({ combine })`, zodat de array stabiel blijft zolang
  de gegevens niet veranderen.
- `React.memo` alleen waar een meting toont dat het helpt.

Meet voor en na met de React DevTools Profiler (een blok slepen over een week met veel blokken) en noteer het
resultaat in het werklog.

## Acceptatiecriteria

- [ ] Gegeven een blok dat binnen hetzelfde kwartier bewogen wordt, wanneer de muis beweegt, dan hertekent geen
      enkele dagkolom (Profiler).
- [ ] Gegeven een sleep die begint of eindigt, wanneer de Profiler meekijkt, dan hertekenen de kop, de dekkingsbalk
      en het hoekenpaneel van de agenda niet.
- [ ] Gegeven de minuutklok die tikt, wanneer niets aan de blokken verandert, dan wordt de overlap-indeling van geen
      enkele kolom opnieuw berekend.
- [ ] Gegeven de subthemaplanner, wanneer de gebruiker typt, dan rekenen de memo's op subthema's en voorstellen niet
      opnieuw zolang de gegevens gelijk blijven.
- [ ] Gegeven slepen met muis, aanraking en toetsenbord, wanneer het nieuwe gedrag getest wordt, dan werkt het zoals
      voordien en slagen de bestaande kalendertests.

## Buiten scope

De React Compiler aanzetten, en de agenda-acties via een context doorgeven (TB-072).

## Open vragen

Geen.

## Werklog

- 2026-09-23 09:48 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-24 14:10 · claude-tb071 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten (opdracht via orkestrerende sessie)
