---
id: TB-004
titel: Evalset en eval-runner voor AI-doelsuggesties per subthema
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 15:27
opgepakt-door: ai-doelsuggesties
branch: ticket/ai-doelsuggesties-eval
pr:
geblokkeerd: wacht op Azure-support: het Foundry-account wordt geweigerd met 715-123420 (unusual activity); de eigenaar opent een supportaanvraag
fr: []
---

## Aanleiding

Bij stap 6 van de thema-opbouw koppelt een leerkracht leerplandoelen aan een subthema (Art. IV.8, bijlage A.7). De
backend kan daar al suggesties voor maken (`POST /api/thema-opbouw/subdoel-suggesties`, E2-07), maar geen scherm roept
dat aan, en niemand weet hoe goed die suggesties zijn. Vóór we het in de app zetten, willen we het meten: welk klein
model, en met of zonder retrieval, op echte subthema's van kleuterklassen.

Beslissingen van de eigenaar op 2026-09-14 die dit ticket vastleggen:

- geen Azure AI Search (te duur); eerst een goedkopere variant testen;
- elke school krijgt een eigen web app en database, dus geen gedeelde index tussen scholen; school 1 krijgt de
  instance met achtervoegsel `sjceik`;
- E8-07 wordt niet naar voren gehaald: suggesties blijven tijdelijk advies;
- de Foundry-resource komt in Sweden Central, met Data Zone EU-deployments;
- we beginnen met een klein model;
- de gouden set komt van de hoofdkleuterjuffen, één klas per jaarfase (JK, K2, K3), die in de app zelf koppelen, niet
  in Excel.

## Voorgestelde wijziging

### 1. Het formaat van de evalset

Eén JSON-bestand met een lijst gevallen. Een geval is een subthema zoals de leerkracht het kent (naam, leeftijd,
onderzoeksvragen, activiteiten met verwachte uitkomsten), de gouden leerplandoelcodes, en de Op.stap-versie waarop de
codes slaan. Het formaat staat vast en is gedocumenteerd, zodat een latere export uit de database (apart ticket) het
kan vullen.

### 2. De eval-runner

Een apart consoleproject in `backend/tools/` (of een testcategorie `Eval`), dat **niet in CI** draait. Per geval draait
hij twee varianten:

- **A, zonder retrieval:** de kandidaten zijn de leerplandoelen van de jaarfase van het subthema, in een compacte
  weergave (code, domein, subdomein, tekst), en het model kiest er hoogstens acht.
- **B, met embeddings:** van de catalogus worden eenmalig embeddings gemaakt (text-embedding-3-small en -large) en
  lokaal gecachet. De top 25 komt uit een cosinusvergelijking in het geheugen, en daaruit kiest hetzelfde model.

De bestaande prompt en validatie worden hergebruikt waar het kan (`ThemaOpbouwPromptBuilder`, `DoelMatchResponseParser`).
Een code buiten de kandidatenlijst wordt nooit als treffer geteld (Art. IV.4, IV.5).

Het rapport (markdown) geeft per variant en per model:

- recall van de top 25 (alleen B);
- precisie en recall van de gekozen doelen;
- tokens, geschatte kost en latency (p50 en p95);
- een tabel per geval: gouden codes, gekozen codes, gemist, extra.

### 3. De AI-client

`AzureAiFoundryClient` krijgt:

- naast de sleutel ook aanmelding via Entra (`DefaultAzureCredential`), zodat de runner vanaf de pc van de eigenaar
  draait na `az login`, zonder sleutel;
- een api-version die de gpt-5-familie ondersteunt;
- het tokenverbruik (`usage`) terug in `AiCompletion`.

Het gedrag van de bestaande flows verandert niet.

### 4. Infrastructuur

Een Foundry-resource in Sweden Central in `infra/main.bicep`, met Data Zone Standard EU-deployments en een lage
TPM-quota, zodat een fout de kosten niet laat oplopen:

- gpt-5.4-mini;
- gpt-5-mini;
- text-embedding-3-small;
- text-embedding-3-large.

De eigenaar krijgt de rol *Cognitive Services OpenAI User*. Of gpt-5.4-mini in Sweden Central echt als Data Zone EU
beschikbaar is, wordt bij het aanmaken nagekeken; is het er niet, dan valt het uit de vergelijking.

### 5. Geen echte schooldata in git

De repo is publiek. Echte evalsets en rapporten komen in een map die git negeert. Alleen een kleine, verzonnen evalset
wordt gecommit, voor de tests van de runner zelf.

## Acceptatiecriteria

