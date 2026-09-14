---
id: FB-007
titel: Directie ziet welke schooljaren nog gegevens over kinderen bevatten, en wist er een
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 14:39
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-13.8]
---

## Aanleiding

De gegevens over kinderen blijven in de tool tot de directie een schooljaar wist (R19). De tool wist niets vanzelf. De
directie legt een concrete bewaartermijn vast in het verwerkingsregister, en de tool toont welke schooljaren nog
gegevens over kinderen bevatten en herinnert de directie eraan (R28). Zonder dat overzicht blijven die gegevens
onopgemerkt staan.

Dit is bouwticket 7 van ADR-0035 §6. **Bouwvolgorde:** na E6-02 en FB-001 (de kinderen). Het wissen raakt ook de
rapporten en tekeningen van FB-003 en FB-005, zodra die er zijn.

## Gewenst gedrag

- Op de beheerpagina van de directie staat een **overzicht van de schooljaren die nog gegevens over kinderen bevatten**,
  met per schooljaar het aantal kinderen.
- Zolang er zo'n schooljaar is, **herinnert** de pagina de directie eraan dat die gegevens gewist moeten worden volgens
  de bewaartermijn in het verwerkingsregister. De ontwerpstap bepaalt hoe de herinnering eruitziet.
- **Wissen** (D7): de directie wist één schooljaar tegelijk. Dat wist elk kind van de klassen van dat schooljaar, met
  elk rapport, elke beoordeling, elk besluit en elke tekening. Het is echt wissen, niet verbergen.
- De bevestiging zegt hoeveel kinderen verdwijnen.
- De rapportdoelen en de sterrenschaal blijven: ze zijn geen gegevens over kinderen en gelden altijd (R7).
- Alleen de directie ziet het overzicht en kan wissen.
- De tool wist nooit vanzelf.

**Bindend:** Art. VI.6, Art. VI.7 en ADR-0035 §3.7. Een kopie in een back-up verdwijnt pas als die back-up vervalt (7
dagen op de demo, ADR-0034; E7-09 voor andere omgevingen). Het verwerkingsregister zegt dat, niet deze pagina.

## Acceptatiecriteria

- [ ] Gegeven twee schooljaren, waarvan één met kinderen in een K3-klas, wanneer de directie de beheerpagina opent, dan staat alleen dat schooljaar in het overzicht, met het aantal kinderen, en met een herinnering om de gegevens te wissen volgens de bewaartermijn in het verwerkingsregister.
- [ ] Gegeven dat schooljaar, wanneer de directie op wissen klikt, dan noemt de bevestiging het aantal kinderen dat verdwijnt; na bevestigen zijn alle kinderen, rapporten en tekeningen van dat schooljaar weg, ook via hun oude adres.
- [ ] Gegeven het wissen, dan blijven de rapportdoelen, de sterrenschaal en de gegevens van andere schooljaren ongewijzigd, en verdwijnt het gewiste schooljaar uit het overzicht.
- [ ] Gegeven een gebruiker zonder directierecht, dan ziet die het overzicht en de wisknop niet, en weigert de app het wissen ook via het adres.
- [ ] Gegeven dat geen enkel schooljaar nog gegevens over kinderen bevat, dan zegt de beheerpagina dat, en toont ze geen herinnering.

## Testscenario's

1. Meld aan als directie. Zorg voor een schooljaar met een K3-klas en een paar verzonnen kinderen, met ingevulde
   rapporten en een tekening.
2. Open de beheerpagina. Dat schooljaar staat in het overzicht, met het aantal kinderen en een herinnering.
3. Klik op wissen. De bevestiging noemt het aantal kinderen. Annuleer: er is niets gewist.
4. Klik opnieuw op wissen en bevestig. Het schooljaar verdwijnt uit het overzicht. Open het oude adres van een rapport:
   het bestaat niet meer.
5. De rapportdoelen en de sterrenschaal staan er nog, ongewijzigd.
6. Als er geen schooljaar met gegevens meer is: de pagina zegt dat, zonder herinnering.
7. Meld aan als K3-leerkracht: geen overzicht en geen wisknop.

## Buiten scope

- Automatisch wissen na een termijn (R19, R28: wissen blijft een handeling van de directie).
- Een bewaartermijn instellen in de tool: die staat in het verwerkingsregister (Art. VI.6, E7-06).
- Eén kind wissen: dat doet FB-001 (D8).
- Een back-up vroeger laten wissen (E7-09).

## Open vragen

- Mag de directie ook het schooljaar wissen dat nog loopt, of alleen een schooljaar dat voorbij is? ADR-0035 zegt het
  niet.

## Werklog

- 2026-09-14 14:39 · rapport-tickets · aangemaakt (status nieuw)
