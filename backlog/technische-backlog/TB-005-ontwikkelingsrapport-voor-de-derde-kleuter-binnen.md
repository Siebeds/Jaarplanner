---
id: TB-005
titel: Ontwikkelingsrapport voor de derde kleuter binnen scope brengen: amendement en ADR
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 11:36
opgepakt-door: kindrapport
branch: ticket/TB-005-ontwikkelingsrapport-scope
pr:
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
   - de 22 antwoorden van de eigenaar, letterlijk;
   - het model;
   - wie wat mag, met een vijfde recht **Leerlingzorg**;
   - de AI-herwerking zonder namen;
   - de kindtekening zonder metadata;
   - de export, het bewaren en het wissen;
   - de standaardkeuzes (D1 tot D10) die geen uitspraak van de eigenaar zijn.
2. **Het amendement**, als aparte commit:
   - in de grondwet: Art. I.1, I.2, IV.2 tot IV.5, VI.1, VI.2, een nieuw VI.7, een nieuw IX.4, Art. XII en het
     ratificatielog;
   - mee in dezelfde commit:
     - de functionele analyse (buiten scope, een nieuwe FR-13, NFR-6, aannames);
     - `CLAUDE.md`;
     - de ADR-index en de statusregels van ADR-0011 en ADR-0016;
     - E7-06 en de E8-nota;
     - een vraag aan de directie in `docs/besluiten-gevraagd.md`.

## Acceptatiecriteria

- [ ] Gegeven ADR-0035, wanneer iemand leest wat de eigenaar besliste, dan staan de vragen, de gekozen en de niet gekozen opties letterlijk, en apart van de standaardkeuzes van de sessie.
- [ ] Gegeven de grondwet na het amendement, dan staat het ontwikkelingsrapport voor K3 niet meer onder de niet-doelen. Toegang voor ouders, koppelingen met Informat of Smartschool en puntenbeheer blijven wel niet-doelen.
- [ ] Gegeven Art. VI na het amendement, dan staat erin welke leerlinggegevens bewaard worden, wie ze ziet, hoe ze gewist worden en dat de AI geen namen krijgt.
- [ ] Gegeven de amendementscommit, dan zijn de functionele analyse, `CLAUDE.md`, de ADR-index, ADR-0011, ADR-0016, E7-06 en E8 in dezelfde commit bijgewerkt, en zegt geen van die teksten nog zonder uitzondering "geen leerlinggegevens".
- [ ] Gegeven `docs/besluiten-gevraagd.md`, dan staat er een vraag aan de directie over het ontwikkelingsrapport: bevestiging, bewaartermijn in het verwerkingsregister, ouders informeren, DPIA.
- [ ] Gegeven de antagonist-audit van de ADR en het amendement, dan is het oordeel COMPLIANT, of is elke bevinding verwerkt of uitdrukkelijk opzijgezet.

## Buiten scope

- Het bouwen van het ontwikkelingsrapport zelf: dat volgt als FB-tickets (ADR-0035 §6), na E6-02.
- Toegang voor ouders tot de app, koppelingen met een leerlingadministratie, en punten of gemiddelden.
- ADR-0030 zelf wijzigen: die krijgt een verwijzing zodra sessie E6-02 hem vrijgeeft.

## Open vragen

Geen. De eigenaar beantwoordde op 2026-09-14 alle 22 vragen (ADR-0035 §1). De bevestiging door de directie komt als vraag
in `docs/besluiten-gevraagd.md` en houdt het werk niet tegen (R20).

## Werklog

- 2026-09-14 11:27 · kindrapport · aangemaakt (status in-uitvoering)
- 2026-09-14 11:36 · kindrapport · ADR-0035 geschreven met de 22 antwoorden van de eigenaar (R1 tot R22) en de standaardkeuzes D1 tot D10; het amendement wacht op de grondwet en de functionele analyse, die sessie E6-02 nog vasthoudt
