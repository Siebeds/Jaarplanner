---
id: FB-008
titel: Directie geeft het recht Leerlingzorg: alle ontwikkelingsrapporten lezen
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-15 19:38
opgepakt-door: leerlingzorg
branch: ticket/FB-008-leerlingzorg
pr: 95
geblokkeerd:
fr: [FR-13.7, FR-12.2]
---

## Aanleiding

Naast de leerkrachten van de klas en de directie moet ook de zorgcoördinator de ontwikkelingsrapporten kunnen lezen
(R16). De eigenaar besliste dat dit een nieuw recht wordt dat de directie geeft, **Leerlingzorg**, en niet een deel van
themabeheer (R18): themabeheer bestaat voor thema's en krijgt er geen gegevens over kinderen bij.

Dit is bouwticket 8 van ADR-0035 §6. **Bouwvolgorde:** na E6-02 en E6-04 (het beheer van rechten), en na FB-003 (er
moeten rapporten zijn om te lezen).

## Gewenst gedrag

- De directie geeft een gebruiker het recht Leerlingzorg, en neemt het weer af, op dezelfde plaats waar ze themabeheer
  geeft (E6-04, FR-12.2).
- Wie Leerlingzorg heeft, **leest elk ontwikkelingsrapport** van elke K3-klas, ook van vorige schooljaren die nog
  bewaard zijn.
- Met alleen Leerlingzorg:
  - wijzigt die niets en vraagt die geen AI-herwerking;
  - downloadt die geen rapport (D5);
  - ziet die de tab Ontwikkelingsrapport (D18).
- Een zorgcoördinator heeft het recht omdat de directie het gaf, niet door een titel. Er is geen aparte rol.
- Themabeheer geeft geen toegang tot de rapporten (R18).
- Heeft een leerkracht ook Leerlingzorg, dan houdt die voor de eigen klas de gewone rechten.

**Bindend:** Art. VI.1 (het vijfde recht) en VI.7, ADR-0035 §3.3 en §3.4, en de rechten van ADR-0030 §3, afgedwongen op
de server op de ene plaats van E6-02.

## Acceptatiecriteria

- [x] Gegeven de directie, wanneer die een gebruiker het recht Leerlingzorg geeft, dan staat dat recht bij die gebruiker, naast themabeheer, en kan de directie het weer afnemen.
- [x] Gegeven een gebruiker met alleen Leerlingzorg, wanneer die zich aanmeldt, dan ziet die de tab Ontwikkelingsrapport en kan die de rapporten van elke K3-klas lezen.
- [x] Gegeven die gebruiker, dan kan die niets wijzigen, geen AI-herwerking vragen en geen rapport downloaden, ook niet via het adres.
- [x] Gegeven een gebruiker met alleen themabeheer, dan ziet die de tab niet en kan die geen enkel rapport lezen, ook niet via het adres.
- [x] Gegeven dat de directie het recht afneemt, wanneer de gebruiker de app opnieuw laadt, dan is de tab weg en weigert de app de rapporten.

## Testscenario's

1. Meld aan als directie. Geef in het beheer van rechten een testgebruiker het recht Leerlingzorg.
2. Meld aan als die testgebruiker. De tab Ontwikkelingsrapport staat er. Het rapport van "Fien Proefmans" in de ene
   K3-klas en dat van een kind in een andere K3-klas zijn te lezen.
3. Er is geen veld om te wijzigen, geen knop om te herwerken en geen knop om te downloaden. Plak het adres van een
   download: de app weigert.
4. Meld aan als een gebruiker met alleen themabeheer. De tab staat er niet. Plak het adres van een rapport: de app
   weigert.
5. Meld aan als directie en neem het recht Leerlingzorg af. Meld aan als de testgebruiker: de tab is weg, en het adres
   van een rapport wordt geweigerd.

## Buiten scope

- Downloaden voor Leerlingzorg (D5). Dat werd voor dit recht niet beslist, en wordt een ticket als de school erom vraagt.
- Andere rechten voor Leerlingzorg, zoals op thema's of op de planning.
- Een aparte rol zorgcoördinator.

## Open vragen

Geen.

## Werklog

- 2026-09-14 14:39 · rapport-tickets · aangemaakt (status nieuw)
- 2026-09-15 18:27 · eigenaar · nieuw → klaar-voor-bouw: eigenaar zet het ticket klaar voor bouw
- 2026-09-15 18:27 · leerlingzorg · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-15 18:44 · leerlingzorg · recht Leerlingzorg gebouwd: kolom op de leesrij van het rapport, vinkje in het Rechtenblad, eigen lijst /api/rapportklassen; unittests groen (1702)
- 2026-09-15 18:46 · leerlingzorg · frontend groen: pnpm lint en Vitest (81 bestanden, 889 tests)
- 2026-09-15 18:55 · leerlingzorg · backend groen: unittests 1702, integratietests op PostgreSQL 523 geslaagd (1 live-KOV overgeslagen), incl. sweep met een gebruiker met alleen Leerlingzorg; dotnet format schoon
- 2026-09-15 18:59 · leerlingzorg · browserpas: geen browser beschikbaar voor de sessie (Playwright bezet, Chrome-extensie niet verbonden); de eigenaar loopt de testscenario's zelf door op een wegwerpdatabank
- 2026-09-15 19:03 · leerlingzorg · antagonist ronde 1: COMPLIANT, geen CRITICAL of MAJOR; drie MINOR, waarvan twee opgelost (commentaar, test hoofdleerkracht K3)
- 2026-09-15 19:07 · leerlingzorg · derde MINOR als test opgelost: RapportleesrijTests laat de leesrij van het rapport alleen op de twee leesroutes toe, zodat FB-006 er geen download mee kan openen (D5)
- 2026-09-15 19:11 · leerlingzorg · in-uitvoering → te-testen: recht Leerlingzorg gebouwd; alle vijf criteria afgevinkt: tests (unit, PostgreSQL, Vitest) en de browserpas van de eigenaar; antagonist COMPLIANT, drie MINOR opgelost
- 2026-09-15 19:37 · leerlingzorg · main (FB-020) ingemerged, migratie AddLeerlingzorg opnieuw aangemaakt; daarna groen: unit 1703, PostgreSQL 527 van 528 (de ene is een bestaande flaky test uit FB-013, los van dit ticket), Vitest 907, lint en format schoon
- 2026-09-15 19:38 · leerlingzorg · PR #95
