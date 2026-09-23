---
id: FB-095
titel: Themapagina-kop: Chuck staat rechtsboven zonder de knoppen te bedekken, en de kop ademt
soort: functioneel
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 20:38
opgepakt-door: claude-fb095
branch: ticket/FB-095-themakop-chuck
pr:
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

- [ ] Gegeven een gebruiker met recht om het thema te bewerken, wanneer ze de themapagina opent op een breed scherm (1440px en breder), dan liggen "Bewerken" en het "…"-menu volledig vrij van Chuck en reageren ze op een klik over hun hele oppervlak.
- [ ] Gegeven de themapagina op een breed scherm, wanneer ze naar de kop kijkt, dan staat Chuck rechtsboven op dezelfde plek als op de andere schermen, niet in het midden van het scherm.
- [ ] Gegeven de themapagina op een telefoon (~390px), wanneer ze de kop bekijkt, dan bedekt Chuck ook daar geen knop en blijft de titel leesbaar.
- [ ] Gegeven de themapagina, wanneer ze de kop bekijkt, dan is er zichtbare ruimte tussen het kruimelpad en de titel, en tussen de titel en de rij met de vier cijfers.
- [ ] Gegeven de andere schermen met Chuck (agenda, dekking, doelen, thema's), wanneer ze die opent, dan staat Chuck daar nog zoals vandaag.

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
