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
| Wie maakt het aan | de functioneel architect | een agent-sessie, wanneer de eigenaar zelf een verbetering start die nog geen ticket heeft |
| Waar | rechtstreeks op `main` | op de branch van het werk zelf |
| Eerste status | altijd `nieuw`; de eigenaar zet het verder | meestal meteen `in-uitvoering` |
| Eindstatus van de agent | `te-testen` | `klaar` |
| Kleur op het bord | blauw, label *Functioneel* | oranjebruin, label *Technisch* |

## Het bestand

**Bestandsnaam:** `FB-012-korte-titel.md` of `TB-003-korte-titel.md`: het nummer met minstens drie cijfers, daarna
de titel in kleine letters met koppeltekens. **Een bestandsnaam verandert nooit meer**, ook niet als de titel wijzigt:
het bord volgt een ticket over branches heen via zijn bestandsnaam. Eén uitzondering: krijgen twee tickets hetzelfde
nummer (twee clones die tegelijk een ticket aanmaakten), dan krijgt het jongste een nieuw nummer via `next-id`: hernoem
het bestand en pas `id` aan, zolang niemand het opgepakt heeft. Haal `main` binnen vlak voor `new` en push meteen
daarna, dan gebeurt het bijna nooit.

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
een lijst met minstens één `- [ ]`-regel, elk controleerbaar bij een test. Het **Werklog** is de laatste sectie en
groeit alleen: één regel per gebeurtenis, `- JJJJ-MM-DD UU:MM · wie · wat`, en oude regels worden nooit aangepast.

## Statussen en kolommen

| Kolom op het bord | Status in het bestand | Wie zet ze |
| --- | --- | --- |
| Nieuw | `nieuw` | functioneel architect, bij het aanmaken |
| Klaar voor bouw | `klaar-voor-bouw` | de eigenaar, als het ticket verfijnd en afgesproken is |
| In uitvoering | `in-uitvoering` | de agent, in de eerste commit op zijn branch |
| In review | *(afgeleid)* | niemand: zie hieronder |
| Te testen | `te-testen` | de agent, in de laatste commit van zijn branch (alleen FB) |
| Klaar | `klaar` | de eigenaar, na de test van de functioneel architect (FB), of de agent in zijn laatste commit (TB) |

**In review** is geen status die iemand schrijft. Het bord zet een kaart daar zolang de eindstatus van de agent
(`te-testen` of `klaar`) al op een branch of in een worktree staat, maar **nog niet op `main`**: het werk is af en wacht
op jouw merge. Na de merge en een `git pull` staat de status ook op `main` en schuift de kaart vanzelf door.

Toegestane overgangen (de CLI dwingt ze af):

- `nieuw` → `klaar-voor-bouw`, of meteen → `in-uitvoering` (een TB bij het aanmaken; elk ticket wanneer de eigenaar
  in de sessie zegt dat hij het wil starten, met die vrijgave in `--log`, die de CLI dan verplicht)
- `klaar-voor-bouw` → `in-uitvoering`, of terug naar `nieuw`
- `in-uitvoering` → `te-testen` (FB) of `klaar` (TB), of terug naar `klaar-voor-bouw` als de agent het teruggeeft
- `te-testen` → `klaar`, of terug naar `klaar-voor-bouw` met de bevinding in het werklog
- `klaar` → `klaar-voor-bouw` als een ticket heropend wordt

Wie een ticket terugzet naar `klaar-voor-bouw` of `nieuw`, maakt `opgepakt-door`, `branch` en `pr` leeg: de volgende
bouwronde begint opnieuw. Het werklog bewaart wat er gebeurd is. Een **geblokkeerd** ticket wordt niet opgepakt en
niet teruggegeven: de sessie die het vasthoudt, houdt het tot de vraag beantwoord is.

De CLI weet niet wie hem aanroept. Wie welke status zet, is een afspraak (zie *Wie doet wat*), geen slot.

## Wie doet wat

*(Beslissingen van de eigenaar, 2026-09-13.)* Het bord en de agent-sessies draaien alleen op de pc van de eigenaar. De
functioneel architect maakt tickets aan en test ze; de eigenaar zet hun status. De agent-sessies zetten hun eigen
statussen op hun branch (oppakken, te testen, teruggeven).

