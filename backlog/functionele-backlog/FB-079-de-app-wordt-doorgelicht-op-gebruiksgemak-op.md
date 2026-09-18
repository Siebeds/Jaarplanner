---
id: FB-079
titel: De app wordt doorgelicht op gebruiksgemak, op desktop en op gsm
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:47
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar vindt de app op verschillende plaatsen niet gebruiksvriendelijk genoeg, maar "betere UI/UX" is geen wijziging
die een tester kan afvinken. Eerst moet vastgelegd worden wat er concreet beter moet.

## Gewenst gedrag

- Een sessie loopt de hele app door zoals een leerkracht, een hoofdleerkracht, themabeheer en de admin dat doen, op
  desktop en op een breedte van ongeveer 390px.
- Elk concreet probleem (iets onduidelijks, een verborgen knop, te veel tekst, een stap te veel, een contrast dat niet
  haalt) wordt een **eigen ticket**, met een schermafbeelding in de worklog.
- De doorlichting zelf verandert niets aan de app.
- Het resultaat is een korte lijst met de nieuwe tickets, gerangschikt naar hoe vaak een leerkracht ertegen aanloopt.

## Acceptatiecriteria

- [ ] Gegeven de doorlichting, dan zijn de agenda, het jaarplan, de doelenpagina, het dekkingsoverzicht, de thema's, de instellingen en het ontwikkelingsrapport bekeken, elk op desktop en op ongeveer 390px.
- [ ] Gegeven elk gevonden probleem, dan bestaat er een ticket met titel, aanleiding en acceptatiecriteria.
- [ ] Gegeven de lijst met nieuwe tickets, dan staat bij elk welk scherm en welke rol het raakt.
- [ ] Gegeven de doorlichting, dan is er geen bestand buiten de backlog gewijzigd.

## Testscenario's

1. Open de worklog van dit ticket: per scherm staat wat bekeken werd, op welke breedte en met welke rol.
2. Open de lijst met nieuwe tickets: elk ticket bestaat op het board, met een schermafbeelding in de worklog.
3. Kies drie tickets en open het scherm dat ze noemen: het probleem is er te zien.

## Buiten scope

- De gevonden problemen oplossen: dat gebeurt in de tickets die de doorlichting oplevert.
- De huisstijl van ADR-0024 ("Inkt en Signaal") herzien.

## Open vragen

Geen.

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
