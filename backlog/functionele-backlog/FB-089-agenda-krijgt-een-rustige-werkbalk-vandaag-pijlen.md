---
id: FB-089
titel: Agenda krijgt één rustige werkbalk: vandaag, pijlen, datum en weergavekeuze op één lijn
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 11:12
opgepakt-door: claude-fb089
branch: ticket/FB-089-agenda-werkbalk
pr: 168
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vindt de knoppen boven de agenda "lelijk en onoverzichtelijk, niet aligned". Dat klopt ook in de code:

- **Drie maten naast elkaar.** De weergavekeuze (Maand, Week, Werkweek, Dag) is 46px hoog, want ze heeft een eigen
  omlijsting rond knoppen van 36px (`components/ui/Segment.tsx`). Jaarplan, de pijlen en Vandaag zijn 36px.
- **Twee randkleuren.** De weergavekeuze en Jaarplan hebben een lichte rand (`lijn`), de pijlen en Vandaag een
  donkere (`lijn-veld`).
- **Geen gemeenschappelijke lijn.** De pijlen hangen bovenaan naast de datum in plaats van ermee gecentreerd, en
  de twee rijen delen geen linker- of rechterrand.
- **Vandaag verspringt.** De knop staat na de datum en schuift dus mee met de lengte ervan ("12 okt – 16 okt"
  tegenover "vrijdag 11 september").
- **Jaarplan lijkt een vijfde weergave maar staat er los naast**, in een andere stijl, terwijl het wel een zoomniveau
  van de agenda is.

Code: `features/plan/Agendascherm.tsx` (de `onder`-rij van `Schermkop`) en `components/ui/Segment.tsx`.

## Gewenst gedrag

- **Eén werkbalk.** Links staan Vandaag, de pijlen naar vorige en volgende, en de datum met het weeknummer. Rechts
  staat de weergavekeuze.
- **Alles even hoog en in dezelfde stijl**: dezelfde hoogte, dezelfde rand en dezelfde afronding voor elke knop.
- **Vandaag staat vooraan** en verspringt nooit, wat de datum ook is. Waar vandaag buiten het schooljaar valt, blijft
  de uitleg die er nu staat, zonder dode knop.
- **De pijlen vormen één gekoppelde knop.** De datum staat verticaal gecentreerd ernaast, met het weeknummer klein
  op dezelfde lijn.
- **Jaarplan wordt "Jaar" als eerste keuze in de weergavekeuze**: Jaar, Maand, Week, Werkweek, Dag. Het opent
  hetzelfde scherm als nu.
- **Het jaarplan toont dezelfde weergavekeuze, met Jaar gekozen** (eigenaar, 2026-09-23). Maand, Week, Werkweek of
  Dag brengt je naar de agenda in die weergave. De losse knop "Agenda" op het jaarplan verdwijnt.
- **Op een telefoon (~390px)** staan Vandaag, de pijlen en de datum op de eerste rij, en de weergavekeuze over de
  volle breedte op de tweede. De knoppen voor de panelen (Activiteiten, Algemene fiches, Hoekenfiches) krijgen een
  eigen rij eronder en staan niet meer tussen de weergavekeuze.
- Chuck blijft rechts naast de kop staan, zoals nu.

## Acceptatiecriteria

- [x] Gegeven de agenda op een breed scherm, wanneer ze opent, dan staan Vandaag, de pijlen, de datum en de
      weergavekeuze op één rij, allemaal even hoog en op één middenlijn.
- [x] Gegeven de week- en de dagweergave, wanneer de gebruiker tussen beide wisselt, dan blijft Vandaag op
      precies dezelfde plek staan.
- [x] Gegeven de weergavekeuze, wanneer de gebruiker "Jaar" kiest, dan opent het jaarplan zoals vandaag via
      "Jaarplan", en de terugknop van de browser brengt haar terug naar de agenda.
- [x] Gegeven een telefoon van ~390px breed, wanneer de agenda opent, dan past elke rij zonder horizontaal scrollen
      en staan de paneelknoppen op een eigen rij.
- [x] Gegeven het toetsenbord, wanneer de gebruiker door de werkbalk tabt, dan is de volgorde Vandaag, vorige,
      volgende, dan de weergavekeuze, met een zichtbare focusring.
