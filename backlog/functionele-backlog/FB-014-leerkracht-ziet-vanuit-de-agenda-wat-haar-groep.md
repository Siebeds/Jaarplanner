---
id: FB-014
titel: Leerkracht ziet vanuit de agenda wat haar groep vorige jaren bij het thema deed
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:09
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-10.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"een leerkracht moet een thema kunnen bekijken vanuit de agenda om te zien wat de
kleuters vorige jaren hebben geleerd over dat thema"*.

**Beslissing van de eigenaar, 2026-09-15:** de leerkracht ziet de **effectieve agenda** van **alle vorige jaren van haar
groep** bij dat thema: voor een K3-klas wat de K2-klassen vorig schooljaar deden en wat de JK-klassen twee schooljaren
geleden deden. De agenda van dit schooljaar van een andere jaarfase blijft dicht (FB-013).

## Gewenst gedrag

- Vanuit een thema of subthema in de agenda opent de leerkracht "Wat deed deze groep vroeger met dit thema?".
- Per vorig schooljaar ziet ze de klassen van de jaarfase die haar groep toen was (K3 nu: K2 vorig schooljaar, JK het
  schooljaar daarvoor), met per klas de subthema's en activiteiten van dit thema zoals ze in hun agenda gepland stonden
  (wanneer), en de doelen die eraan gekoppeld zijn.
- Stond het thema toen niet gepland, dan zegt het scherm dat.
- Alles is alleen-lezen.
- De tool volgt geen kinderen (Art. I.2): ze kijkt naar alle klassen van die jaarfase in dat schooljaar, niet naar welk
  kind in welke klas zat.

## Acceptatiecriteria

- [ ] Gegeven een K3-klas in 2026-2027 en een thema dat in 2025-2026 in de agenda van een K2-klas stond, wanneer de
  leerkracht vanuit dat thema in haar agenda de vorige jaren opent, dan ziet ze die K2-klas met de geplande activiteiten,
  hun data en hun doelen.
- [ ] Gegeven hetzelfde thema in de agenda van een JK-klas in 2024-2025, dan staat ook die klas erbij, onder dat
  schooljaar.
- [ ] Gegeven een vorig schooljaar waarin het thema nergens gepland stond, dan zegt het scherm dat voor dat schooljaar.
- [ ] Gegeven dezelfde leerkracht, wanneer ze de agenda van een K2-klas van **dit** schooljaar wil openen, dan blijft
  dat geweigerd (FB-013).
- [ ] Het scherm toont geen namen van kinderen en geen andere gegevens over kinderen.

## Testscenario's

1. Zorg voor een thema dat vorig schooljaar in een K2-klas gepland stond en twee schooljaren geleden in een JK-klas.
2. Meld aan als leerkracht van een K3-klas van dit schooljaar en open de agenda in een week waarin dat thema loopt.
3. Open bij het thema "vorige jaren". Je ziet twee schooljaren: K2 met zijn activiteiten en data, JK met de zijne.
4. Open een thema dat vroeger nooit gepland werd. Het scherm zegt dat.
5. Probeer via de klaskiezer een K2-klas van dit schooljaar te openen. Die staat er niet.
6. Herhaal stap 3 op ~390px.

## Buiten scope

- Een geschiedenis van gewijzigde inhoud: werd een activiteit later aangepast, dan toont de tool ze zoals ze nu is.
- Kinderen volgen van klas naar klas (Art. I.2).
- De agenda van dit schooljaar van een andere jaarfase (FB-013).

## Open vragen

- Werkt dit ook in de lagere school (L1 ziet K3 van vorig jaar, en zo verder)? **Standaard** ja, volgens de volgorde van
  de jaarfasen.
- Een activiteit die sindsdien verwijderd werd, staat niet meer in die agenda. Is dat aanvaardbaar?

## Werklog

- 2026-09-15 14:09 · wensen-tickets · aangemaakt (status nieuw)