- [x] Gegeven de verzonnen evalset en de nep-AI-client, wanneer de runner draait, dan schrijft hij een rapport met per
  variant precisie, recall en (voor B) de recall van de top 25, plus één regel per geval.
- [x] Gegeven een modelantwoord met een code die niet in de kandidatenlijst staat, wanneer de runner scoort, dan telt die
  code als fout en staat ze in het rapport als onbekende code, nooit als treffer.
- [ ] Gegeven de Foundry-resource in Sweden Central, wanneer de eigenaar na `az login` de runner vanaf zijn pc start,
  dan loopt hij zonder API-sleutel en toont het rapport tokens, kost en latency per model.
- [x] Gegeven de publieke repo, wanneer de runner echte data leest of een rapport schrijft, dan belandt geen van beide in
  git: de map staat in `.gitignore`, en alleen de verzonnen evalset is gecommit.
- [x] Gegeven de bestaande thema- en subdoelsuggesties, wanneer de client aangepast is, dan gedragen ze zich zoals
  voorheen; `dotnet test` en `dotnet format` zijn groen en de runner zit niet in CI.

## Buiten scope

- Het scherm voor stap 6 en de korte zin dat een aanvaard subdoel door AI voorgesteld werd: eigen ticket, na de meting.
- De export van de gouden set uit de database van de schoolinstance (`sjceik`): eigen ticket, zodra de kleuterjuffen
  gekoppeld hebben.
- Embeddings in de app bewaren (pgvector of anders): pas als variant B de meting wint.
- Managed identity van de web app naar Foundry, Application Insights, caching.
- AI aanzetten in de demo-omgeving.

## Open vragen

- **Waar de kleuterjuffen labelen.** De eigenaar besliste op 2026-09-14: school 1 krijgt een eigen instance (achtervoegsel
  `sjceik`), en de demo-omgeving blijft voor pitches aan andere scholen (TB-003, met fictieve data). Echte schooldata in
  een bereikbare omgeving vraagt volgens E7-11 eerst E6-02, of een beslissing van de eigenaar, plus een eigen
  databaserol voor de app (E7-05). Dat raakt het labelen, niet de bouw van dit ticket.
- **Leerkrachten aan een klas koppelen** kan pas met E6-04, dat nog niet op `main` staat. In Entra zijn vandaag enkel
  demo-accounts aan de demo-app toegewezen.

## Werklog

