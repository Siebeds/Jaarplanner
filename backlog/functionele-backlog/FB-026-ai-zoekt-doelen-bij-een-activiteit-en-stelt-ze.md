---
id: FB-026
titel: AI zoekt doelen bij een activiteit en stelt ze voor als subdoel
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-17 01:17
opgepakt-door: claude-fb026
branch: ticket/FB-026-doelen-bij-activiteit
pr:
geblokkeerd:
fr: [FR-4.1, FR-4.2, FR-4.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"Op een activiteit gelinkte leerplandoelen zoeken en deze toevoegen aan het subthema
(+ thema?) - hier een max aantal voorstellen op instellen (die goedgekeurd/afgekeurd moeten worden) en eventueel gebruiker
meerdere keren laten runnen?"*.

Vandaag koppelt iemand de doelen van een activiteit met de hand. De AI kan dat alleen voor een thema (doelsuggesties).

**Beslissingen van de eigenaar, 2026-09-15:**

- een aanvaard doel komt **op de activiteit**, en wordt daarnaast **voorgesteld als subdoel** van het subthema, dat de
  hoofdleerkracht aanvaardt of weigert;
- standaard **hoogstens 5 voorstellen per keer**, instelbaar, en **opnieuw vragen** mag;
- een eerder geweigerd doel komt niet terug;
- het thema krijgt niets apart: het toont het doel vanzelf via FB-009.

Dit ticket neemt het activiteitendeel van story E8-07 over.

## Gewenst gedrag

- Bij een activiteit vraagt wie haar doelen mag koppelen "zoek doelen": de eigenaar bij een eigen activiteit (FB-015),
  een hoofdleerkracht of de directie bij een gedeelde.
- De AI krijgt de activiteit (naam, type, verwachte uitkomsten, onderzoeksvraag) en de leerplandoelen van haar leeftijd,
  en stelt hoogstens het ingestelde aantal doelen voor, elk met een motivatie.
- Per voorstel: aanvaarden of weigeren. Een voorstel en de beslissing worden bewaard.
- Een aanvaard doel komt op de activiteit. Is het nog geen subdoel van het subthema, dan verschijnt het bij het subthema
  als voorgesteld subdoel voor de hoofdleerkrachten van die jaarfase.
- Opnieuw vragen geeft nieuwe voorstellen: geen doel dat al op de activiteit staat, en geen doel dat eerder geweigerd werd.

## Acceptatiecriteria

- [ ] Gegeven een activiteit en een maximum van 5, wanneer doelen gezocht worden, dan krijgt de gebruiker hoogstens 5
  voorstellen, elk met een motivatie, allemaal van de leeftijd van de activiteit.
- [ ] Gegeven een aanvaard voorstel dat nog geen subdoel is, dan staat het doel op de activiteit en ziet een hoofdleerkracht
  het bij het subthema als voorgesteld subdoel; aanvaardt zij, dan is het een subdoel.
- [ ] Gegeven een geweigerd voorstel, wanneer opnieuw gezocht wordt, dan komt het niet terug, net als de doelen die al op de
  activiteit staan.
- [ ] Gegeven een gedeelde activiteit, dan kan een leerkracht zonder hoofdleerkrachtrecht geen voorstellen aanvaarden.
- [ ] Gegeven een modelantwoord met een code buiten de kandidaten, dan wordt die niet getoond en niet bewaard.
- [ ] De logica is getest met een nep-AI-client.

## Testscenario's

1. Meld aan als leerkracht van een K3-klas en open een eigen activiteit. Kies "zoek doelen". Je krijgt hoogstens vijf
   doelen met motivatie.
2. Aanvaard er twee en weiger er een. De twee staan op de activiteit.
3. Meld aan als hoofdleerkracht van K3 en open het subthema. De twee doelen staan er als voorgesteld subdoel. Aanvaard er
   een: het staat bij de subdoelen.
4. Zoek als leerkracht opnieuw. Het geweigerde doel en de twee aanvaarde komen niet terug.
5. Open een gedeelde activiteit als gewone leerkracht. Aanvaarden kan niet.

## Buiten scope

- AI-matching op subdoelniveau in de wizard (het andere deel van E8-07).
- Doelen rechtstreeks aan het thema toevoegen: het thema toont ze via FB-009.

## Open vragen

- **Status van een koppeling op een activiteit:** dit zijn de eerste activiteitskoppelingen die niet manueel zijn. Volgens
  de noot bij E8-07 houdt vandaag elke koppeling (ook voorgesteld of geweigerd) de maker tegen om de activiteit te
  verwijderen (R25). De eigenaar moet zeggen of alleen beslist gekoppelde doelen dat mogen doen.
- Waar stelt men het maximum in: per school door de directie, of in de configuratie? **Standaard** in de configuratie.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-17 00:31 · claude-fb026 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-17 00:31 · claude-fb026 · Eigenaar besliste: alleen aanvaarde en manuele koppelingen houden het verwijderen door de maker tegen (R25); het maximum staat in de configuratie (standaard 5).
- 2026-09-17 00:59 · claude-fb026 · Backend, migratie en formulier gebouwd; unit-, integratie- (579) en Vitest-tests groen.
- 2026-09-17 01:17 · claude-fb026 · Browserpas (wegwerpdatabase, desktop en 390px): voorstellen tonen, aanvaarden en weigeren werken, het subdoelvoorstel verschijnt bij het subthema; main gemerged, ADR hernummerd naar 0053.
