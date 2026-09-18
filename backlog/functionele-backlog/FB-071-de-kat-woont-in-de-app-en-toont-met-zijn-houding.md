---
id: FB-071
titel: De kat slaapt rechtsboven in een mandje en opent bij een klik zijn venster
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:45
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar besliste op 2026-09-18, in een sparring over een agentische uitbreiding, dat de Jaarplanner een AI-agent
krijgt die op de agenda van de kleuterleerkracht leeft en planlast vermindert, gepersonifieerd als een dikke oranje
gestreepte kat. De agent is de interface, niet de motor. De grondwet en de ADR's komen in TB-056.

Een kat is proactief maar niet dienstbaar. Dat past bij een agent die de leerkracht niet mag overspoelen: hij komt en
gaat, brengt af en toe iets, en zijn houding zegt of er iets is. Geen badges, geen rode bolletjes.

**Beslissingen en uitgangspunten van de eigenaar, 2026-09-18:** charmant in gedrag, volwassen in inhoud, nooit
babytaal; meldingen alleen in de app, hooguit enkele momenten per dag; de kat wordt voorgelegd aan de onderwijsadviseur
voor hij centraal in de huisstijl komt.

**Aangevuld door de eigenaar, 2026-09-18:** de kat ligt standaard rechtsboven in een mandje te slapen. Klik je op hem,
dan staat hij recht, zet hij een paar stappen en opent hij een venster waarin je met hem kan babbelen. Dat venster is
ook de deurmat: bovenaan wat hij meebracht, daaronder de chat. De chat is die van FB-031 (uitleg en opzoekvragen) en
FB-032 (voorstellen), en die horen ook bij fase 1.

## Gewenst gedrag

- De kat ligt rechtsboven in de app in zijn mandje, voor de leerkracht, de vervanger en directie. Hij ligt nooit op de
  gegevens.
- Zijn houding toont de toestand, altijd met een zichtbaar label:
  - hij slaapt in zijn mandje: er ligt niets nieuws;
  - hij ligt in zijn mandje met zijn oren recht: er ligt iets klaar (een briefing, voorbereidingen, voorstellen);
  - hij ligt op de hoek van de weekstrook: een doel komt in gevaar (FB-069). Hij bedekt nooit de gegevens zelf;
  - hij spint: alle doelen van de klas liggen op schema.
- Wie op de kat klikt (of hem met het toetsenbord kiest), ziet hem rechtstaan, uit zijn mandje stappen en een paar
  stappen zetten naar het venster dat opent. Op telefoonbreedte wordt het venster een scherm over de volle breedte.
- Het venster toont bovenaan wat hij meebracht, elk met "Bekijken" en "Later", en daaronder de chat (FB-031, FB-032).
  In het venster staat zichtbaar dat namen en informatie over kinderen er niet in horen.
- Sluiten (ook met Escape) zet hem terug in zijn mandje, en de focus terug op de kat.
- Hij komt hooguit enkele momenten per dag uit zijn mandje uit zichzelf; wie minder beweging vraagt, ziet geen loopje:
  het venster opent meteen.
- Een voorstel dat hij brengt, draagt in de agenda de vage voorstelring (ADR-0051); een knop die de AI aanroept blijft een
  AI-knop (ADR-0039).
- In meldingen en in de chat praat hij gewoon, volwassen Nederlands, nooit babytaal. De charme zit in wat hij doet.
- Geen kat in exports of in het ontwikkelingsrapport.

## Acceptatiecriteria

- [ ] Gegeven geen open signaal of voorstel, dan slaapt de kat rechtsboven in zijn mandje, met een zichtbaar label.
- [ ] Gegeven een nieuw signaal, dan veranderen zijn houding en label; bij een doel in gevaar ligt hij op de hoek van de
  weekstrook, zonder gegevens te bedekken.
- [ ] Gegeven een klik op de kat, of Enter met de focus op hem, dan staat hij recht, stapt hij naar het venster, en toont
  dat venster bovenaan wat klaarligt (elk item te bekijken of uit te stellen) en daaronder de chat.
- [ ] Gegeven een open venster, wanneer de gebruiker Escape drukt of het sluit, dan ligt de kat terug in zijn mandje en
  staat de focus op hem.
- [ ] Gegeven "minder beweging", dan opent het venster zonder loopje en verandert de kat van houding zonder animatie.
- [ ] Gegeven elke houding, dan draagt ze ook tekst, en het contrast haalt WCAG 2.2 AA, gemeten in een echte browser.
- [ ] Gegeven een export of een ontwikkelingsrapport, dan staat er geen kat in.
- [ ] Bekeken in de echte app op desktop en op ongeveer 390px.

## Testscenario's

1. Meld aan als leerkracht zonder open signaal of voorstel. De kat slaapt rechtsboven in zijn mandje, met een label.
2. Laat een lesvoorbereiding klaarzetten (FB-068). De oren van de kat staan recht. Klik op hem: hij staat recht, stapt
   naar het venster, en dat toont bovenaan de voorbereiding met "Bekijken" en "Later", en daaronder de chat.
3. Stel in de chat een vraag over de tool (FB-031). Druk Escape: de kat ligt terug in zijn mandje.
4. Laat een doel in gevaar komen (FB-069). De kat ligt op de hoek van de weekstrook en de weekstrook blijft leesbaar.
5. Zet "minder beweging" aan in het besturingssysteem: het venster opent zonder loopje.
6. Herhaal op telefoonbreedte (ongeveer 390px): het venster vult de breedte.

## Buiten scope

- De signalen zelf: TB-057, FB-068, FB-069, FB-070.
- Wat de chat kan: FB-031 (uitleg en opzoekvragen) en FB-032 (voorstellen).
- De krabpaal als inbox, oudercommunicatie en evaluaties: niet in fase 1.

## Open vragen

- Oranje is bezet: de attentiekleur (`--color-attentie`), de AI-ring (`--color-ai-oranje`) en doelsoort A zijn oranje.
  Hoe krijgt de kat zijn vacht zonder als knelpunt gelezen te worden? Uit te werken met de skill `frontend-design`.
- Spreekt de kat in de chat in de ik-vorm, als kat, of neutraal?
- Een naam voor de kat?
- Kan een gebruiker de kat verbergen?
- Als hij iets verkeerd inschatte en de leerkracht weigert het, stoot hij dan iets om?
- De onderwijsadviseur keurt de kat goed voor hij centraal in de huisstijl komt.
- Hangt af van TB-056 (ADR van de kat) en TB-057; de chat van FB-031 en FB-032.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
