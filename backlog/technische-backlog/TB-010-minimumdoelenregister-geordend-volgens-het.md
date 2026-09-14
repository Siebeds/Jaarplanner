---
id: TB-010
titel: Minimumdoelenregister geordend volgens het decreet, met de leerlijn per minimumdoel
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 12:53
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

- [ ] Gegeven een minimumdoelenimport vanuit de API, dan heeft elk ingelezen minimumdoel het leergebied, de rubriek,
  de subrubriek (als KOV er een geeft) en de soort zoals KOV ze levert, en een nieuwe import vult ze aan voor
  minimumdoelen die al bestonden.
- [ ] Gegeven het scherm Doelen op *Minimumdoelen*, dan zie ik een boom leergebied › rubriek › subrubriek met
  aantallen, staat elk minimumdoel er precies één keer in, en staan de doelen binnen een tak in de volgorde K, 4, 6.
- [ ] Elke rij toont de code, de doelzin en hoeveel leerplandoelen naar het minimumdoel verwijzen met hun jaar/fasen
  (bv. *16 leerplandoelen · L1–L4*); verwijst er geen ingeladen leerplandoel naar, dan zegt de rij dat, en het detail
  geeft de reden die de import kent.
- [ ] Wanneer ik een minimumdoel aanklik, dan toont het detail de volledige tekst, de mijlpaal, de soort, het pad en
  de gekoppelde leerplandoelen per jaar/fase; een leerplandoel aanklikken opent het bestaande leerplandoeldetail, en
  het minimumdoel daarin brengt me terug.
- [ ] Zoeken, de jaar/fase van de klas en een filter op mijlpaal beperken de boom, en de aantallen volgen mee.
- [ ] Het deel *Leerplandoelen* van het scherm werkt en ziet eruit zoals voorheen.

## Buiten scope

- Het leerplandoelenregister (op het aanklikbare minimumdoel in het leerplandoeldetail na).
- Dekking op minimumdoelniveau: dat is E5-04.
- Andere doelsets dan G, en de ordening van de leerplandoelen.

## Open vragen

Geen voor de bouw. De keuze voor optie A wijzigt Art. VII.2 en IX.1, en de eigenaar koos haar op 2026-09-14 nadat
dat in de sessie was voorgelegd; die keuze wordt als ratificatie in het logboek van de constitutie geschreven.
Directie heeft het niet bevestigd.

## Werklog

- 2026-09-14 12:53 · md-boom · aangemaakt (status in-uitvoering)
