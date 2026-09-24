---
id: TB-081
titel: Stel mijn week voor staat in de navigatierij van de agenda
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-24
bijgewerkt: 2026-09-24 12:18
opgepakt-door: sessie-weekvoorstel-kop
branch: ticket/TB-weekvoorstel-in-kop
pr:
geblokkeerd:
fr: []
---

## Aanleiding

In de week- en werkweekweergave van de agenda staat "Stel mijn week voor" als grote AI-knop in een eigen strook tussen de dekkingsbalk en de agenda, met daaronder de lijst van open voorstellen. Die strook neemt veel plaats in en duwt de agenda naar onder. De eigenaar wil de knop hoger, in de navigatierij.

## Voorgestelde wijziging

- `Weekvoorstel` (`frontend/src/features/plan/Weekvoorstel.tsx`) verhuist van boven het tijdrooster naar de navigatierij van `Agendascherm`, direct na het weeklabel ("Week 39"). De AI-knop wordt compact (even hoog als "Vandaag") en houdt zijn regenboogring (ADR-0039).
- Zijn er open voorstellen op het scherm, dan staat ernaast een stille tellerknop ("3 voorstellen"). Die opent een uitklapvak met per voorstel dag, uur, naam, motivatie en de beslisknoppen (ADR-0051), en onderaan "Alles aanvaarden". Ook het resultaat van een vraag en een foutmelding staan in dat vak; na een vraag gaat het vanzelf open.
- Tussen de dekkingsbalk en de agenda staat niets meer van het weekvoorstel.
- Waar de navigatierij geen plaats heeft voor tekst naast de weergavekeuze (rij smaller dan 68rem: laptops en gsm), toont de AI-knop alleen de toverstaf (met toegankelijke naam en tooltip) en de teller alleen het getal, zodat de weergavekeuze niet naar een tweede regel springt wanneer er voorstellen verschijnen (eigenaar, 2026-09-24). Op een gsm neemt het uitklapvak de volle breedte.
- Teksten in `frontend/src/i18n/nl.json`; `Weekvoorstel.test.tsx` bijgewerkt.

## Acceptatiecriteria

- [x] Gegeven de werkweekweergave van een klas die ik mag plannen, wanneer ik de agenda open, dan staat "Stel mijn week voor" in de navigatierij naast het weeklabel en begint de agenda direct onder de dekkingsbalk.
- [x] Gegeven open voorstellen in de getoonde week, wanneer ik op de tellerknop klik, dan zie ik per voorstel dag, uur, naam en motivatie, kan ik het aanvaarden of weigeren, en kan ik alles aanvaarden.
- [x] Gegeven ik vraag een weekvoorstel, wanneer het antwoord er is, dan opent het uitklapvak met het resultaat of de foutmelding.
- [x] Gegeven de dag-, maand- of jaarweergave, of een klas die ik niet mag plannen, dan staat de knop er niet.
- [x] Gegeven een scherm van ~390px breed, dan past de navigatierij zonder horizontaal scrollen, heeft de icoonknop een toegankelijke naam en is het uitklapvak leesbaar.

## Buiten scope

Wat het weekvoorstel voorstelt en hoe de server het maakt; de ring van voorgestelde blokken in het rooster.

## Open vragen

Geen.

## Werklog

- 2026-09-24 12:01 · sessie-weekvoorstel-kop · aangemaakt (status in-uitvoering)
- 2026-09-24 12:18 · sessie-weekvoorstel-kop · Knop en tellerknop in de navigatierij, voorstellen in een Radix-popover; eigenaar koos inkrimpen via container query onder 68rem. Browserpas (mock) op 1627/1440/1280/390px: agenda direct onder de dekkingsbalk, rij springt niet bij voorstellen, geen horizontale scroll op gsm; Weekvoorstel.test.tsx en pnpm lint groen (1393 tests).
