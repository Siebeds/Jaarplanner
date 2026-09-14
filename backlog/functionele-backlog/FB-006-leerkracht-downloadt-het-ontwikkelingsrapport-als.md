---
id: FB-006
titel: Leerkracht downloadt het ontwikkelingsrapport als PDF en als Word
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 14:38
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-13.6]
---

## Aanleiding

Het ontwikkelingsrapport is voor de ouders. Ze krijgen het als PDF of als Word-bestand (R13), niet via de app. De
school heeft er nog geen sjabloon voor, dus het ontwerp is nieuw (R12).

Dit is bouwticket 6 van ADR-0035 §6. **Bouwvolgorde:** na FB-003 (het rapport) en FB-005 (de tekening, die op het
rapport staat).

## Gewenst gedrag

- Per kind en per evaluatiemoment kan de leerkracht het rapport downloaden **als PDF** en **als Word**. Beide tonen
  hetzelfde rapport, uit één opmaak.
- **Wat de ouder ziet** (R11):
  - per rapportdoel de titel, de ster met haar label en de tekst;
  - het algemeen besluit;
  - de kindtekening van dat moment.
  - Geen subdoelen: die ziet alleen de leerkracht, in de app.
- Naast elke gekleurde ster staat haar label (Art. XII), zodat het rapport ook in zwart-wit afgedrukt leesbaar blijft.
- Het ontwerp is nieuw en wordt gemaakt met de `frontend-design`-skill. De bouw toont het aan de eigenaar voor het af is.
- Een download wordt gemaakt op het moment dat de leerkracht erom vraagt, en nooit bewaard op de server.
- Hernoemt iemand later een gradatie of rapportdoel, dan toont een nieuwe download de nieuwe naam (R7).
- **Wie:** de leerkrachten van de klas, ook na het schooljaar (R26), en de directie. Niemand anders.

**Bindend:** Art. VI.7 en ADR-0035 §3.7, met D16 (een bibliotheek die PDF of Word maakt, heeft een vrije licentie: MIT,
Apache of BSD). Geen namen of teksten in een log.

## Acceptatiecriteria

- [ ] Gegeven een ingevuld rapport met een tekening, wanneer de leerkracht het downloadt als PDF en als Word, dan tonen beide bestanden hetzelfde: per rapportdoel de titel, de ster met haar label en de tekst, het algemeen besluit en de tekening, en nergens de subdoelen.
- [ ] Gegeven het Word-bestand, wanneer de leerkracht het opent in Word, dan opent het zonder foutmelding, met dezelfde inhoud als de PDF.
- [ ] Gegeven de PDF, wanneer ze in zwart-wit afgedrukt wordt, dan is elke beoordeling nog te lezen aan het label naast de ster.
- [ ] Gegeven een gradatie die na het invullen hernoemd werd, wanneer de leerkracht opnieuw downloadt, dan staat de nieuwe naam op het rapport.
- [ ] Gegeven een schooljaar dat voorbij is, wanneer de leerkracht van de klas het rapport downloadt, dan lukt dat; een leerkracht van een andere klas kan het niet downloaden, ook niet via het adres.

## Testscenario's

1. Vul Rapport 1 van "Fien Proefmans" in, met sterren, teksten, een besluit en een tekening.
2. Download het als PDF. Per rapportdoel staan de titel, de ster met haar label en de tekst. Het besluit en de tekening
   staan erin. Er staan geen subdoelen in.
3. Download het als Word en open het in Word: dezelfde inhoud, zonder foutmelding.
4. Druk de PDF af in zwart-wit, of bekijk ze in grijstinten: elke beoordeling is te lezen aan haar label.
5. Hernoem een gradatie en download opnieuw: de nieuwe naam staat erin.
6. Download een rapport met een rapportdoel zonder ster en tekst voor dat moment: het ziet eruit zoals beslist onder
   *Open vragen*.
7. Kies als leerkracht een schooljaar dat voorbij is: downloaden lukt.
8. Meld aan als leerkracht van een andere klas en plak het adres van de download: de app weigert.
9. Op een telefoonbreedte (~390px) is de download bereikbaar.

## Buiten scope

- Alle rapporten van de klas in één keer downloaden. Dat werd niet gevraagd, en wordt een ticket als de school erom
  vraagt.
- Het rapport bewaren op de server, of het naar de ouders mailen. Ouders krijgen geen toegang tot de app (Art. I.2).
- Downloaden voor Leerlingzorg: dat recht leest alleen (D5; FB-008).
- De export van het jaarplan en de dekking (FR-11). Die vraag in Art. XIV blijft open.

## Open vragen

- Wat staat er bovenaan het rapport, naast de naam van het kind en het moment? Bijvoorbeeld de naam en het logo van de
  school, de klas, het schooljaar of de naam van de leerkracht. De ontwerpstap stelt het voor, de eigenaar beslist.
- Hoe verschijnt een rapportdoel zonder ster en tekst voor dat moment, zoals een rapportdoel dat later bijkwam (D2):
  weggelaten, of leeg getoond?

## Werklog

- 2026-09-14 14:38 · rapport-tickets · aangemaakt (status nieuw)
