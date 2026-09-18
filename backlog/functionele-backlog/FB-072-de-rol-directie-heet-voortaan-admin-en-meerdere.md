---
id: FB-072
titel: De rol directie heet voortaan admin, en meerdere gebruikers kunnen admin zijn
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 19:15
opgepakt-door: fb-072-sessie
branch: ticket/FB-072-rol-admin
pr: 144
geblokkeerd:
fr: [FR-12.2]
---

## Aanleiding

De app kent vandaag een rol **directie**, die alles ziet en alles bewerkt. In de school is dat een beheerrol en geen
functie: de directeur heeft niet per se meer rechten dan wie de app beheert. De naam doet vermoeden dat alleen de
directeur die rol kan hebben, en maakt het rechtenschema moeilijker uit te leggen.

De eigenaar besliste (2026-09-18): er is **één beheerrol, admin**. Daarnaast blijven **themabeheer**, **hoofdleerkracht**,
**Leerlingzorg** en **leerkracht** wat ze vandaag zijn. Een leerkracht bewerkt, zoals nu, alleen haar eigen activiteiten.

## Gewenst gedrag

- Overal waar de app vandaag "directie" of "directierecht" zegt voor de rol (het scherm Gebruikers, knoppen, uitleg,
  meldingen, weigeringen), staat voortaan "admin" of "adminrecht".
- De admin mag precies wat de directie vandaag mag. Er komt geen recht bij en er gaat geen recht af.
- Meerdere gebruikers kunnen admin zijn. Een admin geeft het adminrecht aan een andere gebruiker en neemt het af, zoals
  vandaag met het directierecht. De laatste admin kan het recht niet afgeven.
- Wie vandaag directierecht heeft, is na de wijziging admin, zonder dat iemand iets moet doen.
- De regels in de constitutie (Art. VI.1, Art. XII) en de rechtenmatrix van ADR-0030 worden in een nieuwe ADR
  meegenomen, zodat de documenten dezelfde naam gebruiken als de app.

## Acceptatiecriteria

- [x] Gegeven een gebruiker die vandaag directierecht heeft, wanneer die na de wijziging aanmeldt, dan is die admin en kan die alles wat die voordien kon.
- [x] Gegeven het scherm Gebruikers, wanneer een admin het opent, dan staat er nergens meer "directie" voor de rol, alleen "admin".
- [x] Gegeven een admin, wanneer die een andere gebruiker het adminrecht geeft, dan kan die gebruiker na herladen alles wat een admin kan.
- [x] Gegeven de enige admin, wanneer die het eigen adminrecht wil afgeven, dan weigert de app met een uitleg.
- [x] Gegeven een gebruiker met alleen themabeheer, hoofdleerkracht of een klastoewijzing, wanneer die de app gebruikt, dan heeft die dezelfde rechten als vóór de wijziging.

## Testscenario's

1. Meld aan als een gebruiker die directierecht had. Open het scherm Gebruikers: de rol heet "admin", en je eigen rij
   toont dat je admin bent.
2. Geef een leerkracht het adminrecht. Meld aan als die leerkracht: het scherm Gebruikers is zichtbaar en je kan elk
   thema en elke klas bewerken.
3. Neem het adminrecht weer af. Meld opnieuw aan als die leerkracht: het scherm Gebruikers is weg.
4. Zorg dat er één admin over is en probeer als die admin het eigen recht af te geven: de app weigert en zegt waarom.
5. Loop de agenda, de doelenpagina en het dekkingsoverzicht door: nergens staat "directie" als naam van een rol.

## Buiten scope

- Rechten toevoegen of wegnemen: de admin mag wat de directie vandaag mag, niet meer en niet minder.
- De rollen themabeheer, hoofdleerkracht, Leerlingzorg en leerkracht wijzigen.
- Het woord "directie" waar het de persoon of de school bedoelt en niet de rol (bijvoorbeeld in een rapport).

## Open vragen

Geen. De bouwsessie schrijft de ADR en past Art. VI.1 en Art. XII van de constitutie aan als deel van dit ticket
(akkoord van de eigenaar, 2026-09-18).

## Werklog

- 2026-09-18 17:47 · Siebe · aangemaakt (status nieuw)
- 2026-09-18 18:20 · fb-072-sessie · nieuw → in-uitvoering: opgepakt: eigenaar wil starten; keuze eigenaar: alles hernoemen (code, kolom, API, configsleutel)
- 2026-09-18 18:33 · fb-072-sessie · hernoeming gebouwd: code, kolom (migratie GebruikerIsAdmin), API-route, configsleutel met terugval, teksten; ADR-0061 en grondwet bijgewerkt; unit-, integratie- (Postgres) en frontendtests groen
- 2026-09-18 18:41 · fb-072-sessie · browserpas op kopie jp_fb072 (desktop en 390px): directierecht na migratie admin, scherm Gebruikers toont Admin, adminrecht geven/afnemen werkt na herladen, laatste admin geweigerd met uitleg, agenda/doelen/dekking/thema's zonder 'directie'; criterium 5 gedekt door de ongewijzigde rechtentests
- 2026-09-18 18:41 · fb-072-sessie · antagonist: ronde 1 één MAJOR (Art. IV.1, IX.2 en FA nog 'directie' voor het recht), opgelost in cc7f606d; ronde 2 COMPLIANT. MINOR's opgelost in eac3807f
- 2026-09-18 18:42 · fb-072-sessie · in-uitvoering → te-testen: gebouwd: rol directie heet admin in app, code, kolom (migratie GebruikerIsAdmin), API-route en configsleutel (oude sleutel blijft als terugval); ADR-0061, grondwet, CLAUDE.md en FA bijgewerkt; unit 2138, integratie 569, frontend 1228 groen, lint en format schoon, antagonist COMPLIANT
- 2026-09-18 19:15 · fb-072-sessie · PR #144
