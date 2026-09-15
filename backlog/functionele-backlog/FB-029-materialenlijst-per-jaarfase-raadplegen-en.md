---
id: FB-029
titel: Materialenlijst per jaarfase raadplegen en materiaal koppelen aan een activiteit
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:10
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-3.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"materialenlijst raadplegen en eventueel toevoegen aan een activiteit? of op basis van
materialen activiteiten voorstellen?"*. Over de bron zei hij: *"komt eigenlijk van op stap, is per jaarfase"*, maar hij
is niet zeker waar ze precies staat.

De tool kent vandaag geen materialen. Uit Op.stap laadt ze alleen de doelen in (ADR-0032).

## Gewenst gedrag

- Een leerkracht raadpleegt de materialenlijst van de jaarfase van haar klas, en zoekt erin.
- Ze koppelt een of meer materialen aan een activiteit. Een activiteit toont haar materialen.
- De lijst komt van Op.stap en is, zoals de doelen, alleen-lezen: de school wijzigt de officiële lijst niet (Art. III).

## Acceptatiecriteria

- [ ] Gegeven een ingeladen materialenlijst, wanneer een K3-leerkracht ze opent, dan ziet ze de materialen van K3, en ze
  kan erin zoeken.
- [ ] Gegeven een activiteit, wanneer de leerkracht er twee materialen aan koppelt en bewaart, dan toont de activiteit die
  materialen, ook na herladen.
- [ ] Gegeven de materialenlijst, dan kan niemand de officiële inhoud ervan wijzigen.
- [ ] Gegeven een leerkracht die de activiteit niet mag bewerken, dan kan ze er geen materialen aan koppelen.

## Testscenario's

1. Open de materialenlijst als leerkracht van een K3-klas. Je ziet de K3-materialen. Zoek op een woord.
2. Open een activiteit, koppel twee materialen en bewaar. Herlaad: ze staan erbij.
3. Probeer een materiaal uit de lijst te wijzigen. Dat kan niet.

## Buiten scope

- Activiteiten voorstellen op basis van materialen: FB-030.
- Een voorraadbeheer (hoeveel de school ervan heeft).

## Open vragen

- **Bron:** waar staat de materialenlijst van Op.stap? In de API die de doelen levert, of in een document van KOV? Dat moet
  eerst uitgezocht worden. Zit ze in de API, dan wordt de Op.stap-import uitgebreid (één plaats voor de mapping, Art.
  VII.2); anders is een andere weg nodig. Tot dan kan dit ticket niet gebouwd worden.
- Mag de school eigen materialen toevoegen naast die van Op.stap?
- Gelden voor het koppelen dezelfde rechten als voor de inhoud van de activiteit (gedeelde: elke leerkracht van die
  leeftijd; eigen: de eigenaar)? **Standaard** ja.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
