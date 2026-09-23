---
id: FB-096
titel: Leerkracht haalt een ingepland subthema weer uit de agenda
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 23:50
opgepakt-door: claude-fb096
branch: ticket/FB-096-subthema-uit-agenda
pr:
geblokkeerd:
fr: [FR-7.2, FR-6.5]
---

## Aanleiding

Een leerkracht kan een subthema wel inplannen in de agenda ("+ Subthema" in de themastrook, FB-087), maar ze krijgt het
er nooit meer uit. Plant ze het per ongeluk in het verkeerde thema, op de verkeerde dagen of in de verkeerde klas, dan
is het enige wat ze kan doen het opnieuw inplannen op andere dagen: de periode verhuist dan, maar verdwijnt niet. Een
subthema dat ze toch niet geeft, blijft dus voor de rest van het schooljaar op de agenda staan, telt mee in de dekking
van haar klas, en de agenda zegt iets wat niet klopt.

Alle andere dingen die ze in de agenda plaatst, kan ze er wel weer uit halen: een thema via de plaatsingkaart op de
jaarplan-tijdlijn, een activiteit en een algemene fiche vanuit hun blad in de agenda. Het subthema is de enige
uitzondering.

## Gewenst gedrag

Een leerkracht die de planning van de klas mag wijzigen, kan een ingepland subthema weer uit de agenda halen. De actie
staat in de agenda bij de subthemastrook zelf, op dezelfde plaats waar ze het subthema ziet lopen, en is rustig
vormgegeven zoals de andere kleine acties in de agenda: geen volle accentkleur.

Ze krijgt eerst een bevestiging te zien, want de actie is niet terug te draaien. Die bevestiging zegt in gewone taal:

- om welk subthema het gaat en over welke dagen het loopt;
- hoeveel activiteiten van dat subthema op die dagen gepland staan en dus mee verdwijnen;
- dat de doelen van dat subthema daardoor niet langer meetellen voor de dekking van deze klas.

Bevestigt ze, dan verdwijnen de periode en de activiteitplaatsingen van dat subthema op die dagen samen. De agenda en
het dekkingsoverzicht tonen dat meteen. Staan er geen activiteiten op, dan zegt de bevestiging dat ook, in plaats van
"0 activiteiten".

Activiteiten die op die dagen staan maar **niet** bij dit subthema horen (een algemene fiche, een eigen activiteit uit
een ander subthema, een terugkerende fiche) blijven staan: die horen niet bij het subthema dat weggaat.

Wie de klas alleen mag inkijken, ziet de actie niet en kan ze ook niet langs de achterdeur uitvoeren.

## Acceptatiecriteria

- [ ] Gegeven een leerkracht die de planning van de klas mag wijzigen, wanneer ze de agenda opent op een dag waar een
      subthema loopt, dan vindt ze bij de subthemastrook een actie om dat subthema uit de agenda te halen, zonder volle
      accentkleur, met het toetsenbord bereikbaar, met een zichtbare focusrand en een voorleesbare naam.
- [ ] Gegeven die actie, wanneer ze erop klikt, dan verschijnt een bevestiging die het subthema en zijn dagen noemt,
      zegt hoeveel activiteiten van dat subthema mee verdwijnen, en zegt dat de doelen van dat subthema niet langer
      meetellen voor de dekking.
- [ ] Gegeven de bevestiging, wanneer ze annuleert, dan verandert er niets aan de agenda.
- [ ] Gegeven de bevestiging, wanneer ze bevestigt, dan is de subthemaperiode weg uit de agenda, zijn de activiteiten
      van dat subthema op die dagen weg, en staan de activiteiten die niet bij dat subthema horen er nog.
- [ ] Gegeven een subthema waarvan de doelen enkel via die periode meetelden, wanneer ze het weghaalt, dan toont het
      dekkingsoverzicht van die klas die doelen niet langer als gedekt.
- [ ] Gegeven een subthemaperiode zonder geplande activiteiten, wanneer ze de actie kiest, dan zegt de bevestiging dat
      er geen activiteiten mee verdwijnen.
- [ ] Gegeven een gebruiker die de klas alleen mag inkijken, wanneer ze de agenda opent op een dag met een subthema,
      dan ziet ze de actie niet, en weigert de server het weghalen ook wanneer de oproep rechtstreeks gebeurt.
- [ ] Gegeven een scherm van ongeveer 390 pixels breed, wanneer ze de agenda opent op een dag met een subthema, dan is
      de actie zichtbaar en bruikbaar, en blijft de naam van het subthema leesbaar.

## Testscenario's

1. Meld je aan als leerkracht met planningsrecht op een klas. Open de agenda in Werkweek, in een week waar een subthema
   loopt en waar minstens twee activiteiten van dat subthema gepland staan. Plan op diezelfde dagen ook een algemene
   fiche in.
2. Zoek bij de subthemastrook de actie om het subthema weg te halen. Ze staat er rustig bij, niet in volle accentkleur.
3. Klik erop. Er verschijnt een bevestiging met de naam van het subthema, de dagen waarover het loopt, het aantal
   activiteiten dat mee verdwijnt, en de zin over de dekking.
4. Kies Annuleren. Het subthema, de activiteiten en de fiche staan er nog, precies zoals voordien.
5. Klik opnieuw en bevestig. De subthemastrook is weg, de twee activiteiten van het subthema zijn weg, de algemene
   fiche staat er nog.
6. Open het dekkingsoverzicht van deze klas. De doelen die enkel via dat subthema meetelden, staan niet meer als gedekt.
7. Herlaad de agenda. Het subthema is nog altijd weg.
8. Plan een subthema in op dagen waar nog geen enkele activiteit staat, en haal het weer weg. De bevestiging zegt dat
   er geen activiteiten mee verdwijnen.
9. Meld je aan als een gebruiker die de klas alleen mag inkijken. Open dezelfde agenda. De actie is er niet.
10. Maak het venster ongeveer 390 pixels breed en herhaal stap 2 en 3. De actie is zichtbaar en bruikbaar, en de naam
    van het subthema blijft leesbaar.
11. Druk op Tab tot de actie de focus krijgt. Je ziet een focusrand, en Enter opent de bevestiging.

## Buiten scope

- De jaarplan-tijdlijn: die toont vandaag geen subthema's. Dat is FB-097.
- Het inplannen en verplaatsen van een subthema: dat blijft zoals het vandaag werkt.
- Het weghalen van een los activiteitblok of van een algemene fiche: dat kan al.
- Het verwijderen van het subthema zelf uit het themabeheer: dat is iets anders dan het uit de agenda van één klas
  halen, en blijft waar het staat.

## Open vragen

Geen.

## Werklog

- 2026-09-23 22:07 · Siebeds · aangemaakt (status nieuw)
- 2026-09-23 23:41 · claude-fb096 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-23 23:50 · claude-fb096 · backend: GET .../subthemaperiodes/weghaling telt wat meegaat, DELETE haalt periode, activiteiten van dat subthema en hoekverrijkingen samen weg; unit- en Postgres-tests groen
