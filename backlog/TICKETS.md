# Tickets: de functionele en de technische backlog

Naast de epics (`E0`–`E10`) heeft de backlog twee mappen met **tickets**: losse werkitems in een vaste structuur,
die een lokaal kanbanbord uitleest. Het besluit en de afwegingen staan in
[ADR-0033](../docs/adr/0033-ticketbacklog-en-kanbanbord.md). Deze pagina is de handleiding.

> De epics blijven bestaan en worden daar afgewerkt. **Nieuw werk komt via tickets.** Een story `E<n>-<nn>` is geen
> ticket en krijgt er ook geen: wie aan een story werkt, volgt de `jaarplan-build`-flow zoals voorheen. Een nieuwe
> story mag alleen nog als vervolg binnen een epic die nog loopt, voor werk dat die epic nodig heeft om af te raken;
> al het andere nieuwe werk wordt een ticket.

## Twee soorten

| | Functioneel (FB) | Technisch (TB) |
| --- | --- | --- |
| Map | `backlog/functionele-backlog/` | `backlog/technische-backlog/` |
| Wie maakt het aan | de functioneel architect of tester | een agent-sessie, wanneer de eigenaar zelf een verbetering start die nog geen ticket heeft |
| Waar | rechtstreeks op `main` | op de branch van het werk zelf |
| Eerste status | `nieuw` (of `klaar-voor-bouw` als het al verfijnd is) | meestal meteen `in-uitvoering` |
| Eindstatus van de agent | `te-testen` | `klaar` |
| Kleur op het bord | blauw, label *Functioneel* | oranjebruin, label *Technisch* |

## Het bestand

**Bestandsnaam:** `FB-012-korte-titel.md` of `TB-003-korte-titel.md`: het nummer met minstens drie cijfers, daarna
de titel in kleine letters met koppeltekens. **Een bestandsnaam verandert nooit meer**, ook niet als de titel wijzigt:
het bord volgt een ticket over branches heen via zijn bestandsnaam.

Maak een ticket nooit met de hand aan maar met `tickets.mjs new` (zie onder): dan klopt het nummer en staat de
structuur er al.

```markdown
---
id: FB-012
titel: Leerkracht kan een thema dupliceren
soort: functioneel
status: klaar-voor-bouw
prioriteit: middel
aangemaakt: 2026-09-13
bijgewerkt: 2026-09-13 14:20
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-7.2]
---

## Aanleiding

Een leerkracht die een thema van vorig jaar wil hergebruiken, moet het nu volledig opnieuw intikken.

## Gewenst gedrag

Vanuit het themabeheer kan een leerkracht een bestaand thema dupliceren ...

## Acceptatiecriteria

- [ ] Gegeven een thema met drie subthema's, wanneer ik het dupliceer, dan ...

## Testscenario's

1. Open Thema's, kies ...

## Buiten scope

Het dupliceren van doelkoppelingen.

## Open vragen

Geen.

## Werklog

- 2026-09-13 14:20 · Els · aangemaakt (status nieuw)
```

### De sleutels bovenaan

Alle sleutels staan er altijd, ook als ze leeg zijn. Een onbekende sleutel is een fout.

| Sleutel | Betekenis | Verplicht ingevuld |
| --- | --- | --- |
| `id` | `FB-012` of `TB-003`, gelijk aan het begin van de bestandsnaam | ja |
| `titel` | korte, duidelijke titel: dit is wat het bord toont (liefst onder 90 tekens) | ja |
| `soort` | `functioneel` (FB) of `technisch` (TB) | ja |
| `status` | zie *Statussen* | ja |
| `prioriteit` | `hoog`, `middel` of `laag` | ja |
| `aangemaakt` | datum `JJJJ-MM-DD` | ja |
| `bijgewerkt` | `JJJJ-MM-DD UU:MM` in Belgische tijd, bij **elke** wijziging bijgewerkt: het bord gebruikt dit om te kiezen welke versie de nieuwste is | ja |
| `opgepakt-door` | de sessie of persoon die eraan werkt | bij `in-uitvoering` |
| `branch` | de branch waarop het werk gebeurt | bij `in-uitvoering` |
| `pr` | het PR-nummer (`52`) of een link | nee |
| `geblokkeerd` | leeg, of de reden waarom het werk stilligt | nee |
| `fr` | lijst met FR-nummers uit de functionele analyse, bv. `[FR-7.2, FR-7.3]` | nee |

