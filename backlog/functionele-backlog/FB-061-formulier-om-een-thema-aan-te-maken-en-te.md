---
id: FB-061
titel: Formulier om een thema aan te maken en te bewerken is rustiger en duidelijker
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-17
bijgewerkt: 2026-09-17 00:30
opgepakt-door: claude-fb061
branch: ticket/FB-061-rustiger-themaformulier
pr: 133
geblokkeerd:
fr: [FR-3.1]
---

## Aanleiding

Het formulier om een thema aan te maken of te bewerken werkt, maar oogt druk en helpt weinig. De invalshoeken passen
maar op één regel. Bij het bewerken zie je niet welk thema je bewerkt en ook niet wat je al gewijzigd hebt. Wie
Annuleren kiest, verliest zonder waarschuwing wat hij ingetypt heeft. Na het aanmaken blijf je in de lijst staan en
moet je het nieuwe thema zelf gaan zoeken.

De eigenaar bekeek een voorstel (https://claude.ai/artifact/QKJu5XtgNKfut5xT1igMeg, borden "Nieuw thema, versie 2" en
"Thema bewerken, versie 2") en stuurde het bij. De voorbeeldkaart moet weg, want die maakt het formulier te druk. De
zin "Al gebruikt in 3 klassen" is overbodig. De afronding van de app blijft zoals ze is, maar waar een afronding
niets toevoegt, valt ze weg. De woordenschat met een teller en een korte uitleg vond de eigenaar al beter.

## Gewenst gedrag

- **Rustig opgebouwd:** eerst de naam, dan de duur, dan de invalshoeken, en daaronder de woordenschat. Er staat geen
  voorbeeldkaart en geen uitleg onder de knoppen.
- **Invalshoeken** krijgen een tekstvak van een paar regels in plaats van één regel.
- **Woordenschat:** kernwoordenschat en rijke woordenschat staan op een breed scherm naast elkaar en op een telefoon
  onder elkaar. Elke lijst toont hoeveel woorden erin staan en een korte uitleg: bij kernwoordenschat "Wat elk kind
  op het einde kent.", bij rijke woordenschat "Extra woorden voor wie verder kan.".
- **Afronding:** velden en knoppen houden hun huidige afronding. Wat geen veld of knop is, krijgt geen afronding of
  alleen een kleine. Zo zijn de woordchips geen pillen meer.
- **Knoppen zeggen wat ze doen:** "Thema aanmaken" bij een nieuw thema, "Bewaren" bij het bewerken.
- **Na het aanmaken** gaat de gebruiker meteen naar de themapagina van het nieuwe thema.
- **Bewerken:**
  - De titel van het paneel noemt het thema, bijvoorbeeld "Op de boerderij bewerken".
  - Een veld dat gewijzigd is, krijgt bij zijn label het woord "gewijzigd".
  - "Bewaren" werkt pas als er iets gewijzigd is.
  - Wie het paneel sluit of Annuleren kiest terwijl er onbewaarde wijzigingen zijn, krijgt eerst de vraag om de
    wijzigingen weg te gooien of verder te bewerken.
  - Het formulier toont niet in hoeveel klassen het thema al gebruikt wordt.

## Acceptatiecriteria

- [x] Gegeven het formulier voor een nieuw thema op een breed scherm, wanneer het opent, dan staan naam, duur en
      invalshoeken onder elkaar, staan de twee woordenschatlijsten naast elkaar, elk met een teller en de korte
      uitleg, en is er geen voorbeeldkaart.
- [x] Gegeven een nieuw thema met een naam, wanneer de gebruiker "Thema aanmaken" kiest, dan opent de themapagina
      van dat nieuwe thema.
- [x] Gegeven een bestaand thema "Op de boerderij", wanneer themabeheer het formulier opent, dan heet het paneel
      "Op de boerderij bewerken" en werkt "Bewaren" nog niet.
- [x] Gegeven dat formulier, wanneer de gebruiker de duur wijzigt, dan staat "gewijzigd" bij Duur en werkt
      "Bewaren". Zet de gebruiker de oorspronkelijke duur terug, dan verdwijnen beide weer.
- [x] Gegeven onbewaarde wijzigingen, wanneer de gebruiker het paneel sluit of Annuleren kiest, dan vraagt het
      formulier eerst om weg te gooien of verder te bewerken. "Verder bewerken" laat alles staan, "Weggooien" sluit
      het paneel zonder te bewaren.
- [x] Gegeven het formulier op een telefoon van 390 pixels breed, wanneer het opent, dan staan de woordenschatlijsten
      onder elkaar, schuift de pagina niet horizontaal en zijn de woordchips geen pillen.

## Testscenario's

1. Meld aan als themabeheer en open Thema's > Nieuw thema. Je ziet naam, duur (4, 5, 6, Andere) en een tekstvak van
   een paar regels voor de invalshoeken. Daaronder staan de twee woordenschatlijsten naast elkaar, elk met een teller
   en een korte uitleg.
2. Voeg bij kernwoordenschat "koe" en "kip" toe. De teller van kernwoordenschat toont 2. De woordchips zijn geen
   pillen.
3. Vul de naam "Op de boerderij" in en kies "Thema aanmaken". Je komt op de themapagina van "Op de boerderij".
4. Kies Bewerken. Het paneel heet "Op de boerderij bewerken" en Bewaren werkt nog niet.
5. Kies een andere duur. Bij Duur staat "gewijzigd" en Bewaren werkt. Kies de oude duur terug: "gewijzigd"
   verdwijnt en Bewaren werkt weer niet.
6. Wijzig de naam en klik op het kruisje. Je krijgt de vraag om weg te gooien of verder te bewerken. Kies "Verder
   bewerken": je wijziging staat er nog. Klik op Annuleren en kies "Weggooien": het paneel sluit en de naam is
   onveranderd.
7. Herhaal stap 1 op een telefoon of in een venster van 390 pixels breed. De woordenschatlijsten staan onder elkaar
   en de pagina schuift niet opzij.

## Buiten scope

- Het emoji bij een thema (FB-060).
- Een lijst "Volgende stappen" op de themapagina na het aanmaken.
- De afronding elders in de app.

## Open vragen

Geen.

## Werklog

- 2026-09-17 00:00 · eigenaar · aangemaakt (status nieuw)
- 2026-09-17 00:01 · claude-fb061 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-17 00:08 · claude-fb061 · Formulier herbouwd, Woordchips kreeg uitleg, gewijzigd-markering en hoekige chips (ook in het woordweb, dezelfde control); vitest 1031/1031 en pnpm lint groen.
- 2026-09-17 00:10 · claude-fb061 · Correctie op de vorige regel: het woordweb gebruikt Woordchips niet, alleen dit formulier kreeg de hoekige chips. Antagonist: COMPLIANT; kleine punten opgelost (paneel blijft open tijdens bewaren, één gedeelde gewijzigd-markering).
- 2026-09-17 00:13 · claude-fb061 · in-uitvoering → te-testen: Gebouwd: rustiger themaformulier (één kolom, tekstvak voor invalshoeken, woordenlijsten naast elkaar met teller en uitleg, hoekige chips, Thema aanmaken opent de themapagina, gewijzigd-markering, Bewaren pas na een wijziging, vraag voor weggooien). Vitest en lint groen; browsercontrole op 1440 en 390 geslaagd, contrast 6,51:1 en 9,39:1 (test-report.md); antagonist COMPLIANT.
- 2026-09-17 00:30 · claude-fb061 · PR #133
