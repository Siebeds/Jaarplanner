---
id: TB-010
titel: Minimumdoelenregister geordend volgens het decreet, met de leerlijn per minimumdoel
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 15:15
opgepakt-door: md-boom
branch: ticket/minimumdoelenboom
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Op het scherm Doelen is *Minimumdoelen* vandaag een lange lijst, gegroepeerd per discipline van de gekoppelde
leerplandoelen (FR-2.4). De eigenaar wil er een overzicht van zoals bij de leerplandoelen, en wil zien hoe elk
minimumdoel met de leerplandoelen verbonden is: nu staat er per minimumdoel alleen een rij codes.

KOV levert bij elk minimumdoel een eigen ordening mee in het veld `path` van `/agodi/onderwijsdoelen/opstap`
(*Leergebied > rubriek > subrubriek*, bv. *Nederlands > Lezen > Vlot en vloeiend lezen*; 944 met drie niveaus, 54 met
twee) en een soort in `type` (*te bereiken op individueel niveau* 177, *te bereiken op populatieniveau* 632, *na te
streven op populatieniveau* 189). De app bewaart geen van beide. Een minimumdoel wordt uitgewerkt in mediaan 3
G-leerplandoelen (max 78), gespreid over gemiddeld 2,5 leerjaren (snapshot 1.2).

De eigenaar vergeleek op 2026-09-14 een klikbare maquette van twee ordeningen en koos **optie A, de ordening van het
decreet**, alleen onder *Minimumdoelen*: "oke we gaan voor optie A: ik wil wel dat de leerplandoelen sectie blijft
zoals het is, maar je mag deze optie A onder de minimumdoelen sectie steken dan".

## Voorgestelde wijziging

- **Domein en import:** `Minimumdoel` krijgt `Leergebied`, `Rubriek`, `Subrubriek` (nullable: twee niveaus bij 54) en
  `Soort`, als decretale inhoud die alleen de import schrijft (Art. III.1). `OnderwijsdoelMapping` leest `path` en
  `type`; een ontbrekend of onleesbaar pad weigert de rij niet, het laat de ordening leeg. Een migratie voegt de
  kolommen toe; opnieuw inladen vult ze aan voor bestaande rijen.
- **Query en API:** de lijst en facetten van `/api/minimumdoelen` groeperen op leergebied › rubriek › subrubriek
  (elk minimumdoel één keer), met een filter op mijlpaal (K-, 4-, 6-) naast de bestaande. Elke rij draagt het aantal
  gekoppelde leerplandoelen en hun jaar/fasen. Nieuw: `GET /api/minimumdoelen/{ref}` met de gekoppelde leerplandoelen
  (code, tekst, jaar/fase).
- **Frontend (`features/doelen`):** een minimumdoelenboom in de vorm van de leerplandoelenboom, een minimumdoeldetail
  (tekst, mijlpaal, soort, pad, leerplandoelen per jaar/fase) en doorklikken in beide richtingen: het minimumdoel in
  het leerplandoeldetail wordt aanklikbaar. Teksten in `nl.json`.
- **Constitutie:** Art. VII.2 (de mapping van de minimumdoelen) en Art. IX.1 (de velden van `Minimumdoel`) krijgen de
  nieuwe velden erbij, met een regel in het ratificatielogboek.

## Acceptatiecriteria

- [x] Gegeven een minimumdoelenimport vanuit de API, dan heeft elk ingelezen minimumdoel het leergebied, de rubriek,
  de subrubriek (als KOV er een geeft) en de soort zoals KOV ze levert, en een nieuwe import vult ze aan voor
  minimumdoelen die al bestonden.
- [x] Gegeven het scherm Doelen op *Minimumdoelen*, dan zie ik een boom leergebied › rubriek › subrubriek met
  aantallen, staat elk minimumdoel er precies één keer in, en staan de doelen binnen een tak in de volgorde K, 4, 6.
- [x] Elke rij toont de code, de doelzin en hoeveel leerplandoelen naar het minimumdoel verwijzen met hun jaar/fasen
  (bv. *16 ingeladen leerplandoelen · L1, L2, L3, L4*: elk jaar opgesomd, want een bereik zou jaren beloven die
  leeg kunnen zijn); verwijst er geen ingeladen leerplandoel naar, dan zegt de rij dat, en het detail
  geeft de reden die de import kent.
- [x] Wanneer ik een minimumdoel aanklik, dan toont het detail de volledige tekst, de mijlpaal, de soort, het pad en
  de gekoppelde leerplandoelen per jaar/fase; een leerplandoel aanklikken opent het bestaande leerplandoeldetail, en
  het minimumdoel daarin brengt me terug.
- [x] Zoeken, de jaar/fase van de klas en een filter op mijlpaal beperken de boom, en de aantallen volgen mee.
- [x] Het deel *Leerplandoelen* van het scherm werkt en ziet eruit zoals voorheen.

## Buiten scope

- Het leerplandoelenregister (op het aanklikbare minimumdoel in het leerplandoeldetail na).
- Dekking op minimumdoelniveau: dat is E5-04.
- Andere doelsets dan G, en de ordening van de leerplandoelen.

## Open vragen

