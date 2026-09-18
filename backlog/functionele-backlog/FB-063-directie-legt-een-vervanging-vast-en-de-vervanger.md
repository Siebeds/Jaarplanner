---
id: FB-063
titel: Directie legt een vervanging vast, en de vervanger krijgt tijdelijk de klas
soort: functioneel
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:45
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

**Beslissingen van de eigenaar, 2026-09-18:** directie legt de vervanging vast; de vervanger heeft voor die klas alle
rechten van een leerkracht; de vervanger krijgt alleen een melding in de app, geen mail.

## Gewenst gedrag

- Directie legt onder Beheer een vervanging vast: de afwezige leerkracht, de klas (een of meer van haar klassen), een
  begindatum, een einddatum (mag open blijven) en de vervanger, een bestaande gebruiker.
- Tussen begin- en einddatum heeft de vervanger voor die klas alle rechten van een leerkracht (Art. VI.1): de agenda,
  de (her)generatie, hoeken, algemene fiches, eigen activiteiten, AI-voorstellen vragen en beslissen.
- De afwezige leerkracht behoudt haar rechten.
- Directie ziet een lijst van de lopende en komende vervangingen, kan de einddatum aanpassen, een vervanging vroeger
  beëindigen, en een vervanging die nog niet gestart is verwijderen.
- De vervanger ziet in de app welke klas ze vervangt en tot wanneer.

## Acceptatiecriteria

- [ ] Gegeven een vervanging van maandag tot vrijdag, wanneer de vervanger op maandag aanmeldt, dan bewerkt ze de agenda
  van die klas; vanaf zaterdag niet meer, tenzij ze de klas ook op een andere manier heeft.
- [ ] Gegeven een vervanging die nog niet gestart is, dan heeft de vervanger nog geen rechten op die klas.
- [ ] Gegeven een vervanging zonder einddatum, dan blijven de rechten tot directie ze beëindigt.
- [ ] Gegeven een lopende vervanging, dan behoudt de afwezige leerkracht haar rechten op de klas.
- [ ] Gegeven een gebruiker zonder directierecht, dan kan ze geen vervanging vastleggen of wijzigen, ook niet
  rechtstreeks via de API.
- [ ] Gegeven de vervanger, dan ziet ze bij de klas "Vervanging tot ..." of "Vervanging, zonder einddatum".

## Testscenario's

1. Meld aan als directie. Open Beheer, Vervangingen, en leg een vervanging vast voor een K3-klas, van vandaag tot
   vrijdag, met een andere gebruiker als vervanger. Ze staat in de lijst als lopend.
2. Meld aan als die vervanger. De K3-klas staat bij je klassen met "Vervanging tot" en de datum. Zet een activiteit in
   de agenda: dat lukt.
3. Meld aan als de afwezige leerkracht. Je hebt de klas nog en ziet de activiteit van de vervanger.
4. Meld aan als directie en beëindig de vervanging vandaag. Meld aan als de vervanger: je kan de agenda van de klas niet
   meer bewerken.
5. Leg een vervanging vast die volgende week start. Meld aan als die vervanger: je hebt de klas nog niet.

## Buiten scope

- De briefing (FB-065) en de terugkeerbriefing (FB-066).
- Een mail of een andere melding buiten de app.
- Gebruikers aanmaken: dat bestaat al.

## Open vragen

- Hangt af van TB-056 (Art. VI.1 en de ADR over de vervanging).
- Wat gebeurt er na afloop met de eigen activiteiten die de vervanger maakte (ADR-0049)? Beslist in de ADR van TB-056.
- Een interimaris zonder schoolaccount in de Entra-tenant kan niet aanmelden: blijft dat zo?

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
