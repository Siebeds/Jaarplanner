---
id: TB-038
titel: Activiteitenlijst onder een subthema gebruikt op de telefoon de volle breedte
soort: technisch
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-22 00:52
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Bij de browsercontrole van FB-046 (2026-09-16) bleek dat de lijst met activiteiten onder een opengeklapt subthema op
390px maar ongeveer 190px breed is (van x=47 tot x=235), met een lege strook rechts. Namen van activiteiten worden
daardoor onnodig afgebroken. Dat was al zo vóór FB-046.

## Voorgestelde wijziging

Zoek in `frontend/src/features/themas/Subthemahoofdstuk.tsx` (de regel van een activiteit en de lijst eromheen) welke
kolomindeling of breedte op smalle schermen ruimte laat liggen, en laat de lijst onder `sm` de volle breedte van het
hoofdstuk gebruiken. Desktop blijft zoals het is.

## Acceptatiecriteria

- [ ] Gegeven een opengeklapt subthema met activiteiten op ~390px, dan loopt de lijst over de volle breedte van het
  hoofdstuk, zonder lege strook rechts en zonder horizontaal scrollen.
- [ ] Gegeven dezelfde pagina op desktop, dan ziet de lijst er uit zoals nu.
- [ ] De soort, het aantal doelen en de koppelknop (FB-046) blijven zichtbaar op ~390px.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Buiten scope

De inhoud van een activiteitregel (FB-046).

## Open vragen

Geen.

## Werklog

- 2026-09-16 15:58 · claude-fb-reeks · aangemaakt (status nieuw)
- 2026-09-21 23:50 · claude-tb038-controle · Nagekeken in Chrome op 390px en 1440px (main 228cee29, dev-database jaarplanner): de activiteitenlijst onder een opengeklapt subthema loopt nu van x=46 tot x=344 op een 390px-scherm, volle breedte van het hoofdstuk, gelijke marge links en rechts, geen horizontaal scrollen. De aanleiding is vervallen: TB-044/TB-051 hebben het hoofdstuk herbouwd rond Inklaplijst en de activiteitregel kreeg basis-full onder sm, waardoor de naam de hele regel krijgt. Het derde acceptatiecriterium klopt ook niet meer: de koppelknop van FB-046 is in TB-044 uit de rij gehaald. Voorstel: afvoeren.
- 2026-09-22 00:52 · claude-tb038-controle · Main is intussen c2eca075 (TB-037, TB-039). Die raken het subthemahoofdstuk niet: alleen themabalans.ts, DoelenScherm, Bestemmingsblad, nl.json en een regel in index.css die de eigen wisknop van de browser in zoekvelden verbergt. De meting hierboven blijft dus gelden.