Geen voor de bouw. De keuze voor optie A wijzigt Art. VII.2 en IX.1. Op 2026-09-14 bekrachtigde de eigenaar de
Nederlandse samenvatting van die tekst ("Bekrachtigen"), koos om de soort te bewaren en in het detail van het
minimumdoel te tonen, en om het minimumdoel in het leerplandoeldetail aanklikbaar te maken, nadat gezegd was dat dat
de enige wijziging aan het deel *Leerplandoelen* is. Directie heeft het niet bevestigd.

## Werklog

- 2026-09-14 12:53 · md-boom · aangemaakt (status in-uitvoering)
- 2026-09-14 13:28 · md-boom · Backend klaar: Minimumdoel draagt leergebied, rubriek, subrubriek en soort uit KOV's path en type; register per minimumdoel in de ordening van het decreet; nieuw detail GET /api/minimumdoelen/{ref}. Unit-tests groen (1159). De migratie wacht op de claim van E6-02.
- 2026-09-14 13:45 · md-boom · geblokkeerd: Wacht op de eigenaar: bekrachtigt hij de tekst van het amendement (Art. VII.2 en IX.1), mag de soort bewaard en getoond worden, en mag het minimumdoel in het leerplandoeldetail aanklikbaar zijn (antagonist ronde 1, MAJOR 2).
- 2026-09-14 14:10 · md-boom · niet langer geblokkeerd
- 2026-09-14 14:10 · md-boom · Antwoord van de eigenaar: de tekst van het amendement is bekrachtigd, de soort wordt bewaard en getoond, en het minimumdoel in het leerplandoeldetail wordt aanklikbaar. De bloktekst hierboven had 'de eigenaar' moeten zeggen in plaats van 'hij'.
- 2026-09-14 14:21 · md-boom · Antagonist ronde 1 afgewerkt: MAJOR 1 (leergebied van het decreet gescheiden van leergebied/Wereldoriëntatie in Art. VII.0, XII, XIV en de functionele analyse) en MAJOR 2 (de logregel zegt nu dat de eigenaar de tekst bekrachtigde en wat niet van de eigenaar komt). origin/main (TB-005, TB-008, TB-009) gemerged.
- 2026-09-14 14:32 · md-boom · Antagonist ronde 2: geen MAJOR meer. MINOR 12, 14 en 15 verwerkt (logregel en IX.1 nauwkeuriger, leergebied overal benoemd, tickettekst bijgewerkt). Correctie op de regel van 14:10: de eigenaar koos de soort te bewaren en in het detail van het minimumdoel te tonen. MINOR 11 en 13 zitten in de copy die nog in nl.json moet: 'Uitgewerkt in {aantal} ingeladen leerplandoelen', 'Bekijk dit minimumdoel', en '... als Op.stap ze in een bruikbare vorm meegeeft'.
- 2026-09-14 14:37 · md-boom · Frontend af: minimumdoelenboom in de ordening van het decreet, mijlpaalfilter, minimumdoeldetail met leerplandoelen per jaar/fase, doorklikken in beide richtingen. nl.json aangepast zonder de claim van E6-02, op uitdrukkelijke vraag van de eigenaar ('forceer de nl.json maar'), gemeld in de groepschat. pnpm lint schoon, 264 frontend-tests groen. De migratie wacht nog op E6-02.
- 2026-09-14 14:47 · md-boom · Migratie 20260914124010_MinimumdoelOrdeningEnSoort toegevoegd zonder de Migrations-claim van E6-02, op uitdrukkelijke vraag van de eigenaar ('Ja, forceer ook de migratie'), gemeld in de groepschat. Integratietests op PostgreSQL groen (358), ook de nieuwe test voor ordening en soort.
- 2026-09-14 15:12 · md-boom · Correctie op de regel over de migratie (antagonist ronde 3, MINOR 2): md-boom vroeg de eigenaar of de migratie zonder de claim van E6-02 mocht, en vermeldde eerst dat wie als tweede merget (TB-010 of 20260914114237_Wizardrun van E6-02) zijn migratie opnieuw moet genereren; de eigenaar antwoordde 'Ja, forceer ook de migratie'. Is TB-010 de tweede, dan genereert md-boom de migratie opnieuw.
- 2026-09-14 15:15 · md-boom · in-uitvoering → klaar: Klaar. Gates groen: unit 1162, integratie op PostgreSQL 358 (na de fixes van ronde 3 de twee importklassen, 25, opnieuw groen), frontend-suite 270 en lint schoon na de merge (daarna doelen/catalogus/filter, 36, opnieuw groen), dotnet format schoon. Antagonist ronde 3: geen MAJOR, de 4 MINOR verwerkt (kop 'N ingeladen leerplandoelen verwijzen ernaar', correctie over de migratie, zoek-facetten getest, 'ingeladen' in het voorbeeld). Bewijs per criterium: AC1 MinimumdoelImportServiceTests + de PostgreSQL-endpointtest + een echte import (998 geordend); AC2 MinimumdoelenQueryTests + browser (boom, volgorde K/4/6); AC3 browser (rijen) + Minimumdoelenboom/Minimumdoeldetail-tests (zonder leerplandoel, reden); AC4 browser (detail, doorklikken heen en terug); AC5 browser (mijlpaal 4: 368, klasfilter), integratietest facetten onder zoekterm; AC6 browser (deel Leerplandoelen ongewijzigd, op het aanklikbare minimumdoel na). Na deploy: de migratie toepassen en de minimumdoelen opnieuw inladen, anders staan ze onder 'Zonder ordening'.