- **Functioneel architect:** maakt tickets aan met de skill `ticket-aanmaken`, op `main`, in een eigen clone van de
  repo, en pusht ze. Een ticket begint altijd als `nieuw`. De architect wijzigt **geen status**, en mag de tekst van
  een ticket aanscherpen zolang het `nieuw` is, na een `git pull`; een sessie kan het dan al vasthouden als de eigenaar
  het meteen liet starten, dus bij twijfel eerst de eigenaar vragen. Heeft de eigenaar het intussen op
  `klaar-voor-bouw` gezet maar nog niet gepusht, dan botst dat bij de volgende pull als merge-conflict op dat ene
  ticket: houd dan de status van de eigenaar en de tekst van de architect. De architect **test** functionele tickets
  in `te-testen` en meldt het resultaat aan de eigenaar.
- **Eigenaar:** zet tickets op `klaar-voor-bouw`, of zegt in een sessie dat hij een ticket op `nieuw` wil starten
  (dan pakt de sessie het meteen op), verwerkt de test van de architect met de skill `ticket-testen` (naar
  `klaar`, of terug naar `klaar-voor-bouw` met de bevinding), merget, en kijkt op het bord. Elke statuswijziging
  commit hij meteen op `main`, zodat de sessies ze zien, met twee uitzonderingen die op de branch zelf gebeuren: een
  `release` van een gestopte sessie en het terugzetten van een PR die hij niet merget (zie *De opdrachten*). Omdat dat en het werk van
  de sessies op zijn pc gebeurt, ziet de CLI daar elke branch en worktree.
- **Agent-sessie:** werkt volgens de skill `ticket-uitvoeren`, op de pc van de eigenaar. Heeft het werk nog geen
  ticket en geen story, dan maakt de agent **eerst** een TB-ticket aan, vóór er een bestand verandert.

Sessies werken elk in hun eigen worktree onder `.claude/worktrees/`. Een `git switch` of `git pull` in de gedeelde
checkout `C:\source\Jaarplanner` stoort ze dus niet; alleen een dev-server die vanuit die checkout draait, ziet de
wijziging.

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
`pull`: nieuwe tickets van de functioneel architect verschijnen zodra jij `main` binnentrekt. Een ticket dat de
structuur niet volgt, verschijnt bovenaan in een rode balk met de fout en staat niet op het bord tot het hersteld is.

## De opdrachten

Draai ze vanuit de map van je checkout; ze passen alleen bestanden aan en committen niets. De opdrachten en opties
zijn Engels, wat ze in het ticket schrijven is Nederlands.

| Opdracht | Wat het doet |
| --- | --- |
| `node tools/backlog-board/tickets.mjs list [--status <kolom>] [--kind FB\|TB]` | alle tickets, ook op opgehaalde remote branches, met wie ze vasthoudt en of ze geblokkeerd zijn |
| `node tools/backlog-board/tickets.mjs check [bestand ...] [--all]` | controleert de structuur (in deze checkout, of met `--all` het hele bord) |
| `node tools/backlog-board/tickets.mjs next-id FB\|TB` | het volgende vrije nummer |
| `node tools/backlog-board/tickets.mjs new FB\|TB --title "..." --by <wie>` | nieuw ticket met de vaste structuur; opties `--priority`, `--status`, `--branch`, `--fr` |
| `node tools/backlog-board/tickets.mjs status <id> <status> --by <wie>` | status wijzigen; opties `--branch`, `--pr`, `--log "..."` |
| `node tools/backlog-board/tickets.mjs log <id> --by <wie> "..."` | een regel in het werklog |
| `node tools/backlog-board/tickets.mjs block <id> --by <wie> "reden"` / `unblock <id> --by <wie>` | geblokkeerd aan of uit |
| `node tools/backlog-board/tickets.mjs pr <id> <nummer> --by <wie>` | het PR-nummer invullen, vóór de merge |
| `node tools/backlog-board/tickets.mjs release <id> --by eigenaar --log "reden"` | alleen de eigenaar: een ticket vrijgeven waarvan de sessie gestopt is |

