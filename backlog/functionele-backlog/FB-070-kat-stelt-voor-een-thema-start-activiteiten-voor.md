---
id: FB-070
titel: Kat stelt voor een thema start activiteiten voor in een discipline met een aanbod-gat
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-18
bijgewerkt: 2026-09-22 23:18
opgepakt-door: claude-fb070
branch: ticket/FB-070-aanbodgat
pr: 157
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
  die er al zijn, de leerplandoelen van die discipline in het aanbod-gat, en de schooldagen van de themaperiode met hun
  vrije momenten. Ze stelt twee à drie activiteiten voor, elk onder een subthema van het thema, met naam, soort,
  verwachte uitkomsten, lengte, de doelen waaraan ze werkt (alleen doelen uit het aanbod-gat), een motivatie waarom het
  doel in dít thema past, en een voorgestelde dag en beginuur.
- Een moment dat de school niet kan geven (buiten de schooluren, in de middagpauze, bovenop iets dat al gepland staat)
  corrigeert de tool: de dag van de AI blijft, het uur schuift op naar het eerstvolgende vrije moment
  ([ADR-0062](../../docs/adr/0062-de-ai-stelt-het-moment-voor-de-tool-corrigeert.md)).
- Past geen enkel doel in het thema, dan zegt de AI dat, en brengt de kat niets.
- De leerkracht aanvaardt een voorstel (eventueel na aanpassen) of weigert het. Aanvaard wordt het haar eigen activiteit
  met de aanvaarde doelen, gepland op de voorgestelde dag; ziet ze een beter moment, dan geeft ze zelf een dag en een uur
  mee. Een geweigerd voorstel komt niet terug.
- Minimumdoelen doen niet mee: die tellen alleen via een thema (Art. V.1).

## Acceptatiecriteria

- [x] Gegeven een klas waarvan een discipline het grootste aanbod-gat heeft, wanneer een thema over vijf schooldagen start,
  dan liggen er twee à drie voorstellen klaar voor die discipline, onder subthema's van dat thema.
- [x] Gegeven een modelantwoord met een doel dat niet in het aanbod-gat zit, of een onbekende code, dan wordt dat doel niet
  getoond en niet bewaard.
- [x] Gegeven een aanvaard voorstel, dan is het een eigen activiteit van de leerkracht, gepland op de voorgestelde dag, en
  telt het doel mee voor de dekking van haar klas.
- [x] Gegeven een voorgestelde dag en uur, dan valt die binnen de schooluren en de periode van het thema, en overlapt ze
  niets wat al gepland staat.
- [x] Gegeven een thema waarvoor de kat al voorstellen bracht, dan brengt hij er geen tweede keer.
- [x] De logica is getest met een nep-AI-client, en de keuze van de discipline zonder AI.

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
  persoon? Standaard: alle leerkrachten van de klas krijgen ze, en wie aanvaardt wordt eigenaar (ADR-0060 D2).
- Zegt de AI dat er niets past, probeert de kat dan de volgende discipline, of wacht hij tot het volgende thema?
  Standaard wacht hij (ADR-0060 D6).
- ~~Het inpassen op een vrij moment kan de code van FB-027 hergebruiken.~~ FB-027 bestaat nog niet; het inpassen zit in
  `Vrijmoment` en is daar zuiver en getest. FB-027 kan het overnemen.
- ~~Hangt af van TB-056 (Art. IV.8 en de ADR die ADR-0056 D6 gedeeltelijk vervangt) en TB-057.~~ Allebei klaar.
- Het zien en beslissen van deze voorstellen komt met FB-071 (het kattenvenster), samen met de teksten in `nl.json`.
  Tot dan is er wel een API: de voorstellen staan op de deurmat en het beslissen loopt over de bestaande route.

## Werklog

- 2026-09-18 17:45 · kat-sparring · aangemaakt (status nieuw)
- 2026-09-18 18:11 · claude-tb056 · open vragen aangevuld met de standaardkeuzes van TB-056 (ADR-0059, ADR-0060)
- 2026-09-22 21:52 · claude-fb070 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-22 21:55 · claude-fb070 · scope: backend-only zoals FB-069; het zien en beslissen komt met FB-071 (eigenaar, vandaag)
- 2026-09-22 22:13 · claude-fb070 · backend staat: AanbodGatDetector (zonder AI), AanbodgatTaak (eerste IKattaak), voorstel met bron/klas/plaatsing/moment, migratie, aanvaarden plant de eigen activiteit; tests volgen
- 2026-09-22 22:39 · claude-fb070 · integratietest groen: 5 tests over de hele keten (tik, aanvaarden, dekking, geen tweede set, geweigerd doel blijft weg); 2228 unit- en 590 integratietests groen, dotnet format en pnpm lint schoon; antagonist loopt
- 2026-09-22 22:54 · claude-fb070 · antagonist COMPLIANT in ronde 1 (geen CRITICAL/MAJOR); rechtenmatrixtests voor de klaskolom toegevoegd en een spelling (Aanbodgat) doorgevoerd
- 2026-09-22 22:55 · claude-fb070 · eigenaar overrulet Art. IV.5 en ADR-0060 D3: de AI stelt de dag en het uur voor, de tool corrigeert een onmogelijk moment; nieuwe ADR en grondwetswijziging volgen
- 2026-09-22 23:05 · claude-fb070 · omgebouwd naar de beslissing van de eigenaar: de AI kiest de dag en het uur, de tool corrigeert een onmogelijk moment (dag blijft, uur schuift op); ADR-0062, Art. IV.5 aangepast, constitutie-log en FR-14.8 bij
- 2026-09-22 23:11 · claude-fb070 · PR #157
- 2026-09-22 23:18 · claude-fb070 · antagonist COMPLIANT in ronde 2; D1 letterlijk gemaakt (valt de zoektocht vooruit stil, dan telt een eerdere dag alsnog) en ADR-0060 draagt nu zelf dat D3 vervangen is. MINOR blijven: een tweede AI-oproep als het model niets brengt, de leeftijdscontrole op de kattak, en het AanbodGat-signaal dat nooit getoond wordt
- 2026-09-22 23:18 · claude-fb070 · in-uitvoering → te-testen: kat brengt activiteitvoorstellen op het aanbod-gat: detector zonder AI, AanbodgatTaak als eerste IKattaak, voorstel per klas met plaatsing en moment, aanvaarden maakt de eigen activiteit en plant ze; eigenaar liet de AI de dag en het uur kiezen (ADR-0062, Art. IV.5 aangepast); 2251 unit- en 592 integratietests groen, format en lint schoon, antagonist COMPLIANT; het scherm komt met FB-071