### De secties

Vaste namen, vaste volgorde, als `## Kop`. Geen andere `##`-koppen en geen `#`-kop (de titel staat bovenaan);
`###` binnen een sectie mag wel.

- **Functioneel:** Aanleiding, Gewenst gedrag, Acceptatiecriteria, Testscenario's, Buiten scope, Open vragen, Werklog.
- **Technisch:** Aanleiding, Voorgestelde wijziging, Acceptatiecriteria, Buiten scope, Open vragen, Werklog.

Elke sectie behalve het Werklog moet inhoud hebben; schrijf "Niets." of "Geen." als er echt niets te zeggen is.
Hulptekst tussen `<!--` en `-->` telt niet als inhoud en verschijnt niet op het bord. De **Acceptatiecriteria** zijn
een lijst met minstens één `- [ ]`-regel, elk controleerbaar door een tester. Het **Werklog** is de laatste sectie en
groeit alleen: één regel per gebeurtenis, `- JJJJ-MM-DD UU:MM · wie · wat`, en oude regels worden nooit aangepast.

## Statussen en kolommen

| Kolom op het bord | Status in het bestand | Wie zet ze |
| --- | --- | --- |
| Nieuw | `nieuw` | functioneel architect |
| Klaar voor bouw | `klaar-voor-bouw` | functioneel architect of de eigenaar, als het ticket verfijnd en afgesproken is |
| In uitvoering | `in-uitvoering` | de agent, in de eerste commit op zijn branch |
| In review | *(afgeleid)* | niemand: zie hieronder |
| Te testen | `te-testen` | de agent, in de laatste commit van zijn branch (alleen FB) |
| Klaar | `klaar` | de tester (FB), of de agent in zijn laatste commit (TB) |

**In review** is geen status die iemand schrijft. Het bord zet een kaart daar zolang de eindstatus van de agent
(`te-testen` of `klaar`) al op een branch of in een worktree staat, maar **nog niet op `main`**: het werk is af en wacht
op jouw merge. Na de merge en een `git pull` staat de status ook op `main` en schuift de kaart vanzelf door, ook als de
branch daarna nog een commit krijgt.

Toegestane overgangen (de CLI dwingt ze af):

- `nieuw` → `klaar-voor-bouw`, en voor een TB ook meteen → `in-uitvoering`
- `klaar-voor-bouw` → `in-uitvoering`, of terug naar `nieuw`
- `in-uitvoering` → `te-testen` (FB) of `klaar` (TB), of terug naar `klaar-voor-bouw` als de agent het teruggeeft
- `te-testen` → `klaar`, of terug naar `klaar-voor-bouw` met de bevinding in het werklog
- `klaar` → `klaar-voor-bouw` als een ticket heropend wordt

Wie een ticket terugzet naar `klaar-voor-bouw` of `nieuw`, maakt `opgepakt-door`, `branch` en `pr` leeg: de volgende
bouwronde begint opnieuw. Het werklog bewaart wat er gebeurd is.

De CLI weet niet wie hem aanroept. Dat een functioneel ticket alleen door de tester op `klaar` gezet wordt, is een
afspraak (skill `ticket-uitvoeren`), geen slot.

## Wie doet wat

- **Functioneel architect:** maakt tickets aan met de skill `ticket-aanmaken`, op `main`, in een eigen clone van de
  repo, en zet ze op `klaar-voor-bouw` als ze verfijnd zijn. Pas een ticket dat `in-uitvoering` is niet inhoudelijk
  aan: dat botst met de branch van de agent, en de CLI weigert het ook (zie onder). Aanvullingen worden een nieuw
  ticket, of worden eerst met de eigenaar besproken.
- **Agent-sessie:** werkt volgens de skill `ticket-uitvoeren`. Heeft het werk nog geen ticket en geen story, dan maakt
  de agent **eerst** een TB-ticket aan, vóór er een bestand verandert.