Elke wijziging via de CLI zet `bijgewerkt` en schrijft een werklogregel. Voor ze iets schrijft, kijkt ze of er elders
een **nieuwere** versie van het ticket staat: een versie die alle werklogregels van deze checkout heeft, en meer. Een
versie die afgesplitst is (elk heeft regels die de andere mist, zoals een teruggegeven ticket op een branch die nooit
gemerged werd) telt niet mee zolang ze echt teruggegeven is (`klaar-voor-bouw` of `nieuw`, niet geblokkeerd) of haar
afgewerkte werk al op `main` staat; de CLI noemt ze dan alleen. Houdt ze het ticket nog vast, draagt ze een
blokkering, of wacht haar afgewerkte werk nog op de merge, dan telt ze wel. Een versie die helemaal vervat zit in een
andere zichtbare versie (een oude gepushte kopie van een branch die lokaal al verder is) telt niet mee. Een versie op `main` is nooit afgesplitst: loop je op
`main` achter, dan haal je main eerst binnen, en zeker vóór je een ticket oppakt. Zegt een nieuwere versie iets
anders over het ticket (een
andere status, een andere houder, een blokkering), dan weigert de CLI en zegt ze wat het oplost:

- de nieuwere versie is nog niet gecommit (bijvoorbeeld een wijziging van de eigenaar in zijn checkout van `main`):
  eerst committen;
- de nieuwere versie staat op `main`: haal main binnen in je branch (`git merge main`);
- ze staat op de remote van je eigen branch: `git pull`;
- ze staat op een andere branch of worktree: daar wordt het ticket bewerkt; wacht op de merge, of vraag de eigenaar;
- ze staat op een remote branch die op de server al verwijderd is: `git fetch --prune`; is ze daar alleen verouderd
  (het ticket werd lokaal teruggegeven of vrijgegeven), push die branch dan.

Geeft `git merge main` een conflict in het ticketbestand, neem dan alle werklogregels van beide kanten, in volgorde van
tijd, en de tekst van `main`. Voor de frontmatter kijk je naar de versie van je branch: houdt die het ticket vast
(`in-uitvoering`, door wie ook) of is ze geblokkeerd, houd dan `status`, `opgepakt-door`, `branch`, `geblokkeerd` en
`pr` van je branch; anders de frontmatter van `main`. Dat geldt ook voor de eigenaar die een `release` doet. De melding
van de CLI zegt welk van de twee geldt. Een teruggave of vrijgave telt pas als
ze gecommit is; op een branch die al gepusht is, push je ze ook.

Merget de eigenaar een PR niet, dan wacht het afgewerkte werk op een merge die niet komt: hij zet het ticket in een
checkout van die branch terug naar `klaar-voor-bouw` en commit dat daar, of hij verwijdert de branch, waarna de versie
op `main` weer geldt.

De CLI neemt zelf nooit een versie over; dat doet git, zodat een latere merge klopt. Een nieuwere versie met dezelfde
status houdt niemand tegen, maar de CLI noemt ze en toont haar laatste werklogregel (bijvoorbeeld de notitie van een
sessie die het ticket teruggaf). Na de merge schrijf je een ticket op `main`, niet meer op de branch: zet het
PR-nummer er dus vóór de merge in. Een ticket in uitvoering wijzigt alleen de sessie die het vasthoudt, en een
ticket pak je nooit op `main` op. Een teruggegeven TB-ticket leeft op zijn branch tot die gemerged is: wie het
oppakt, werkt op die branch verder.

Een ticket dat een sessie vasthoudt, wijzigt de eigenaar niet: hij vraagt de sessie in haar eigen venster om het te
blokkeren of terug te geven (beslissing van de eigenaar, 2026-09-13). Is die sessie gestopt, dan geeft hij het vrij
met `release`, in een checkout van haar branch (is de worktree al weg: `git worktree add <map> <branch>`), en commit
dat. Daarna kan hij haar werk opruimen: `git worktree remove` voor een worktree (wat daar niet gecommit is, gaat
verloren), anders `git branch -D`. `release` is de enige manier waarop een **geblokkeerd** ticket zijn houder
verliest: de blokkering blijft op die branch staan en houdt het ticket tegen tot de eigenaar de vraag beantwoordt en
het daar deblokkeert (`unblock`). Ruimt hij de branch op terwijl de vraag nog open is, dan zet hij de blokkering
daarna op `main` (`block`), anders gaat ze verloren. Wie een ticket toch met de hand aanpast, schrijft er ook een
werklogregel bij en werkt `bijgewerkt` bij: zonder werklogregel ziet de controle de wijziging niet, en zonder
`bijgewerkt` kan een oudere versie het op het bord halen.
