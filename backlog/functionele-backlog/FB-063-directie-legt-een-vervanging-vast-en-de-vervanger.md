---
id: FB-063
titel: Directie legt een vervanging vast, en de vervanger kijkt tijdelijk mee in de klas
soort: functioneel
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 18:11
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-12.2]
---

## Aanleiding

De eigenaar besliste op 2026-09-18, in een sparring over een agentische uitbreiding, dat de Jaarplanner een AI-agent
krijgt die op de agenda van de kleuterleerkracht leeft en planlast vermindert, gepersonifieerd als een dikke oranje
gestreepte kat. De agent is de interface, niet de motor. De grondwet en de ADR's komen in TB-056.

Wanneer een leerkracht wegvalt, komt er een vervanger die de klas niet kent. De app kent vandaag geen vervanging: een
klastoewijzing heeft geen datums, dus directie moet de vervanger met de hand toevoegen en later weer verwijderen, en
niemand ziet dat het om een vervanging gaat.

**Beslissingen van de eigenaar, 2026-09-18:** directie legt de vervanging vast; de vervanger krijgt alleen een melding
in de app, geen mail. In TB-056 besliste de eigenaar: **de vervanger leest alleen**, ze wijzigt en beslist niets; de
vaste klasleerkracht zet de agenda achteraf recht; een vervanger is een gewone gebruiker van de Entra-tenant van de
school ([ADR-0057](../../docs/adr/0057-vervanging-briefing-en-klasfiche.md)).

## Gewenst gedrag

- Directie legt onder Beheer een vervanging vast: de afwezige leerkracht, de klas (een of meer van haar klassen), een
  begindatum, een einddatum (mag open blijven) en de vervanger, een bestaande gebruiker.
- Tussen begin- en einddatum **leest** de vervanger de planning van die klas (jaarplan, agenda, dekking), de klasfiche,
  de lesvoorbereidingen en haar briefing. Ze wijzigt niets: geen agenda, geen hoeken, geen fiches, geen voorbereiding.
- De afwezige leerkracht behoudt haar rechten, en zet de agenda achteraf recht.
- Directie ziet een lijst van de lopende en komende vervangingen, kan de einddatum aanpassen, een vervanging vroeger
  beëindigen, en een vervanging die nog niet gestart is verwijderen.
- De vervanger ziet in de app welke klas ze vervangt en tot wanneer.

## Acceptatiecriteria

- [ ] Gegeven een vervanging van maandag tot vrijdag, wanneer de vervanger op maandag aanmeldt, dan leest ze de agenda
  van die klas; vanaf zaterdag niet meer, tenzij ze de klas ook op een andere manier mag inkijken.
- [ ] Gegeven een lopende vervanging, dan kan de vervanger niets in de agenda, de hoeken, de fiches of de klasfiche
  wijzigen, ook niet rechtstreeks via de API.
- [ ] Gegeven een vervanging die nog niet gestart is, dan leest de vervanger die klas nog niet.
- [ ] Gegeven een vervanging zonder einddatum, dan blijft de vervanger lezen tot directie ze beëindigt.
- [ ] Gegeven een lopende vervanging, dan behoudt de afwezige leerkracht haar rechten op de klas.
- [ ] Gegeven een gebruiker zonder directierecht, dan kan ze geen vervanging vastleggen of wijzigen, ook niet
  rechtstreeks via de API.
- [ ] Gegeven de vervanger, dan ziet ze bij de klas "Vervanging tot ..." of "Vervanging, zonder einddatum".

## Testscenario's

1. Meld aan als directie. Open Beheer, Vervangingen, en leg een vervanging vast voor een K3-klas, van vandaag tot
   vrijdag, met een andere gebruiker als vervanger. Ze staat in de lijst als lopend.
2. Meld aan als die vervanger. De K3-klas staat bij je klassen met "Vervanging tot" en de datum. Je ziet de agenda,
   maar je kan niets verslepen, toevoegen of weghalen.
3. Meld aan als de afwezige leerkracht. Je hebt de klas nog en kan de agenda bewerken.
4. Meld aan als directie en beëindig de vervanging vandaag. Meld aan als de vervanger: vanaf morgen zie je de klas niet
   meer.
5. Leg een vervanging vast die volgende week start. Meld aan als die vervanger: je ziet de klas nog niet.

## Buiten scope

- De briefing (FB-065) en de terugkeerbriefing (FB-066).
- Een mail of een andere melding buiten de app.
- Gebruikers aanmaken: dat bestaat al. Een gastaccount voor een interimaris zonder schoolaccount.

## Open vragen

- Hangt af van TB-056 (Art. VI.1 en ADR-0057).

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
- 2026-09-18 18:11 · claude-tb056 · tekst bijgewerkt na TB-056: de vervanger leest alleen en beslist niets (ADR-0057)
