---
id: FB-037
titel: Leerkracht klikt in de agenda op een thema of subthema en komt op de themapagina
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 19:30
opgepakt-door: stroken-doorklik
branch: ticket/FB-037-stroken-doorklik
pr:
geblokkeerd:
fr: [FR-6.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"in de agenda wil ik op thema en subthema kunnen klikken om naar de detailpagina te
navigeren hiervan"*. De agenda toont bovenaan elke dag een strook met het thema en een strook met het subthema dat
loopt. Die stroken reageren vandaag niet op een klik: wie de uitwerking van het thema of subthema wil zien, moet via het
menu Thema's zoeken.

**Beslissingen van de eigenaar, 2026-09-15:**

- een subthema heeft geen eigen pagina; een klik op een subthema opent de **themapagina van zijn thema**, met dat
  subthema **opengeklapt en in beeld**;
- de **stroken zelf** worden aanklikbaar, in de week-, dag- en maandweergave;
- wie met het toetsenbord of een schermlezer werkt, vindt dezelfde sprong in de subthemabalk boven het tijdraster;
- dit vervangt beslissing 5 van ADR-0026 (de stroken bleven daar bewust decoratief); een nieuwe ADR legt dat vast.

## Gewenst gedrag

- In de agenda klikt de leerkracht op de themastrook van een dag. De themapagina van dat thema opent.
- Ze klikt op de subthemastrook. De themapagina van het bovenliggende thema opent, met dat subthema opengeklapt en in
  beeld; de andere subthema's blijven ingeklapt.
- Dat werkt op elke dag van de strook, niet alleen op de dag waar de naam staat, en in de week-, dag- en
  maandweergave.
- Wie met het toetsenbord werkt, bereikt dezelfde themapagina's vanuit de subthemabalk boven het tijdraster, zonder een
  extra tabstop per dag.
- Een periode zonder thema heeft niets om naar te gaan: die strook blijft zoals ze is.
- Met de terugknop van de browser staat de leerkracht weer op dezelfde plek in de agenda.

## Acceptatiecriteria

- [ ] Gegeven een week waarin een thema loopt, wanneer de leerkracht op de themastrook van eender welke dag klikt, dan
  opent de themapagina van dat thema.
- [ ] Gegeven een week waarin een subthema loopt, wanneer de leerkracht op de subthemastrook klikt, dan opent de
  themapagina van het bovenliggende thema met dat subthema opengeklapt en in beeld, en de andere subthema's ingeklapt.
- [ ] Gegeven de maandweergave en de dagweergave, dan werkt de klik op beide stroken daar ook.
- [ ] Gegeven een leerkracht die alleen het toetsenbord gebruikt, dan bereikt ze vanuit de subthemabalk de themapagina
  van het thema en van het subthema, en krijgen de stroken per dag geen eigen tabstop.
- [ ] Gegeven een periode zonder thema, dan is die strook niet aanklikbaar.
- [ ] Gegeven de themapagina die zo geopend werd, wanneer de leerkracht op de terugknop van de browser drukt, dan staat
  ze weer in dezelfde week van de agenda.

## Testscenario's

1. Open de agenda van een klas in een week waarin een thema en een subthema lopen.
2. Klik op de themastrook van woensdag. De themapagina van dat thema opent.
3. Druk op de terugknop van de browser. Je staat weer in dezelfde week.
4. Klik op de subthemastrook van donderdag. De themapagina opent; het subthema is opengeklapt en staat in beeld, de
   andere subthema's zijn ingeklapt.
5. Schakel naar de maandweergave en herhaal stap 2 en 4 op een andere dag. Doe hetzelfde in de dagweergave.
6. Ga terug naar de week. Druk op Tab tot je in de subthemabalk bent: je bereikt er de themapagina van het thema en
   van het subthema, en de stroken per dag slaat Tab over.
7. Open een week in een periode zonder thema. Klikken op die strook doet niets.
8. Herhaal stap 2 en 4 op ~390px.

## Buiten scope

- Een eigen detailpagina per subthema.
- Wat een klik op een rij van de subthemabalk vandaag al doet (de hoekverrijkingen openen, FB-020) blijft zoals het is.
- Streefwoordenschat op het subthema (E10-01).

## Open vragen

Geen.

## Werklog

- 2026-09-15 19:27 · eigenaar · aangemaakt (status nieuw)
- 2026-09-15 19:29 · eigenaar · nieuw → klaar-voor-bouw: op klaar-voor-bouw gezet door de eigenaar (in sessie, 2026-09-15)
- 2026-09-15 19:30 · stroken-doorklik · klaar-voor-bouw → in-uitvoering: opgepakt
