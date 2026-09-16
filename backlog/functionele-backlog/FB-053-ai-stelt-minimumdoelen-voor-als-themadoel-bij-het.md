---
id: FB-053
titel: AI stelt minimumdoelen voor als themadoel, bij het thema en in de wizard
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-17 00:45
opgepakt-door: claude-fb053
branch: ticket/FB-053-minimumdoelsuggesties
pr: 135
geblokkeerd:
fr: [FR-4.1, FR-4.2, FR-4.3]
---

## Aanleiding

Sinds FB-043 is een themadoel een **minimumdoel** (ADR-0046). De AI-doelsuggesties bij het thema (*Vraag
suggesties*) en de stap *themadoelen* van de thema-opbouwwizard stellen echter nog **leerplandoelen** voor, en een
aanvaarde suggestie wordt zo geen themadoel. Ook de AI-vragen van de jaarplangeneratie en van de doelsuggesties zien
bij een thema dat met de hand is opgebouwd geen themadoelen meer, omdat ze alleen leerplandoel-themadoelen lezen.

De eigenaar besliste op 2026-09-16 dat een apart ticket beslist wat hiermee gebeurt (FB-043, *Buiten scope*).

## Gewenst gedrag

- Directie en themabeheer vragen bij een thema AI-voorstellen voor **minimumdoelen** als themadoel. Elk voorstel heeft
  een korte motivatie en wordt één voor één aanvaard of geweigerd; pas na aanvaarden staat het minimumdoel als
  themadoel op het thema.
- De stap *themadoelen* van de wizard stelt op dezelfde manier minimumdoelen voor.
- De AI houdt bij het voorstellen van subdoelen en bij de jaarplangeneratie rekening met de minimumdoelen van het
  thema.

## Acceptatiecriteria

- [x] Gegeven een thema zonder themadoelen, wanneer themabeheer AI-voorstellen vraagt, dan krijgt ze minimumdoelen met
  een motivatie, als voorstel en nog niet gekoppeld.
- [x] Gegeven een voorstel, wanneer ze het aanvaardt, dan staat het minimumdoel als themadoel op het thema; weigert ze
  het, dan komt het bij een volgende vraag niet terug.
- [x] Gegeven de wizard, wanneer men bij de stap themadoelen voorstellen vraagt, dan zijn het minimumdoelen.
- [x] Gegeven een thema met minimumdoelen, wanneer de AI subdoelen of een jaarplan voorstelt, dan krijgt ze die
  minimumdoelen mee.
- [x] Gegeven een leerkracht of hoofdleerkracht, dan kan ze geen voorstellen vragen of beoordelen; de server weigert
  het ook.

## Testscenario's

1. Meld aan met themabeheer en open een thema zonder themadoelen.
2. Klik *Vraag suggesties*. Je ziet minimumdoelen met een motivatie, elk met Aanvaard en Weiger.
3. Aanvaard er één. Het staat bij de themadoelen en klapt open per leeftijd.
4. Weiger er één en vraag opnieuw voorstellen. Het geweigerde komt niet terug.
5. Start de wizard en ga naar de stap themadoelen. De voorstellen zijn minimumdoelen.
6. Meld aan als leerkracht en open het thema. Je ziet geen knop om voorstellen te vragen.

## Buiten scope

- AI-voorstellen voor subdoelen van een subthema: die blijven leerplandoelen (FB-026, FB-049).
- Het gegevensmodel van de bestaande doelsuggesties die een leerplandoel zijn opruimen: de gegevens verdwijnen wel
  (zie hieronder), de structuur in de code mag een apart ticket blijven.

## Open vragen

Beantwoord door de eigenaar op 2026-09-16:

- **Vervangt dit de huidige doelsuggesties bij het thema?** Ja. Bij een thema stelt de AI alleen nog minimumdoelen
  voor; leerplandoelen komen via de subthema's en hun subdoelen.
- **Wat met de bestaande voorstellen?** Alles weg: de leerplandoel-doelsuggesties op thema-niveau verdwijnen, open én
  aanvaarde, en tellen niet meer mee voor de dekking. Dat wijzigt de constitutie: Art. V.1 laat een aanvaarde
  doelsuggestie van een thema vandaag meetellen voor dekkingsprognose en dekking, en Art. IX beschrijft
  `doelsuggesties[]` als leerplandoel-koppelingen. Die artikels worden eerst aangepast (met een regel in
  `docs/constitutie-log.md`) voor dit gebouwd wordt.
- **Welke minimumdoelen zoekt de AI af?** Volgens de leeftijden van de subthema's van het thema: een kleutersubthema
  brengt de mijlpaal K mee, een subthema in de lagere school de mijlpaal die bij dat leerjaar hoort. Een thema zonder
  subthema's laat de gebruiker eerst kiezen, zoals nu. Lokaal telt mijlpaal K 208 minimumdoelen (ongeveer 11.000
  tokens), tegen ongeveer 37.000 tokens voor de K3-leerplandoelen van vandaag.

- **Welke mijlpaal hoort bij welk leerjaar:** zoals de dekking al rekent (`Jaarfasen.MijlpalenVoor`, ADR-0047): de
  kleuterjaren bij K, L1 tot L4 bij 4, L5 en L6 bij 6.

