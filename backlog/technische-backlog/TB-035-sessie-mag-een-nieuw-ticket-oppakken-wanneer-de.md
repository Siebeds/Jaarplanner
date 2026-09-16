---
id: TB-035
titel: Sessie mag een nieuw ticket oppakken wanneer de eigenaar zegt dat hij wil starten
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 20:27
opgepakt-door: nieuw-starten
branch: ticket/TB-nieuw-starten
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Een sessie mag vandaag alleen een ticket oppakken dat op `klaar-voor-bouw` staat. Staat het op `nieuw`, dan moet ze de
eigenaar eerst vragen of het naar `klaar-voor-bouw` mag, en de CLI weigert een functioneel ticket rechtstreeks van
`nieuw` naar `in-uitvoering`. In de praktijk zegt de eigenaar in de sessie gewoon dat hij wil starten: dan zijn die
extra vraag en die tussenstap op `main` overbodig.

## Voorgestelde wijziging

De regel versoepelen: zegt de eigenaar in de sessie dat hij een ticket op `nieuw` wil starten, dan pakt de sessie het
meteen op (`nieuw` → `in-uitvoering`), met de vrijgave van de eigenaar in het werklog.

- `tools/backlog-board/lib/format.mjs`: de overgang `nieuw` → `in-uitvoering` ook voor FB toestaan.
- `tools/backlog-board/tickets.mjs`: vanuit `nieuw` is `--log` verplicht bij het oppakken (de vrijgave van de eigenaar).
- `.claude/skills/ticket-uitvoeren/SKILL.md` stap 1, `backlog/TICKETS.md` (overgangen en *Wie doet wat*) en
  ADR-0033 beslissing 10.
- Tests in `tools/backlog-board/test/`.

## Acceptatiecriteria

- [ ] Gegeven een FB-ticket op `nieuw`, wanneer een sessie op haar branch `status FB-nnn in-uitvoering --by <sessie>
  --log "..."` uitvoert, dan staat het ticket op `in-uitvoering` met die sessie als houder.
- [ ] Gegeven een ticket op `nieuw`, wanneer die opdracht zonder `--log` loopt, dan weigert de CLI en vraagt om de
  vrijgave van de eigenaar in `--log`.
- [ ] Gegeven een ticket op `nieuw` waarvan de eigenaar niet gezegd heeft dat hij het wil starten, dan vraagt de sessie
  het eerst (skill `ticket-uitvoeren` stap 1).
- [ ] `backlog/TICKETS.md` en ADR-0033 beschrijven de nieuwe overgang; de tests van de tool zijn groen.

## Buiten scope

Een geblokkeerd ticket wordt nog altijd niet opgepakt. "Neem het volgende ticket" kiest nog altijd alleen uit
`klaar-voor-bouw`.

## Open vragen

Geen.

## Werklog

- 2026-09-16 20:27 · nieuw-starten · aangemaakt (status in-uitvoering)