- 2026-09-14 11:09 · ai-doelsuggesties · aangemaakt (status in-uitvoering)
- 2026-09-14 11:17 · ai-doelsuggesties · eigenaar: eigen instance voor school 1 (sjceik), demo blijft voor pitches; ticket goedgekeurd om te committen en te pushen
- 2026-09-14 12:01 · ai-doelsuggesties · afwijking: de Foundry-resource staat in infra/ai-foundry.bicep (eigen resource group), niet in main.bicep, zodat de demo en de schoolomgevingen er los van blijven; uitleg in infra/ai-foundry.md
- 2026-09-14 12:01 · ai-doelsuggesties · afwijking: de AI-client haalt zijn Entra-token zelf op en de DI-registratie blijft onveranderd (claim op DependencyInjection.cs ligt bij E6-02); de client gebruikt nu de v1-route zonder api-version
- 2026-09-14 12:01 · ai-doelsuggesties · gebouwd: eval-runner (backend/tools/Jaarplanner.Eval), tokenverbruik en Entra in de client, verzonnen voorbeeldset, eval-data/ genegeerd door git; build groen, 130 AI- en eval-tests groen, Bicep compileert
- 2026-09-14 12:33 · ai-doelsuggesties · antagonist ronde 1: VIOLATIONS FOUND (2 major, 7 minor); verslag en afhandeling in backlog/worklogs/TB-004/antagonist-ronde-1.md
- 2026-09-14 12:33 · ai-doelsuggesties · opgelost: Entra is een expliciete keuze (AzureAI:Authentication, standaard Key) met tokencache; ADR-0036 (Proposed; ADR-0035 is van TB-005); kost en latency over elk beantwoord verzoek; embeddingtokens overleven een nieuwe poging; Engelse opties; uitvoermap buiten git bewaakt; gekozen themadoelen uitgesloten; quota 50K/100K
- 2026-09-14 12:33 · ai-doelsuggesties · criteria 1, 2, 4 en 5 afgevinkt: EvalRunnerTests, ScoringTests, EvalOptionsTests (RepoGuard) en AzureAiFoundryClientTests groen; volledige suite 1178 unit / 117 integratie groen, format schoon; criterium 3 wacht op de deploy van de Foundry-resource
- 2026-09-14 12:51 · ai-doelsuggesties · antagonist ronde 2: 0 major, 3 minor, 2 vragen; afgehandeld, zie backlog/worklogs/TB-004/antagonist-ronde-2.md
- 2026-09-14 12:51 · ai-doelsuggesties · open, blokkeert klaar: de regel voor ADR-0036 in docs/adr/README.md (index en traceability) wacht op de claim van kindrapport op dat bestand; daarnaast wacht criterium 3 op de deploy en ADR-0036 op aanvaarding door de eigenaar
- 2026-09-14 13:08 · ai-doelsuggesties · antagonist ronde 3: 0 major, 6 minor (timeouts stopten de run, cachefout kon de fout verbergen, retrievaltabel telde fouten als missers, zwakke regressietest, verkeerd cachebestand, halve hernoeming); afgehandeld, zie backlog/worklogs/TB-004/antagonist-ronde-3.md
- 2026-09-14 13:26 · ai-doelsuggesties · antagonist ronde 4: 0 major, 2 minor (een fout tijdens een gevraagde stop crashte de runner; 'Bij de kandidaten' had twee betekenissen); afgehandeld, zie backlog/worklogs/TB-004/antagonist-ronde-4.md
- 2026-09-14 13:29 · ai-doelsuggesties · ADR-0036 staat nu in docs/adr/README.md (index en traceability-matrix); dat blokkeert klaar niet meer. Open blijven criterium 3 (deploy) en de aanvaarding van ADR-0036 door de eigenaar
- 2026-09-14 13:38 · ai-doelsuggesties · antagonist ronde 5: 0 major, 3 minor (stop na de laatste aanroep, Art. VI.7 in ADR-0036, ADR-bereik in CLAUDE.md); afgehandeld, zie backlog/worklogs/TB-004/antagonist-ronde-5.md
- 2026-09-14 13:44 · ai-doelsuggesties · antagonist ronde 6: COMPLIANT. Open bij de eigenaar: de go voor de deploy (criterium 3) samen met de bevestiging van de quota (50K tokens per minuut per chatmodel, 100K per embeddingmodel), en de aanvaarding van ADR-0036
- 2026-09-14 14:48 · ai-doelsuggesties · eigenaar: ADR-0036 aanvaard; Foundry volledig als code (ai-foundry.bicep op subscription-niveau maakt ook de resource group, deploy-ai.ps1 deployt); vergelijking beperkt tot gpt-5.4-mini en text-embedding-3-small, de enige met Data Zone-quota; eval-catalogus in lokale databank jaarplanner_eval (Op.stap 1.2, 5.835 G-doelen)
- 2026-09-14 14:49 · ai-doelsuggesties · geblokkeerd: wacht op Azure-support: het Foundry-account wordt geweigerd met 715-123420 (unusual activity); de eigenaar opent een supportaanvraag
- 2026-09-14 15:00 · ai-doelsuggesties · antagonist ronde 7: 0 major, 3 minor (ai-foundry.md sprak ADR-0036 tegen over gedeeld gebruik door dev/tst; regio was een vrije optie; -Skip aanvaardde onbekende namen); afgehandeld, zie backlog/worklogs/TB-004/antagonist-ronde-7.md. Het ADR van TB-006 moet beslissing 3 van ADR-0036 wijzigen voor het gedeelde gebruik door dev en tst
- 2026-09-14 15:10 · ai-doelsuggesties · antagonist ronde 8: 0 major, 2 minor (-Skip vergeleek hoofdletterongevoelig; onbekende parameters werden stil genegeerd) en 1 vraag (de wijziging van ADR-0036 hoort ook in TB-006); afgehandeld, zie backlog/worklogs/TB-004/antagonist-ronde-8.md
- 2026-09-14 15:16 · ai-doelsuggesties · eigenaar probeerde de deployment manueel in de portal: zelfde fout 715-123420; hij logt een supportaanvraag bij Azure
- 2026-09-14 15:21 · ai-doelsuggesties · antagonist ronde 9: 0 major, 2 minor (codecommentaar belandde in de help van deploy-ai.ps1; TB-006 met de hand aangepast zonder werklogregel); afgehandeld, zie backlog/worklogs/TB-004/antagonist-ronde-9.md
- 2026-09-14 15:27 · ai-doelsuggesties · antagonist ronde 10: COMPLIANT; de bevindingen van ronde 7 tot 9 zijn afgehandeld. Open blijven criterium 3 (wacht op Azure-support) en een nieuwe merge van origin/main voor de PR
