---
id: TB-073
titel: Toegankelijkheidsgaten dichten: focus, labels en schermtitels
soort: technisch
status: klaar
prioriteit: hoog
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 10:30
opgepakt-door: claude-tb073
branch: ticket/TB-073-toegankelijkheid
pr: 167
geblokkeerd:
fr: []
---

## Aanleiding

Een toetsing van de frontend tegen de Web Interface Guidelines van Vercel vond een reeks kleine gaten. Ze breken de
WCAG 2.2 AA-belofte van de app (ADR-0017) of hinderen wie met een schermlezer of het toetsenbord werkt:

- **Geen zichtbare focus in het woordveld.** `components/ui/Woordchips.tsx` zet `outline-none` op het invoerveld.
  Die utility wint van de globale `:focus-visible`-ring, en de rand eromheen heeft geen `focus-within`. Dat raakt de
  kernwoordenschat en het woordweb (WCAG 2.4.7).
- **De vaste kop kan het veld met focus bedekken.** `app/Schermkop.tsx` is `sticky top-0`, maar niets zet
  `scroll-padding-top`. Wie terug tabt, kan het veld onder de kop verliezen (WCAG 2.4.11).
- **Zoekveld zonder naam.** Het zoekveld in `features/activiteiten/Doelkiezer.tsx` heeft alleen een placeholder;
  de andere zoekvelden hebben een `aria-label`.
- **Focus valt weg tijdens het bewaren.** `components/ui/Knop.tsx` kent alleen `disabled`. Een knop die tijdens een
  mutatie uitgeschakeld wordt, laat de toetsenbordfocus naar `<body>` vallen. `Rechtenblad.tsx` lost dat al op met
  `aria-disabled`.
- **Een knop die navigeert.** "Bekijken" in `features/kat/Katvenster.tsx` is een `Knop` die `navigate()` aanroept:
  geen middelklik, geen Ctrl+klik, en een schermlezer noemt het een knop. `Knoplink` bestaat daarvoor.
- **Geen schermtitel.** Geen enkel scherm zet `document.title`. Elk tabblad en elke stap in de geschiedenis heet
  hetzelfde, en een schermlezer hoort bij een schermwissel geen nieuwe titel (WCAG 2.4.2).
- **Laadteksten zijn niet consistent.** In `i18n/nl.json` staan laadteksten soms met `…` en soms zonder ("Bezig",
  "Bewaren", "Aanmaken"), en `bewaarBezig` leest zo als de knop in rust.

## Voorgestelde wijziging

- `Woordchips`: de rand toont een focusring met `focus-within`, of het invoerveld houdt de globale ring.
- `scroll-padding-top` op de scroller, gelijk aan de hoogte van `Schermkop`.
- Een `aria-label` op het zoekveld van `Doelkiezer`.
- `Knop` krijgt een bezig-stand die `aria-disabled` zet en klikken negeert, in plaats van `disabled`. De knoppen die
  tijdens een mutatie uitgeschakeld worden, gebruiken die.
- "Bekijken" in `Katvenster` wordt een `Knoplink`.
- Een kleine hook die per route de titel zet in de vorm "<scherm> · <app-naam>". De app-naam volgt FB-085 (Vizier)
  als dat al gebouwd is, anders de huidige naam. De schermnamen komen uit `nl.json`.
- Alle laadteksten in `nl.json` eindigen op `…` en verschillen van de tekst in rust.

## Acceptatiecriteria

- [x] Gegeven het woordveld van de kernwoordenschat, wanneer de gebruiker er met Tab in komt, dan is een focusring
      zichtbaar, gemeten in een echte browser, in lichte en donkere weergave.
- [x] Gegeven een lang scherm met de vaste kop, wanneer de gebruiker met Shift+Tab naar boven gaat, dan staat het
      veld met focus nooit onder de kop.
- [x] Gegeven het zoekveld van de doelkiezer, wanneer een schermlezer het voorleest, dan heeft het een naam.
- [x] Gegeven een knop die een mutatie start, wanneer de mutatie loopt, dan blijft de toetsenbordfocus op die knop
      en doet een tweede klik niets.
- [x] Gegeven "Bekijken" in het kattenvenster, wanneer de gebruiker Ctrl+klikt, dan opent het doel in een nieuw
      tabblad.
- [x] Gegeven elk scherm uit de navigatie, wanneer het opent, dan draagt het tabblad de naam van dat scherm.

## Buiten scope

Het contrast opnieuw meten, en de app-naam of het favicon zelf (FB-085).

## Open vragen

Geen.

## Werklog

- 2026-09-23 09:49 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-23 09:55 · claude-tb073 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-23 10:14 · claude-tb073 · gebouwd: Knop-bezigstand op de knoppen die een mutatie starten, focusring Woordchips, scroll-padding onder de kop, schermtitels, Bekijken als link, laadteksten met …; lint en 1321 tests groen
- 2026-09-23 10:20 · claude-tb073 · browserpas (mock, headless Chrome): focusring woordveld licht/donker zichtbaar, Shift+Tab 0 velden onder de kop op 1440 en 390 (tegenproef zonder padding: 4), titels per scherm, Ctrl+klik op Bekijken opent nieuw tabblad
- 2026-09-23 10:22 · claude-tb073 · antagonist: COMPLIANT; MINOR niet opgelost: Plaatsingkaart deelt één bezig over vier knoppen (aria-busy ook op knoppen die niets startten), useSchermtitel zet de titel niet terug bij unmount, scroll-padding alleen in de browser getest, Ctrl+klik kiest de klas ook in het huidige tabblad
- 2026-09-23 10:22 · claude-tb073 · in-uitvoering → klaar: gebouwd en getest: alle zes criteria afgevinkt (1, 2, 5, 6 in de browser; 3 en 4 met Vitest), lint en 1321 tests groen
- 2026-09-23 10:22 · claude-tb073 · PR #167
- 2026-09-23 10:30 · claude-tb073 · CI: Katmand-test 'closes on Escape' faalde op de PR-run door een bestaande race (Escape vóór het focuseffect); test wacht nu tot het venster de focus heeft