- **Functioneel tester:** test tickets in `te-testen` met de skill `ticket-testen` en zet ze op `klaar`, of terug naar
  `klaar-voor-bouw` met de bevinding.
- **Eigenaar:** merget, en kijkt op het bord.

Wie tickets aanmaakt of test in de gedeelde checkout `C:\source\Jaarplanner` terwijl er andere sessies lopen, claimt
eerst `maintree` in de groepschat voor een `git switch` of `git pull` daar. In een eigen clone speelt dat niet.

Lange verslagen (antagonist, testrapport, schermafbeeldingen) gaan zoals voorheen naar `backlog/worklogs/<id>/`;
het werklog in het ticket zelf houdt één regel per gebeurtenis.

**Geen leerlinggegevens en geen geheimen in een ticket.** Een ticket wordt gecommit en blijft in de geschiedenis van
de repo staan. En een ticket gaat nooit boven de grondwet: vraagt een wens iets wat `CONSTITUTION.md` verbiedt of wat
nog een open beslissing is, dan komt dat onder *Open vragen*, wordt het ticket geblokkeerd (`block`) en blijft het
liggen tot de eigenaar beslist.

## Het bord

Dubbelklik `tools/backlog-board/start-board.cmd`, of `node tools/backlog-board/server.mjs --open`. Het bord draait op
<http://localhost:5199>, alleen bereikbaar vanaf deze pc, en ververst zichzelf elke paar seconden.

Het leest, zonder iets te veranderen:

1. alle tickets op de lokale branch `main`;
2. van elke lokale branch die nog **niet** in `main` zit, de tickets die die branch gewijzigd heeft;
3. van elke worktree de tickets met wijzigingen die nog niet gecommit zijn.

Van alle versies van een ticket toont het de versie met de recentste `bijgewerkt`. Het bord doet zelf geen `fetch` of
`pull`: nieuwe tickets van de functioneel architect verschijnen zodra jij `main` binnentrekt, en werk van een sessie op
een andere pc pas als die branch lokaal staat. Een ticket dat de structuur niet volgt, verschijnt bovenaan in een rode
balk met de fout en staat niet op het bord tot het hersteld is.

## De opdrachten

Draai ze vanuit de map van je checkout; ze passen alleen bestanden aan en committen niets. De opdrachten en opties
zijn Engels, wat ze in het ticket schrijven is Nederlands.

| Opdracht | Wat het doet |
| --- | --- |
| `node tools/backlog-board/tickets.mjs list [--status <kolom>] [--kind FB\|TB]` | alle tickets zoals het bord ze ziet |
| `node tools/backlog-board/tickets.mjs check [bestand ...] [--all]` | controleert de structuur (in deze checkout, of met `--all` het hele bord) |
| `node tools/backlog-board/tickets.mjs next-id FB\|TB` | het volgende vrije nummer |
| `node tools/backlog-board/tickets.mjs new FB\|TB --title "..." --by <wie>` | nieuw ticket met de vaste structuur; opties `--priority`, `--status`, `--branch`, `--fr` |
| `node tools/backlog-board/tickets.mjs status <id> <status> --by <wie>` | status wijzigen; opties `--branch`, `--pr`, `--log "..."` |
| `node tools/backlog-board/tickets.mjs log <id> --by <wie> "..."` | een regel in het werklog |
| `node tools/backlog-board/tickets.mjs block <id> --by <wie> "reden"` / `unblock <id> --by <wie>` | geblokkeerd aan of uit |
| `node tools/backlog-board/tickets.mjs pr <id> <nummer> --by <wie>` | het PR-nummer invullen |

Elke wijziging via de CLI zet `bijgewerkt` en schrijft een werklogregel. **Een schrijfopdracht weigert als er elders
een nieuwere versie van het ticket staat** (op een andere branch of in een andere worktree): anders zou een regel op
een oude kopie de oude status weer de nieuwste maken. Pas het ticket dus aan waar het werk gebeurt. Wie een ticket
toch met de hand aanpast, moet `bijgewerkt` zelf bijwerken, anders kan een oudere versie op een andere branch het
halen.
