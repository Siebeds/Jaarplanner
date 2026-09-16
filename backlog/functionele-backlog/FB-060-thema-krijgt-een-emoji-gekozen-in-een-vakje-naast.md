---
id: FB-060
titel: Thema krijgt een emoji, gekozen in een vakje naast de naam
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-17
bijgewerkt: 2026-09-17 00:26
opgepakt-door: claude-fb060
branch: ticket/FB-060-thema-emoji
pr:
geblokkeerd:
fr: [FR-3.1]
---

## Aanleiding

Thema's zijn in de bibliotheek en in het jaarplan alleen aan hun naam te herkennen. De eigenaar wil bij elk thema een
emoji kunnen kiezen, zodat een thema in één oogopslag te vinden is. Uit drie voorstellen koos de eigenaar voorstel A,
een vakje vóór de naam met een raster eronder: https://claude.ai/artifact/QKJu5XtgNKfut5xT1igMeg (bord "A · Gekozen").

## Gewenst gedrag

- In het formulier om een thema aan te maken of te bewerken staat links in de naamregel een vierkant vakje, even hoog
  als het naamveld. Zonder emoji toont het een gestippeld smiley-icoon, met emoji toont het dat emoji.
- Een klik op het vakje opent eronder een raster met een kleine vaste selectie emoji die bij schoolthema's passen, in
  groepen (seizoenen en weer, natuur, dieren, feesten, mensen en wereld, spelen en leren), met bovenaan een zoekveld.
  Een klik op een emoji kiest het en sluit het raster. Escape sluit het raster zonder iets te wijzigen.
- Onderaan het raster staat "Geen emoji": het emoji is niet verplicht en kan zo weer weg.
- Wie in het zoekveld zelf een emoji invoert, bijvoorbeeld met de emojikiezer van Windows (Windows-toets + puntkomma),
  kiest daarmee dat emoji. Dat staat nergens uitgelegd, maar het wordt aanvaard, ook voor een emoji dat niet in het
  raster staat.
- Het emoji staat vóór de naam van het thema op de kaart in de themabibliotheek, in de kop van de themapagina en in
  de themablokken van het jaarplan. Het staat altijd naast de naam, nooit in de plaats ervan. Een thema zonder emoji
  ziet eruit zoals nu.
- Alleen wie een thema mag bewerken, kan het emoji kiezen. Tekst in plaats van een emoji wordt geweigerd.

## Acceptatiecriteria

- [x] Gegeven een nieuw thema, wanneer themabeheer op het vakje klikt en 🍂 kiest en bewaart, dan staat 🍂 vóór de
      naam in de bibliotheek en op de themapagina.
- [x] Gegeven een thema met een emoji, wanneer themabeheer het bewerkt en "Geen emoji" kiest en bewaart, dan staat er
      nergens nog een emoji bij dat thema en ziet de kaart eruit zoals een thema zonder emoji.
- [x] Gegeven het geopende raster, wanneer de gebruiker met de emojikiezer van Windows een emoji in het zoekveld zet
      dat niet in het raster staat (bijvoorbeeld 🦖), dan toont het vakje dat emoji en blijft het na bewaren staan.
- [x] Gegeven het geopende raster, wanneer de gebruiker "herfst" typt, dan blijven alleen de emoji over die daarbij
      horen, en bij een zoekterm zonder resultaat staat er dat er geen emoji gevonden is.
- [x] Gegeven een poging om gewone tekst of twee emoji als emoji van een thema te bewaren, wanneer de server die
      ontvangt, dan weigert die het met een zin die een leerkracht begrijpt.
- [x] Gegeven het vakje en het raster, wanneer ze met het toetsenbord en een schermlezer gebruikt worden, dan is elk
      emoji bereikbaar, heeft elk een Nederlandse naam en zegt het vakje of er al een emoji gekozen is.

## Testscenario's

1. Meld aan als themabeheer en open Thema's > Nieuw thema. Je ziet links van het naamveld een gestippeld vakje.
2. Klik op het vakje. Onder het vakje opent een raster met groepen emoji en een zoekveld, en de cursor staat in het
   zoekveld.
3. Typ "dier". Je ziet alleen nog dieren. Typ "xyz". Je ziet dat er geen emoji gevonden is.
4. Wis de zoekterm en klik op 🐮. Het raster sluit en het vakje toont 🐮.
5. Vul de naam "Op de boerderij" in en maak het thema aan. In de bibliotheek en op de themapagina staat 🐮 vóór de
   naam.
6. Bewerk het thema, open het raster en druk op Windows-toets + puntkomma. Kies 🦖 in de kiezer van Windows. Het
   vakje toont 🦖. Bewaar: de bibliotheek toont 🦖.
7. Bewerk het thema opnieuw, open het raster en kies "Geen emoji". Bewaar: het thema staat zonder emoji in de
   bibliotheek.
8. Plaats het thema in het jaarplan van een klas. Het themablok toont het emoji vóór de naam.

## Buiten scope

- Een emoji voor subthema's, activiteiten of fiches.
- Een emoji voorstellen op basis van de naam (voorstel B in het canvas), met of zonder AI.
- Het emoji meenemen in de Excel-import van thema's.

## Open vragen

Geen.

## Werklog

- 2026-09-17 00:00 · eigenaar · aangemaakt (status nieuw)
- 2026-09-17 00:02 · claude-fb060 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-17 00:16 · claude-fb060 · Gebouwd: veld Icoon op Thema (migratie ThemaIcoon), emojikiezer voor de naam, emoji in bibliotheek, themapagina, plaatsingskaart en themaband. Gates: dotnet test 1972+561 groen, dotnet format schoon, pnpm lint en pnpm test (1035) groen.
- 2026-09-17 00:21 · claude-fb060 · Browsercontrole (headless Chrome, wegwerpdatabase jp_fb060_browser, 1440 en 390 breed): kiezen, zoeken, getypt emoji, Escape, Geen emoji en bewaren werken; het emoji staat op de kaart, de themapagina, de themaband en de periodekaart; tekst wordt geweigerd met 400 en de zin. Criteria afgevinkt op basis van deze controle, de Vitest-tests en de integratietests.
- 2026-09-17 00:26 · claude-fb060 · in-uitvoering → te-testen: Gebouwd: optioneel emoji op een thema (veld, migratie ThemaIcoon, controle op de server), emoji-kiezer vóór de naam met zoekveld dat ook een getypt emoji aanvaardt, emoji vóór de naam in bibliotheek, themapagina en agenda. Tests, format en lint groen; browsercontrole op 1440 en 390 geslaagd; antagonist COMPLIANT, kleine punten opgelost (losse pijlen en vormpjes geweigerd, Escape-test).
