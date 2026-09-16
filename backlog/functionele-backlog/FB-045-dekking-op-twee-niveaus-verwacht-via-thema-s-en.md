---
id: FB-045
titel: Dekking op twee niveaus: verwacht via thema's en subthema's, ingepland via de agenda
soort: functioneel
status: te-testen
prioriteit: hoog
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 16:39
opgepakt-door: claude-fb045
branch: ticket/FB-045-dekkingsprognose
pr: 114
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

Het dekkingsoverzicht toont per klas twee stappen, zodat de directie en de leerkrachten zien wat de school van plan
is en wat er al in de agenda staat: de **dekkingsprognose** en de **dekking**. Beide worden getoond, want de agenda
wordt niet voor het hele schooljaar in één keer ingepland (beslissing eigenaar 2026-09-16).

- **Minimumdoelen**
  - *Dekkingsprognose:* het minimumdoel staat als themadoel op minstens één thema (FB-043).
  - *Dekking:* zo'n thema staat in de agenda van de klas.
  - Een minimumdoel telt **alleen via een thema** waarop het zelf staat, niet via een leerplandoel dat ernaar leidt.
- **Leerplandoelen** (van de leeftijd van de klas)
  - *Dekkingsprognose:* het leerplandoel is subdoel van een subthema van de leeftijd van de klas.
  - *Dekking:* dat **subthema** staat in de agenda van de klas (het thema erboven inplannen volstaat niet).
  - Ook *dekking*: een doel op een activiteit van een ingepland subthema, een aanvaarde doelsuggestie van een
    ingepland thema, en een doel op een ingeplande algemene fiche van de klas.
  - De leerplandoelen die een minimumdoel op een thema meebrengt, tellen **niet** mee: alleen het minimumdoel.
  - Themadoelen die een leerplandoel zijn (die schrijft alleen nog de Excel-import) tellen niet mee.
- Per doel is te zien in welke stap het zit: nog nergens, dekkingsprognose, of dekking, met een woord of icoon en niet
  met kleur alleen, en met het thema of subthema dat het draagt.
- Ontbrekende doelen blijven zichtbaar als actielijst: een minimumdoel zonder thema, een leerplandoel zonder subthema.

## Acceptatiecriteria

- [x] Gegeven een minimumdoel op een thema dat de K3-klas nog niet ingepland heeft, wanneer men de dekking van die klas
  opent, dan staat het minimumdoel in de dekkingsprognose, met de naam van het thema.
- [x] Gegeven dat thema, wanneer het in de agenda van de klas gezet wordt, dan staat het minimumdoel als gedekt.
- [x] Gegeven een leerplandoel dat subdoel is van een K3-subthema, dan staat het in de dekkingsprognose van een K3-klas,
  en als gedekt zodra dat subthema in haar agenda staat; in een K2-klas telt het niet.
- [x] Gegeven een minimumdoel op geen enkel thema, dan staat het in de lijst van ontbrekende doelen, ook als een
  leerplandoel dat ernaar leidt ingepland is.
- [x] De stappen zijn te onderscheiden zonder kleur, en de berekening is getest aan de serverkant.
- [x] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Koppel (met themabeheer) een minimumdoel aan een thema. Open als directie de dekking van een K3-klas die het thema
   nog niet inplande. Het minimumdoel staat in de dekkingsprognose, met het thema erbij.
2. Zet het thema in de agenda van die klas en herlaad. Het minimumdoel staat als gedekt.
3. Koppel (als hoofdleerkracht K3) een subdoel aan een K3-subthema. Het leerplandoel staat in de dekking van de K3-klas
   in de dekkingsprognose; na het inplannen van het subthema als gedekt.
4. Open de dekking van een K2-klas: dat leerplandoel telt daar niet.
5. Zoek een minimumdoel dat op geen thema staat: het staat bij de ontbrekende doelen.
6. Herhaal stap 1 en 2 op ~390px.

## Buiten scope

