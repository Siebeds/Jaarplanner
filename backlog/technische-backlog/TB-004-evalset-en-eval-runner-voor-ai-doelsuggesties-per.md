---
id: TB-004
titel: Evalset en eval-runner voor AI-doelsuggesties per subthema
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 11:17
opgepakt-door: ai-doelsuggesties
branch: ticket/ai-doelsuggesties-eval
pr:
geblokkeerd:
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

- [ ] Gegeven de verzonnen evalset en de nep-AI-client, wanneer de runner draait, dan schrijft hij een rapport met per
  variant precisie, recall en (voor B) de recall van de top 25, plus één regel per geval.
- [ ] Gegeven een modelantwoord met een code die niet in de kandidatenlijst staat, wanneer de runner scoort, dan telt die
  code als fout en staat ze in het rapport als onbekende code, nooit als treffer.
- [ ] Gegeven de Foundry-resource in Sweden Central, wanneer de eigenaar na `az login` de runner vanaf zijn pc start,
  dan loopt hij zonder API-sleutel en toont het rapport tokens, kost en latency per model.
- [ ] Gegeven de publieke repo, wanneer de runner echte data leest of een rapport schrijft, dan belandt geen van beide in
  git: de map staat in `.gitignore`, en alleen de verzonnen evalset is gecommit.
- [ ] Gegeven de bestaande thema- en subdoelsuggesties, wanneer de client aangepast is, dan gedragen ze zich zoals
  voorheen; `dotnet test` en `dotnet format` zijn groen en de runner zit niet in CI.

## Buiten scope

- Het scherm voor stap 6 en de korte zin dat een aanvaard subdoel door AI voorgesteld werd: eigen ticket, na de meting.
- De export van de gouden set uit de demo-database: eigen ticket, zodra de kleuterjuffen gekoppeld hebben.
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
