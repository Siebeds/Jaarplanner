---
id: FB-070
titel: Kat stelt voor een thema start activiteiten voor in een discipline met een aanbod-gat
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-18 17:45
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-4.1, FR-4.2, FR-9.2]
---

## Aanleiding

De eigenaar besliste op 2026-09-18, in een sparring over een agentische uitbreiding, dat de Jaarplanner een AI-agent
krijgt die op de agenda van de kleuterleerkracht leeft en planlast vermindert, gepersonifieerd als een dikke oranje
gestreepte kat. De agent is de interface, niet de motor. De grondwet en de ADR's komen in TB-056.

Sommige disciplines raakt een klas bijna niet: hun leerplandoelen zitten in geen enkel subthema, fiche of activiteit van
de klas. Een activiteitvoorstel onder een subthema (FB-025, ADR-0056) helpt daar niet, want dat koppelt alleen subdoelen,
en die tellen al mee via het subthema.

**Beslissingen van de eigenaar, 2026-09-18:**

- De kat stelt de leerkracht zelf activiteiten voor op leerplandoelen die nog geen subdoel zijn; een aanvaard voorstel
  wordt haar eigen activiteit (ADR-0049), en telt voor haar klas zodra het in de agenda staat. De hoofdleerkracht komt er
  niet aan te pas.
- Een discipline is "laag" volgens haar **aanbod-gat**: het aandeel van haar leerplandoelen van de jaarfase van de klas
  dat in geen enkele dekkingsprognose van de klas zit.
- Het moment: een week voor een thema start in de agenda van de klas, één keer per thema.

Dit wijkt af van ADR-0056 D6 en van de volgorde "eerst doelen, dan aanbod" (Art. IV.8): dat gebeurt in TB-056.

## Gewenst gedrag

- Vijf schooldagen voor een thema start in de agenda van de klas, kiest de kat de discipline met het grootste aanbod-gat.
- De AI krijgt het thema, zijn subthema's op de leeftijd van de klas (met onderzoeksvragen), de namen van de activiteiten
  die er al zijn, en de leerplandoelen van die discipline in het aanbod-gat. Ze stelt twee à drie activiteiten voor, elk
  onder een subthema van het thema, met naam, soort, verwachte uitkomsten, lengte, de doelen waaraan ze werkt (alleen
  doelen uit het aanbod-gat), een motivatie waarom het doel in dít thema past, en een voorgestelde dag en uur in de
  periode van het thema, op een vrij moment binnen de schooluren.
- Past geen enkel doel in het thema, dan zegt de AI dat, en brengt de kat niets.
- De leerkracht aanvaardt een voorstel (eventueel na aanpassen) of weigert het. Aanvaard wordt het haar eigen activiteit
  met de aanvaarde doelen, gepland op de voorgestelde dag. Een geweigerd voorstel komt niet terug.
- Minimumdoelen doen niet mee: die tellen alleen via een thema (Art. V.1).

## Acceptatiecriteria

- [ ] Gegeven een klas waarvan een discipline het grootste aanbod-gat heeft, wanneer een thema over vijf schooldagen start,
  dan liggen er twee à drie voorstellen klaar voor die discipline, onder subthema's van dat thema.
- [ ] Gegeven een modelantwoord met een doel dat niet in het aanbod-gat zit, of een onbekende code, dan wordt dat doel niet
  getoond en niet bewaard.
- [ ] Gegeven een aanvaard voorstel, dan is het een eigen activiteit van de leerkracht, gepland op de voorgestelde dag, en
  telt het doel mee voor de dekking van haar klas.
- [ ] Gegeven een voorgestelde dag en uur, dan valt die binnen de schooluren en de periode van het thema, en overlapt ze
  niets wat al gepland staat.
- [ ] Gegeven een thema waarvoor de kat al voorstellen bracht, dan brengt hij er geen tweede keer.
- [ ] De logica is getest met een nep-AI-client, en de keuze van de discipline zonder AI.

## Testscenario's

1. Neem een K2-klas waarvan de meeste leerplandoelen van één discipline in geen subthema, fiche of activiteit zitten, en
   plaats een thema dat over vijf schooldagen start.
2. Meld aan als leerkracht van die klas. De kat heeft twee à drie voorstellen voor die discipline, met een motivatie en
   een voorgestelde dag.
3. Aanvaard er een. Het staat als eigen activiteit in je agenda op die dag, en het doel is gedekt in het dekkingsoverzicht.
4. Weiger er een. Het komt niet terug.

## Buiten scope

- Het doel als subdoel voorstellen aan de hoofdleerkracht: niet gekozen.
- Minimumdoelen.
- De schoolbrede hiatenanalyse: FB-054.

## Open vragen

- Een klas met twee vaste leerkrachten (duobaan): wie krijgt de voorstellen, want een eigen activiteit is van één
  persoon?
- Zegt de AI dat er niets past, probeert de kat dan de volgende discipline, of wacht hij tot het volgende thema?
- Het inpassen op een vrij moment kan de code van FB-027 hergebruiken.
- Hangt af van TB-056 (Art. IV.8 en de ADR die ADR-0056 D6 gedeeltelijk vervangt) en TB-057.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