## Werklog

- 2026-09-16 15:31 · claude-fb043 · aangemaakt (status nieuw)
- 2026-09-16 22:34 · claude-fb053 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten, samen met het andere ticket
- 2026-09-16 22:40 · claude-fb053 · Constitutie Art. V.1 en IX.2 aangepast en ADR-0049 vastgelegd: doelsuggesties bij een thema zijn minimumdoelen en tellen niet meer mee voor leerplandoelen.
- 2026-09-16 23:28 · claude-fb053 · Backend klaar: AI stelt minimumdoelen voor (thema en wizard), aanvaarden maakt een themadoel, migratie wist de oude doelsuggesties; dotnet test groen (1915 unit, 559 integratie tegen Postgres).
- 2026-09-16 23:41 · claude-fb053 · Frontend: voorstelkaart toont MD-code, mijlpaal en tekst van het minimumdoel; pnpm test 1008 groen, pnpm lint schoon.
- 2026-09-16 23:41 · claude-fb053 · Criteria afgevinkt op bewijs: 1-2 DoelsuggestieEndpointsTests en browserpas; 3 ThemaOpbouwAssistServiceTests (stap 2); 4 ThemaOpbouwAssistServiceTests (stap 6) en JaarplanGeneratieServiceTests; 5 RechtenAfdwingingTests en de browserpas (leerkracht krijgt 403, geen knop).
- 2026-09-16 23:41 · claude-fb053 · Browserpas via CDP (eigen Chrome-profiel) op een kopie jp_fb053, desktop en 390px: 3 voorstellen uit 208 K-minimumdoelen, aanvaarden maakt een themadoel, geweigerd komt niet terug; geen echte AI-aanroep, de Claude-client wees naar een lokale stub. Migratie wiste de 16 oude doelsuggesties in de kopie; kopie daarna verwijderd.
- 2026-09-16 23:41 · claude-fb053 · Open punt voor de eigenaar: het vooruitzicht bij het genereren telt leerplandoelen, die een themaplaatsing niet meer beweegt, dus beide cijfers zijn nu altijd gelijk (ADR-0049).
- 2026-09-16 23:41 · claude-fb053 · in-uitvoering → te-testen: Gebouwd: AI stelt bij het thema en in de wizard alleen minimumdoelen voor, aanvaarden maakt een themadoel, weigeren houdt het weg; oude leerplandoel-doelsuggesties gewist en telt niet meer voor dekking (constitutie V.1/IX.2, ADR-0049). Gates groen: dotnet test, dotnet format, pnpm test, pnpm lint.
- 2026-09-17 00:01 · claude-fb053 · Eigenaar 2026-09-16: voorstellen staan in de volgorde van het model (het best passende eerst); een rang-kolom zit in dezelfde migratie, een latere vraag komt achter de bestaande voorstellen.
- 2026-09-17 00:01 · claude-fb053 · Eigenaar 2026-09-16: een aanvaard en later ontkoppeld minimumdoel mag opnieuw voorgesteld worden (op dezelfde rij); themadoelen, open en geweigerde voorstellen blijven uitgesloten.
- 2026-09-17 00:01 · claude-fb053 · Een gelijktijdige koppeling met de hand bij het aanvaarden geeft nu een 409 met een Nederlandse zin in plaats van een 500 (Postgres-test).
- 2026-09-17 00:02 · claude-fb053 · Eigenaar 2026-09-16: geen 'aanpassen' (D2 blijft); een voorstel wordt aanvaard of geweigerd, een ander minimumdoel koppel je met de hand. Constitutie IV.2, VI.1 en XII aangepast, ADR-0049 O6-O8.
- 2026-09-17 00:03 · claude-fb053 · Eigenaar 2026-09-16: de prognose in het generatierapport (minimumdoelen tellen) wordt een apart ticket.
- 2026-09-17 00:06 · claude-fb053 · Kleine punten van de antagonist opgelost: IX.2 noemt de gekozen leeftijden, de resultaatzin noemt de mijlpaal ('van mijlpaal K'), commentaar in de jaarplanprompt terug op zijn plaats, D4 voor D5 in ADR-0049; de voorstellen staan in rangvolgorde op het scherm (Vitest).
- 2026-09-17 00:30 · claude-fb053 · TB-043 en main samengevoegd: de minimumdoelenlijst gaat nu als vaste, cachebare context mee; ADR-nummer van dit ticket is 0052 geworden (0049-0051 zijn intussen door FB-015 en FB-057 genomen); migratie opnieuw aangemaakt na Subdoelplaatsing.
- 2026-09-17 00:43 · claude-fb053 · Browsercontrole opnieuw via CDP met stub-AI (geen echte AI-aanroep), desktop en 390px: voorstelstapel toont MD-code, mijlpaal en tekst in de volgorde van het model, 'van mijlpaal K' in de resultaatzin, geweigerd komt niet terug, aanvaard-en-ontkoppeld komt terug, leerkracht 403; de lijst gaat als gecachet systeemblok mee. Gates: dotnet test 2031 unit + 572 integratie groen, dotnet format --verify-no-changes schoon, pnpm test 1113 groen, pnpm lint schoon.
- 2026-09-17 00:45 · claude-fb053 · PR #135