- Het diepere niveau per subthema: welke subdoelen in een activiteit zitten (bestaat al, FB-010) en hoeveel van die
  activiteiten in de agenda staan. Een vervolgticket als de eigenaar dat wil.
- De export van het dekkingsoverzicht: die volgt zodra de nieuwe berekening vastligt.

## Open vragen

Beantwoord door de eigenaar op 2026-09-16:

- **Woorden:** *Dekkingsprognose* en *Dekking*.
- **Wat is het bewijs?** Beide stappen worden getoond. *Dekking* blijft wat de agenda bewijst (grondwet Art. V.1);
  de *dekkingsprognose* komt erbij als eerdere stap. Art. V.1 en `docs/constitutie-log.md` worden aangepast, in een
  eigen commit, samen met de functionele analyse.
- **Minimumdoel via de leerplandoelen?** Nee, niet voor de prognose en niet voor de dekking: een minimumdoel telt
  alleen via een thema waarop het zelf staat. Dit wijzigt de huidige regel van Art. V.1.
- **Wat telt mee als dekking?** Ingeplande algemene fiches, doelen op activiteiten en aanvaarde doelsuggesties. De
  themadoelen die een leerplandoel zijn (import) niet.
- **Leerplandoel op een subthema:** dekking pas als het subthema zelf in de agenda staat.
- **Meegebrachte leerplandoelen** van een minimumdoel op een ingepland thema: tellen niet mee.

**Standaard**, tot de eigenaar anders beslist:

- Een doel op een activiteit en een aanvaarde doelsuggestie tellen ook mee voor de dekkingsprognose, als het
  leerplandoel van de leeftijd van de klas is.
- Een doel op een activiteit telt als dekking zodra het subthema van die activiteit in de agenda staat, ook als de
  activiteit zelf nog geen dag kreeg.
- Een klas wordt gemeten tegen de minimumdoelen van haar mijlpaal: een kleuterklas (JK, K2, K3) tegen `K-`, L1 tot L4
  tegen `4-`, L5 en L6 tegen `6-`. *Heel het curriculum* toont alle minimumdoelen.
- Een thema telt als ingepland zoals vandaag: een beslist geplaatst thema (aanvaard of manueel), niet een voorgesteld.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-16 15:56 · eigenaar · nieuw → klaar-voor-bouw: open vragen beantwoord in de sessie; klaar voor bouw
- 2026-09-16 15:56 · claude-fb045 · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-16 15:58 · claude-fb045 · standaarden vastgelegd: mijlpaal per klas (K-, 4-, 6-) en een thema telt als ingepland wanneer het beslist geplaatst is
- 2026-09-16 16:19 · claude-fb045 · backend klaar: dekkingsprognose en dekking per leerplandoel en per minimumdoel (mijlpaal van de klas), subthema telt pas als het in de agenda staat, themadoelen uit de import tellen niet; unit- en integratietests groen
- 2026-09-16 16:31 · claude-fb045 · frontend klaar: dekkingsscherm met minimumdoelen (per leergebied) en leerplandoelen, meter met dekking en prognose per niveau, stap per doel in woorden en vorm; browser op een kopie van de dev-database, desktop en 390px, zonder horizontaal scrollen
- 2026-09-16 16:38 · claude-fb045 · antagonist: COMPLIANT, geen blokkerende punten; kleine punten opgelost of genoteerd in backlog/worklogs/FB-045/antagonist.md
- 2026-09-16 16:38 · claude-fb045 · criteria afgevinkt: berekening in DekkingsprognoseTests en de Postgres-tests (subthema pas gedekt in de agenda, andere klas en leeftijd, minimumdoel alleen via thema), HTTP-test voor de minimumdoelen, schermtests voor stap en woorden, browser op desktop en 390px
- 2026-09-16 16:38 · claude-fb045 · in-uitvoering → te-testen: gebouwd: dekkingsprognose en dekking voor minimumdoelen en leerplandoelen, Art. V.1 en ADR-0047; alle gates groen
- 2026-09-16 16:39 · claude-fb045 · PR #114
