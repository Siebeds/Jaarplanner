---
id: TB-005
titel: Ontwikkelingsrapport voor de derde kleuter binnen scope brengen: amendement en ADR
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 12:58
opgepakt-door: kindrapport
branch: ticket/TB-005-ontwikkelingsrapport-scope
pr: 58
geblokkeerd:
fr: []
---

## Aanleiding

De leerkrachten van de derde kleuter schrijven drie keer per jaar een rapport per kind voor de ouders. De eigenaar wil
dat in de Jaarplanner doen, als **ontwikkelingsrapport**. Per kind en per evaluatiemoment komen er:

- een ster en een tekst per gegroepeerd doel, met herwerking door AI;
- een algemeen besluit;
- een kindtekening;
- een download als PDF en Word.

De grondwet sluit dat vandaag uit: rapportering op leerlingniveau en evaluatie zijn niet-doelen (Art. I.2), en er mogen
geen leerlinggegevens in de app (Art. VI.2). De eigenaar koos op 2026-09-14 om de grondwet bewust te wijzigen (Art. XI).
Dit ticket legt die beslissing en de regels voor de leerlinggegevens vast, vóór er één regel code geschreven wordt.

## Voorgestelde wijziging

Geen broncode. Alleen documenten:

1. **ADR-0035** (`docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md`). Die legt vast:
   - de 31 antwoorden van de eigenaar, letterlijk (R1 tot R31, waarvan R23 tot R31 na de eerste audit);
   - het model;
   - wie wat mag, met een vijfde recht **Leerlingzorg**;
   - de AI-herwerking zonder de namen van de klas;
   - de kindtekening zonder metadata;
   - de export, het bewaren en het wissen;
   - wat de sessie zelf ontwierp: de standaardkeuzes D1 tot D16 en de rest van §2 en §3, die geen uitspraak van de
     eigenaar zijn.
2. **Het amendement**, als aparte commit:
   - in de grondwet: Art. I.1, I.2, IV.1 tot IV.5, VI.1, VI.2, VI.6, een nieuw VI.7, een nieuw IX.4, Art. XII en het
     ratificatielog;
   - mee in dezelfde commit:
     - de functionele analyse (binnen en buiten scope, §3.1, een nieuwe FR-13, NFR-6, §7, aannames, A.11);
     - `CLAUDE.md` (de afspraken over leerlinggegevens en AI, de AI-conventies, het datamodel, de woordenlijst);
     - de matrix in ADR-0030, de ADR-index en de statusregels van ADR-0011 en ADR-0016;
     - E7-06 en de E8-nota;
     - een vraag aan de directie in `docs/besluiten-gevraagd.md`;
     - de drie agent- en skillbestanden die leerlinggegevens vandaag altijd afkeuren (`antagonist.md`,
       `implementer.md`, `jaarplan-build/SKILL.md`), zodat ze het ontwikkelingsrapport niet tegenhouden (R29).

## Acceptatiecriteria

- [x] Gegeven ADR-0035, wanneer iemand leest wat de eigenaar besliste, dan staan de vragen, de gekozen en de niet gekozen opties letterlijk, en apart van de standaardkeuzes van de sessie.
- [x] Gegeven de grondwet na het amendement, dan staat het ontwikkelingsrapport voor K3 niet meer onder de niet-doelen. Toegang voor ouders, koppelingen met Informat of Smartschool en puntenbeheer blijven wel niet-doelen.
- [x] Gegeven Art. VI na het amendement, dan staat erin welke leerlinggegevens bewaard worden, wie ze ziet, hoe ze gewist worden en dat de namen van de kinderen van de klas vervangen worden voor een tekst naar de AI gaat.
- [x] Gegeven de amendementscommit, dan zijn de functionele analyse, `CLAUDE.md`, de matrix in ADR-0030, de ADR-index, ADR-0011, ADR-0016, E7-06, E8 en de drie agent- en skillbestanden in dezelfde commit bijgewerkt, en zegt geen van die teksten nog zonder uitzondering "geen leerlinggegevens".
- [x] Gegeven `docs/besluiten-gevraagd.md`, dan staat er een vraag aan de directie over het ontwikkelingsrapport: bevestiging, bewaartermijn in het verwerkingsregister, ouders informeren, DPIA.
- [x] Gegeven de antagonist-audit van de ADR en het amendement, dan is het oordeel COMPLIANT, of is elke bevinding verwerkt of uitdrukkelijk opzijgezet.

## Buiten scope

