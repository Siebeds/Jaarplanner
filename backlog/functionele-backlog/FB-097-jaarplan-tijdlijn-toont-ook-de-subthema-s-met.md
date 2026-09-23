---
id: FB-097
titel: Jaarplan-tijdlijn toont ook de subthema's, met dezelfde acties als in de agenda
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-23 22:08
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-6.3, FR-7.2]
---

## Aanleiding

De jaarplan-tijdlijn toont het schooljaar in één baan met de thema's: één blik en je ziet welke thema's wanneer lopen,
waar de gaten zitten, en je kan een thema verslepen of weghalen. De subthema's staan er niet op. Wie wil zien hoe de
subthema's over het jaar verdeeld zijn, moet week na week door de agenda bladeren.

Daardoor mist de leerkracht juist wat de tijdlijn goed doet: het overzicht. Ze ziet niet in één blik dat een thema van
vijf weken maar één subthema heeft, dat er twee subthema's op elkaar geplakt staan, of dat ze er één vergeten is. En
wat ze in de agenda met een subthema kan doen, moet ze ook in de agenda gaan doen.

## Gewenst gedrag

De jaarplan-tijdlijn krijgt onder de baan met de thema's een tweede baan met de subthema's van deze klas. Elk subthema
staat op de lesweken en dagen waarop het loopt, uitgelijnd onder het thema waarin het valt, en draagt zijn naam. Een
subthema dat over een vakantie heen loopt, wordt getoond zoals een thema dat doet.

De tweede baan is rustig: ze mag de thema's niet overstemmen. Ze draagt geen eigen volle kleur, en een subthema is ook
zonder kleur herkenbaar aan zijn naam en zijn plaats onder het thema. Loopt er in een week geen subthema, dan is die
plek in de tweede baan gewoon leeg, zoals een lesweek zonder thema dat vandaag al is.

Klikt de leerkracht op een subthema in de tijdlijn, dan opent een kaart naast de tijdlijn, zoals bij een thema. Die
kaart toont de naam van het subthema, het thema waarin het valt, de dagen waarover het loopt, en het aantal
activiteiten dat erop gepland staat. Vanuit die kaart kan ze:

- naar de agenda springen op de eerste dag van het subthema;
- het subthema uit de agenda halen, met dezelfde bevestiging en hetzelfde gevolg als in FB-096.

Wie de planning van de klas alleen mag inkijken, ziet de tweede baan en de kaart, maar krijgt geen actie om iets weg te
halen.

De tijdlijn blijft bruikbaar op een smal scherm: de tweede baan mag daar smaller zijn, maar een subthema blijft
aanwijsbaar en zijn naam blijft opvraagbaar.

## Acceptatiecriteria

- [ ] Gegeven een klas met een thema waarin twee subthema's na elkaar ingepland staan, wanneer de leerkracht de
      jaarplan-tijdlijn opent, dan staan die twee subthema's in een tweede baan onder het thema, elk op zijn eigen
      lesweken en dagen, elk met zijn naam.
- [ ] Gegeven een lesweek waarin wel een thema maar geen subthema loopt, wanneer ze de tijdlijn opent, dan is de tweede
      baan daar leeg en toont ze niets over een subthema.
- [ ] Gegeven een subthema in de tijdlijn, wanneer ze erop klikt, dan opent een kaart met de naam van het subthema, het
      thema waarin het valt, de dagen waarover het loopt en het aantal geplande activiteiten.
- [ ] Gegeven die kaart bij een leerkracht die de planning mag wijzigen, wanneer ze kiest om het subthema uit de agenda
      te halen en bevestigt, dan verdwijnen de periode en de activiteiten van dat subthema, en verdwijnt het subthema
      uit de tweede baan.
- [ ] Gegeven een gebruiker die de klas alleen mag inkijken, wanneer ze een subthema in de tijdlijn opent, dan toont de
      kaart geen actie om het weg te halen.
- [ ] Gegeven de tijdlijn, dan is elk subthema met het toetsenbord bereikbaar, heeft het een zichtbare focusrand en een
      voorleesbare naam, en draagt het geen volle accentkleur.
- [ ] Gegeven een scherm van ongeveer 390 pixels breed, wanneer ze de tijdlijn opent, dan is de tweede baan zichtbaar,
      is een subthema aan te wijzen en is zijn naam op te vragen.

## Testscenario's

1. Meld je aan als leerkracht met planningsrecht op een klas. Zorg dat er een thema van enkele weken loopt met daarin
   twee subthema's na elkaar, en dat er op het tweede subthema activiteiten gepland staan.
2. Open het jaarplan. Onder de baan met de thema's staat een tweede baan: de twee subthema's staan er onder hun thema,
   elk over zijn eigen dagen, elk met zijn naam.
3. Kijk naar een lesweek van het thema waarin geen subthema loopt. De tweede baan is daar leeg.
4. Klik op het tweede subthema. De kaart toont de naam, het thema, de dagen en het aantal geplande activiteiten.
5. Klik op "Open in agenda". De agenda opent op de eerste dag van dat subthema.
6. Ga terug naar het jaarplan, open hetzelfde subthema, en kies om het uit de agenda te halen. De bevestiging is
   dezelfde als in de agenda. Bevestig.
7. Het subthema is weg uit de tweede baan, en zijn activiteiten zijn weg uit de agenda. Het thema staat er nog.
8. Meld je aan als een gebruiker die de klas alleen mag inkijken. Open het jaarplan en klik op een subthema. De kaart
   toont geen actie om het weg te halen.
9. Druk op Tab tot een subthema in de tijdlijn de focus krijgt. Je ziet een focusrand, en Enter opent de kaart.
10. Maak het venster ongeveer 390 pixels breed. De tweede baan is zichtbaar, een subthema is aan te wijzen en zijn naam
    is op te vragen.

## Buiten scope

- Een subthema verslepen op de tijdlijn. Verplaatsen blijft voorlopig het opnieuw inplannen vanuit de agenda.
- Een subthema aanmaken of inplannen vanuit de tijdlijn.
- Wat de kaart van een thema toont en kan: die blijft zoals ze is.
- De maand-, week-, werkweek- en dagweergave van de agenda: die veranderen hier niet.

## Open vragen

- Hangt af van FB-096: het weghalen en zijn bevestiging worden daar gebouwd en hier alleen hergebruikt. FB-096 gaat
  dus eerst.

## Werklog

- 2026-09-23 22:08 · Siebeds · aangemaakt (status nieuw)
