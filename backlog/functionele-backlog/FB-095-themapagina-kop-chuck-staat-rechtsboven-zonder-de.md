---
id: FB-095
titel: Themapagina-kop: Chuck staat rechtsboven zonder de knoppen te bedekken, en de kop ademt
soort: functioneel
status: te-testen
prioriteit: hoog
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 23:41
opgepakt-door: claude-fb095
branch: ticket/FB-095-themakop-chuck
pr: 178
geblokkeerd:
fr: []
---

## Aanleiding

Sinds de nieuwe opbouw van de themapagina (FB-094) staan "Bewerken" en het "…"-menu van het thema in de kop, vlak
links van Chuck. Twee dingen gaan daar mis:

- **Chuck bedekt de knoppen.** De themapagina gebruikt de smalle kolom, dus Chuck ligt aan de rechterrand van die
  kolom en niet rechtsboven in het scherm; op een breed scherm staat hij daardoor eerder in het midden. Zijn tekening
  is breder dan zijn knop en steekt naar links uit, over "Bewerken" en het "…"-menu heen, zodat die moeilijk of niet
  aan te klikken zijn.
- **De kop staat te dicht opeen.** Het kruimelpad ("Thema's / De herfst"), de titel en de rij met de vier cijfers
  (weken, minimumdoelen, leerplandoelen, subthema's) plakken tegen elkaar, zonder de ruimte die de rest van de pagina
  wel heeft.

## Gewenst gedrag

Op de themapagina ligt Chuck rechtsboven, zoals op de andere schermen, en nooit over een knop. "Bewerken" en het
"…"-menu van het thema zijn altijd volledig zichtbaar en klikbaar. Het kruimelpad, de titel en de cijferrij zijn
duidelijk van elkaar gescheiden, zodat de kop rustig leest.

## Acceptatiecriteria

- [x] Gegeven een gebruiker met recht om het thema te bewerken, wanneer ze de themapagina opent op een breed scherm (1440px en breder), dan liggen "Bewerken" en het "…"-menu volledig vrij van Chuck en reageren ze op een klik over hun hele oppervlak.
- [x] Gegeven de themapagina op een breed scherm, wanneer ze naar de kop kijkt, dan staat Chuck rechtsboven op dezelfde plek als op de andere schermen, niet in het midden van het scherm.
- [x] Gegeven de themapagina op een telefoon (~390px), wanneer ze de kop bekijkt, dan bedekt Chuck ook daar geen knop en blijft de titel leesbaar.
- [x] Gegeven de themapagina, wanneer ze de kop bekijkt, dan is er zichtbare ruimte tussen het kruimelpad en de titel, en tussen de titel en de rij met de vier cijfers.
- [x] Gegeven de andere schermen met Chuck (agenda, dekking, doelen, thema's), wanneer ze die opent, dan staat Chuck daar nog zoals vandaag.

## Testscenario's

1. Meld aan als admin en open op een breed scherm een thema, bv. "De herfst". Verwacht: Chuck ligt rechtsboven; "Bewerken" en "…" staan er los naast.
2. Klik op "Bewerken", ook aan de rechterrand van de knop. Verwacht: het bewerkformulier opent.
3. Klik op "…". Verwacht: het menu opent.
4. Bekijk de kop. Verwacht: kruimelpad, titel en cijferrij staan elk met wat ruimte ertussen, niet op elkaar geplakt.
5. Verklein het venster tot ~390px en herhaal 1 tot 4 (op een telefoon staat "Bewerken" onder de gegevens van het thema). Verwacht: geen knop onder Chuck.
6. Open de agenda en het dekkingsoverzicht. Verwacht: Chuck staat daar zoals voorheen.

## Buiten scope

Chuck zelf (zijn tekening, ballonnen en venster) en de verdere opbouw van de themapagina uit FB-094.

## Open vragen

Geen.

## Werklog

- 2026-09-23 20:36 · Siebeds · aangemaakt (status nieuw)
- 2026-09-23 20:38 · claude-fb095 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-23 20:45 · claude-fb095 · Kop ruimer: kruimelpad 12px boven de titel, cijferrij 12px verder; Chuck over de knoppen niet na te bootsen op nepdata (1024-1440px, met en zonder ballon), schermafbeelding gevraagd
- 2026-09-23 23:34 · claude-fb095 · Chuck op de smalle themapagina op de brede maat gezet, titel en rijen ingesprongen tot de smalle kolom; gemeten op 1920/1280/1024/390px: Chucks rechterrand gelijk aan de themalijst, titel gelijk met de inhoud; lint en 279 tests groen
- 2026-09-23 23:35 · claude-fb095 · Antagonist: COMPLIANT; MINOR over de hand geschreven breedtes met een commentaar verholpen, kruimelpad wordt alleen op de themapagina gebruikt
- 2026-09-23 23:35 · claude-fb095 · in-uitvoering → te-testen: Chuck staat op de themapagina op de plek van de andere schermen, kop ruimer; lint, 279 tests en browsercontrole groen
- 2026-09-23 23:35 · claude-fb095 · PR #178
- 2026-09-23 23:41 · claude-fb095 · Op vraag van de eigenaar: knoppen eindigen op de rand van de witte blokken waar de marge Chuck houdt (vanaf 72rem kopbreedte), de ballon mag erboven uitsteken; gemeten op 1920 en 1440px op dezelfde pixel; lint en 279 tests groen