- Het bouwen van het ontwikkelingsrapport zelf: dat volgt als FB-tickets (ADR-0035 §6), na E6-02.
- Toegang voor ouders tot de app, koppelingen met een leerlingadministratie, en punten of gemiddelden.
- Codecommentaar dat pas door de bouw onwaar wordt (bv. in `IAiClient.cs`): dat past het bouwticket aan.
- De E6-epic: *"Personal login for staff accounts only (no pupil data)"* gaat over wie kan aanmelden, en dat blijft waar.

## Open vragen

Geen. De eigenaar beantwoordde op 2026-09-14 alle 31 vragen (ADR-0035 §1). De bevestiging door de directie komt als vraag
in `docs/besluiten-gevraagd.md` en houdt het werk niet tegen (R20, R27).

## Werklog

- 2026-09-14 11:27 · kindrapport · aangemaakt (status in-uitvoering)
- 2026-09-14 11:36 · kindrapport · ADR-0035 geschreven met de 22 antwoorden van de eigenaar (R1 tot R22) en de standaardkeuzes D1 tot D10; het amendement wacht op de grondwet en de functionele analyse, die sessie E6-02 nog vasthoudt
- 2026-09-14 11:59 · kindrapport · Correctie op de regel van 11:36: E6-02 had de grondwet, de functionele analyse en ADR-0030 al om 11:26 vrijgegeven; wat overblijft is hun niet-gepushte wijziging aan Art. VI.1, die bij de merge een klein conflict kan geven
- 2026-09-14 11:59 · kindrapport · Antagonist ronde 1: VIOLATIONS FOUND (3 MAJOR, 8 MINOR, 4 vragen); de 22 antwoorden kloppen; zeven vragen voorgelegd aan de eigenaar; rapport in backlog/worklogs/TB-005/antagonist-ronde-1.md
- 2026-09-14 12:15 · kindrapport · Ronde 1 verwerkt: zeven nieuwe antwoorden van de eigenaar (R23 tot R29) in ADR-0035, de eigen ontwerpkeuzes als standaard gemarkeerd, en het amendement geschreven (grondwet, functionele analyse, CLAUDE.md, ADR-0030-matrix, E7-06, E8, vraag 15 aan de directie, drie agent- en skillbestanden)
- 2026-09-14 12:31 · kindrapport · Antagonist ronde 2: VIOLATIONS FOUND (1 MAJOR, 9 MINOR, 4 vragen), allemaal verwerkt zonder nieuwe vraag aan de eigenaar: de AI krijgt nu alleen de tekst (R21), eigen keuzes als standaard gemarkeerd, de herinnering (R28) overal, AVG art. 9 en de volledige R29 opgenomen; rapport in backlog/worklogs/TB-005/antagonist-ronde-2.md
- 2026-09-14 12:34 · kindrapport · De eigenaar bevestigde de aanpassing aan de drie agent- en skillbestanden in zijn eigen antwoord: 'Ja, zo is het goed' (komt als R30 in ADR-0035 na ronde 3)
- 2026-09-14 12:43 · kindrapport · Antagonist ronde 3: 0 MAJOR, 7 MINOR, 2 vragen, allemaal verwerkt: directie op de K3-set is een standaardkeuze (R6), AVG-verwijzing verbeterd (art. 13(1)/14, voorwaardelijk), namen in logs en code blijven CRITICAL, graadklas-gevolg aan de directie gemeld, R30 opgenomen; rapport in backlog/worklogs/TB-005/antagonist-ronde-3.md
- 2026-09-14 12:56 · kindrapport · Antagonist ronde 4: 0 MAJOR, 4 MINOR, 2 vragen, verwerkt; de eigenaar besliste R31 (alleen de K3-leerkrachten passen de K3-set en de sterrenschaal aan, de directie bekijkt ze). De kleine correcties na ronde 4 zijn niet meer geauditeerd.
- 2026-09-14 12:56 · kindrapport · Acceptatiecriteria afgevinkt: ADR-0035 §1 citeert R1 tot R31 letterlijk, apart van D1 tot D16; Art. I.2, VI.2, VI.6 en VI.7 in de grondwet; alle afhankelijke teksten in de amendementscommit ac60a42 en de correcties daarna; vraag 15 in besluiten-gevraagd.md; vier antagonistrondes, elke bevinding verwerkt
- 2026-09-14 12:56 · kindrapport · in-uitvoering → klaar: Klaar: ADR-0035 en het amendement op Art. I, IV, VI, IX en XII brengen het ontwikkelingsrapport voor de derde kleuter binnen scope; geen broncode; de bouw volgt als FB-tickets na E6-02
- 2026-09-14 12:58 · kindrapport · PR #58
