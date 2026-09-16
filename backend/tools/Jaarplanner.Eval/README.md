# Jaarplanner.Eval: measuring the AI doelsuggesties

The eval runner of **TB-004** ([ADR-0036](../../../docs/adr/0036-ai-evaluatieomgeving-en-v1-route.md)). It answers one
question before the step 6 suggestions get a screen: *which small model, with or without retrieval, proposes the
leerplandoelen a teacher would link to a subthema?*

It runs a frozen evalset through every **variant** and every **chat deployment** you name, and writes a markdown
report with precision, recall, the candidate ceiling, tokens, cost and latency. It persists nothing, touches no
school's data and never runs in CI: a run calls a paid model and is not deterministic. CI only builds it and runs
its unit tests (`backend/tests/Jaarplanner.UnitTests/Eval/`), all against fakes.

## The variants

| Variant | Candidates the model chooses from |
| --- | --- |
| **A** | every leerplandoel of the subthema's jaar/fase, no retrieval |
| **B** | the same set, ranked by embedding similarity to the subthema; the top *n* (default 25) go to the model |

Both use the **production step 6 prompt** (`ThemaOpbouwPromptBuilder`), with two differences:

- the ceiling on the number of suggestions is the run's own (`--max`, default 8, the same as production's);
- with `--goal-format compact` (the default), the goal list is written one line a goal: code, taxonomy and text.
  `--goal-format full` sends the goal list exactly as production does, grouped under domein and subdomein.

Answers go through the production parser (`DoelMatchResponseParser`), and a code that is among the thema's
`gekozenThemadoelCodes` is dropped first, as production step 6 does. A code that is not in the candidate list counts
as a wrong answer, never as a hit, even when the same code is in the gold set.

## Privacy: nothing real goes into git

This repository is **public**. A real evalset holds a school's own subthema's and a teacher's links, and the report
quotes them. Keep both under **`eval-data/`** at the repo root, which git ignores; the runner writes its report and its
cache there by default.

- Inside the repo, the runner **refuses** an output folder that git does not ignore, and it warns about an evalset in
  such a place.
- The only evalset in git is `voorbeeld-evalset.json`, and it is invented: its codes do not exist in Op.stap.
- The embedding cache holds vectors of the public catalogue only. A subthema's own vector is never cached.
- An evalset never contains pupil data (Art. VI.2). Check the free-text fields (onderzoeksvragen, verwachte
  uitkomsten) for names before a set is used.

## Setting up

1. Sign in: `az login`. Without a key the runner signs in through the Azure CLI (Microsoft Entra), and the resource
   has no keys at all.
2. Deploy the Foundry resource with `./infra/deploy-ai.ps1 -SetEvalEndpoint`, which also writes `AzureAI:Endpoint`
   into this project's user-secrets: see [`infra/ai-foundry.md`](../../../infra/ai-foundry.md).
3. Point it at a database that holds the Op.stap import. Use a database of its own (for example `jaarplanner_eval`),
   migrated and filled through the API's Op.stap import, rather than a dev database someone works in: after the first
   API import of the leerplandoelen, that database's Excel route refuses every file (Art. VII.2).

   ```powershell
   dotnet user-secrets set "ConnectionStrings:Postgres" "Host=127.0.0.1;Port=5433;Database=jaarplanner_eval;Username=jaarplanner;Password=<...>;SSL Mode=Disable" --project backend/tools/Jaarplanner.Eval
   ```

4. Optionally fill in prices (per million tokens) so the report can show a cost, in user-secrets or in
   `appsettings.json`: `Prices:<deployment>:Input`, `Prices:<deployment>:CachedInput` and
   `Prices:<deployment>:Output`. A model without a price shows `onbekend`.

## Running

```powershell
dotnet run --project backend/tools/Jaarplanner.Eval -- `
  --evalset eval-data/sjceik-kleuter.json `
  --models gpt-5.4-mini `
  --embedding text-embedding-3-small `
  --reasoning minimal
```

`--help` lists every option (`--variants`, `--embedding`, `--top`, `--max`, `--goal-format`, `--reasoning`, `--out`).
The report lands in `eval-data/rapport-<date>-<time>.md`.

## The evalset format

```json
{
  "formaatversie": 1,
  "omschrijving": "Kleuterklassen school 1, gekoppeld zonder AI, september 2026",
  "opstapVersie": "<the Op.stap version the codes refer to>",
  "gevallen": [
    {
      "id": "k3-bakker",
      "thema": { "naam": "Beroepen", "invalshoeken": "...", "gekozenThemadoelCodes": [] },
      "subthema": {
        "naam": "De bakker",
        "leeftijd": "K3",
        "onderzoeksvragen": [ { "vraag": "...", "probleemstelling": "..." } ],
        "activiteiten": [ { "naam": "...", "type": "...", "hoek": "...", "verwachteUitkomsten": "..." } ]
      },
      "goudenCodes": [ "<leerplandoel code>", "..." ]
    }
  ]
}
```

- `thema` and `subthema` are the wizard's own records (`ThemaOpbouwContext`, `SubthemaOpbouwContext`), so a case
  reaches the model through exactly the fields production renders. That is also why the format's field names are
  Dutch.
- `leeftijd` is the jaar/fase (JK, K2, K3, L1 to L6) the candidates come from.
- `goudenCodes` are the codes a teacher linked **without having seen an AI suggestion** for that subthema. Once
  suggestions are visible, a teacher's links measure the AI against itself.
- A teacher's gold set should be **complete**: every goal they really work on in that subthema. A missing goal turns a
  good suggestion into an "error".

## Reading the report

- **Precisie:** the share of proposed codes that are in the gold set.
- **Recall:** the share of gold codes that were proposed.
- **Bij de kandidaten:** the share of gold codes that were in the candidate list. Recall cannot exceed it, so a low
  value here is a retrieval problem, not a model problem.
- **Tokens, cost and latency** count every call that got a response, a rejected answer included, because it was
  billed. Latency is the last attempt's, without the wait after a 429.
- A **warning** lists gold codes outside the subthema's jaar/fase (or missing from the catalogue).

Precision and recall are micro-averages over the cases of one variant and model.

## Language

The report, the console output and the messages are Dutch because they are addressed to the owner (Art. II.6,
clause 1). The options, the configuration keys, the code and this README are English (Art. II.2). The evalset format
and the report's own vocabulary (`gevallen`, `goudenCodes`, `Treffers`) stay Dutch, because they are the domain records
and the words the owner reads.