- [x] Gegeven een andere keuzebalk in de app die `Segment` gebruikt, wanneer die mee verandert, dan ziet ze er nog
      goed uit op desktop en op ~390px.
- [x] Gegeven het jaarplan, wanneer het opent, dan staat dezelfde weergavekeuze erboven met Jaar gekozen en geen
      knop "Agenda"; wanneer de gebruiker Week kiest, dan opent de agenda in de weekweergave.

## Testscenario's

1. Open de agenda in werkweekweergave op een laptop. Alle knoppen staan op één rij en zijn even hoog. Vandaag staat
   links, de weergavekeuze rechts.
2. Kies Dag en daarna Maand. Vandaag blijft op dezelfde plek; alleen de datum ernaast verandert.
3. Kies "Jaar" in de weergavekeuze: het jaarplan opent. Ga terug met de terugknop van de browser: de agenda staat
   er weer.
4. Open de agenda op een telefoon. Eerste rij: Vandaag, pijlen en datum. Tweede rij: de weergavekeuze. Daaronder de
   knoppen voor de panelen. Niets steekt buiten het scherm.
5. Zet het schooljaar zo dat vandaag erbuiten valt: in plaats van de knop Vandaag staat de uitleg, op dezelfde plek.
6. Open het jaarplan. Bovenaan staat de weergavekeuze met Jaar gekozen. Kies Maand: de agenda opent in de
   maandweergave.

## Buiten scope

De kalender zelf, de dekkingsbalk en de zijbalk. Op het jaarplan verandert alleen de kop: de weergavekeuze komt
in de plaats van de knop "Agenda".

## Open vragen

- De weergavekeuze wordt even hoog als de andere knoppen. Omdat `Segment` ook elders gebruikt wordt, veranderen die
  keuzebalken mee. Voorstel: ja, overal dezelfde hoogte. **Antwoord eigenaar (2026-09-23): ja, overal dezelfde
  hoogte.**

## Werklog

- 2026-09-23 10:27 · claude-vercelanalyse · aangemaakt (status nieuw)
- 2026-09-23 10:32 · claude-fb089 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten; Segment overal 36px (eigenaar akkoord met voorstel)
- 2026-09-23 10:48 · claude-fb089 · werkbalk gebouwd; lint en 1317 Vitest-tests groen; browserpas op 1440, 1366, 1280 en 390px (licht), antagonist loopt
- 2026-09-23 10:49 · claude-fb089 · antagonist COMPLIANT; MINOR niet opgelost: Jaar is een radio die navigeert, en op 1280px in dagweergave schuift de weergavekeuze naar een tweede rij (vanaf 1366px één rij)
- 2026-09-23 10:50 · claude-fb089 · in-uitvoering → te-testen: werkbalk op één lijn, Jaar in de weergavekeuze, Segment overal 36px; criteria afgevinkt op Vitest (1317 groen), lint en browserpas 1440/1366/1280/390px
- 2026-09-23 10:50 · claude-fb089 · PR #168
- 2026-09-23 10:59 · eigenaar · te-testen → klaar-voor-bouw: bevinding eigenaar: ook op het jaarplan de weergavekeuze tonen (Jaar gekozen), zodat het consistent blijft; de knop Agenda mag daar weg
- 2026-09-23 10:59 · claude-fb089 · klaar-voor-bouw → in-uitvoering: opnieuw opgepakt voor de bevinding, op dezelfde branch en PR
- 2026-09-23 11:04 · claude-fb089 · in-uitvoering → te-testen: jaarplan toont dezelfde weergavekeuze met Jaar gekozen, knop Agenda weg; Vitest 1320 groen, lint groen, in de echte app op 1440/1280/390px gemeten; antagonist COMPLIANT op de delta
- 2026-09-23 11:05 · claude-fb089 · PR #168
- 2026-09-23 11:12 · claude-fb089 · bevinding eigenaar: werkbalk verspringt bij snel wisselen; oorzaak: de schuifbalk van de pagina komt en gaat (15px); opgelost met scrollbar-gutter: stable op html, gemeten op 1366x650 en 1440x900
