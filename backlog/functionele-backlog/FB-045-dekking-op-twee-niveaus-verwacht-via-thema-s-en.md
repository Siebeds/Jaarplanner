---
id: FB-045
titel: Dekking op twee niveaus: verwacht via thema's en subthema's, ingepland via de agenda
soort: functioneel
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 13:46
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-9.1, FR-9.2, FR-9.3]
---

## Aanleiding

De eigenaar beschreef op 2026-09-16, bij de vraag of de leerplandoelen van een minimumdoel op een thema (FB-043)
meetellen voor de dekking: *"De dekking is op twee niveaus, enerzijds te bekijken of alle minimumdoelen zijn gedekt door
deze toe te voegen aan thema's (dit is verwachte dekking), en als de thema's dan zijn ingepland in de agenda dan is het
"echte dekking" (beter woord voor vinden dan "echte"). Daarnaast heb je ook de dekking op subthema niveau die
gelijkaardig is maar voor leerplandoelen (verwachte dekking leerplandoelen in plaats van verwachte dekking
minimumdoelen) en dan de echte dekking wanneer dit is ingepland in de agenda en hiernaast eventueel ook een dieper
niveau bij doorklikken heb je nog de mogelijkheid om te zien of die subdoelen wel allemaal zijn opgenomen in die
activiteiten en hoeveel van die activiteiten dan ook zijn in de agenda gezet."*

Vandaag kent het dekkingsoverzicht één soort dekking per klas: een leerplandoel is gedekt als het beslist gekoppeld is
aan een thema dat in de planning staat (of aan een ingeplande algemene fiche), en een minimumdoel als minstens één
geconcordeerd leerplandoel gedekt is (grondwet Art. V.1).

## Gewenst gedrag

Het dekkingsoverzicht toont twee stappen, zodat de directie en de leerkrachten zien wat de school van plan is en wat
er al ingepland is. Hieronder heten ze **verwacht** en **ingepland**; de woorden zijn nog niet vast (zie Open vragen).

- **Minimumdoelen**
  - *Verwacht:* het minimumdoel staat als themadoel op minstens één thema (FB-043).
  - *Ingepland:* zo'n thema staat in de agenda van de klas.
- **Leerplandoelen**
  - *Verwacht:* het leerplandoel is subdoel van een subthema van de leeftijd van de klas.
  - *Ingepland:* dat subthema staat in de agenda van de klas.
- Per doel is te zien in welke stap het zit: nog nergens, verwacht, of ingepland, met een woord of icoon en niet met
  kleur alleen, en met het thema of subthema dat het draagt.
- Ontbrekende doelen blijven zichtbaar als actielijst: een minimumdoel zonder thema, een leerplandoel zonder subthema.

## Acceptatiecriteria

- [ ] Gegeven een minimumdoel op een thema dat de K3-klas nog niet ingepland heeft, wanneer men de dekking van die klas
  opent, dan staat het minimumdoel als verwacht, met de naam van het thema.
- [ ] Gegeven dat thema, wanneer het in de agenda van de klas gezet wordt, dan staat het minimumdoel als ingepland.
- [ ] Gegeven een leerplandoel dat subdoel is van een K3-subthema, dan staat het in de dekking van een K3-klas als
  verwacht, en als ingepland zodra dat subthema in haar agenda staat; in een K2-klas telt het niet.
- [ ] Gegeven een minimumdoel op geen enkel thema, dan staat het in de lijst van ontbrekende doelen.
- [ ] De stappen zijn te onderscheiden zonder kleur, en de berekening is getest aan de serverkant.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Koppel (met themabeheer) een minimumdoel aan een thema. Open als directie de dekking van een K3-klas die het thema
   nog niet inplande. Het minimumdoel staat als verwacht, met het thema erbij.
2. Zet het thema in de agenda van die klas en herlaad. Het minimumdoel staat als ingepland.
3. Koppel (als hoofdleerkracht K3) een subdoel aan een K3-subthema. Het leerplandoel staat in de dekking van de K3-klas
   als verwacht; na het inplannen van het subthema als ingepland.
4. Open de dekking van een K2-klas: dat leerplandoel telt daar niet.
5. Zoek een minimumdoel dat op geen thema staat: het staat bij de ontbrekende doelen.
6. Herhaal stap 1 en 2 op ~390px.

## Buiten scope

- Het diepere niveau per subthema: welke subdoelen in een activiteit zitten (bestaat al, FB-010) en hoeveel van die
  activiteiten in de agenda staan. Een vervolgticket als de eigenaar dat wil.
- De export van het dekkingsoverzicht: die volgt zodra de nieuwe berekening vastligt.

## Open vragen

- **Dit wijzigt de grondwet.** Art. V.1 zegt vandaag wanneer een doel gedekt is. De eigenaar moet de nieuwe definitie
  goedkeuren, en ze wordt in de grondwet en in `docs/constitutie-log.md` vastgelegd voor dit gebouwd wordt.
- **Welke woorden?** Voorstel: *verwacht* en *ingepland*, of *beoogd* en *ingepland*. Het woord "gedekt" of "echte
  dekking": welk van de twee is het bewijs voor de inspectie?
- **Wat telt nog mee voor ingepland?** Vandaag tellen ook leerplandoelen op een thema (themadoelen, aanvaarde
  doelsuggesties), op activiteiten en op ingeplande algemene fiches. **Standaard** blijven de algemene fiches meetellen
  als ingepland; voor de themadoelen die leerplandoelen zijn en de doelsuggesties beslist de eigenaar.
- **Minimumdoel ook via de leerplandoelen?** Is een minimumdoel ook verwacht als het niet op een thema staat maar een
  geconcordeerd leerplandoel wel subdoel is van een subthema? **Standaard** ja, want de inspectie kijkt naar het
  minimumdoel, niet naar waar het gekoppeld werd.
- Hangt af van FB-043.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
