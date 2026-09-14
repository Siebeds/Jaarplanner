# TB-004 antagonist audit, round 2 (2026-09-14)

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 3 MINOR, 2 QUESTION)
**Scope:** `git diff origin/main...HEAD` on `ticket/ai-doelsuggesties-eval`, commits `9ca0df3`, `d92fa72`, `d586cee`, `1face97`, `84e9a9e`. Both round-1 MAJORs were verified as fixed.

## Findings and what was done

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | MINOR | The `Azure.Identity` comment in `Jaarplanner.Infrastructure.csproj` still described Entra as the fallback when no key is configured, and presented the managed identity as decided. | Fixed. The comment now says Entra applies only when `AzureAI:Authentication` is `Entra` (ADR-0036), and that the eval runner uses the Azure CLI credential. |
| 2 | MINOR | The public-repo guard looked for the repo from the working directory. Started from outside the repo, the runner would write into a folder of the repo that git does not ignore. It also probed `rapport.md` instead of the real report file. | Fixed. `RepoGuard.FirstUnsafe` finds the repo from each path's nearest existing folder and checks the real report path and the cache. Tests: `De_bewaking_zoekt_de_repo_vanuit_het_pad`, `Een_evalset_op_een_zichtbare_plek_valt_op`. |
| 3 | MINOR | Embedding tokens already paid for disappeared from the report when a later embedding call failed for good. | Fixed. `CandidateSelectionException` carries the tokens spent and the model, and the failure row keeps both, so the retrieval table shows them. Test: `Betaalde_embeddingtokens_blijven_zichtbaar_als_de_selectie_faalt`. |
| Q1 | QUESTION | ADR-0036 decisions 1 and 2 change the production client while still Proposed, and the key path on the v1 route is verified by nothing. | Recorded in ADR-0036 (Consequences): the key path on v1 has run only against a stub, and the first host that calls a key-based resource verifies it. The owner's acceptance is asked for. |
| Q2 | QUESTION | The ADR index row is missing because another session holds `docs/adr/README.md`. | Judged acceptable, since editing a claimed file would have been the violation. It is recorded in the ticket werklog as an item that blocks the final `klaar`. |

The round-1 open question on generic Dutch identifiers is addressed as well:

| Old name | New name |
| --- | --- |
| `RapportSchrijver.Schrijf` | `ReportWriter.Write` |
| `EvalRunner.DraaiAsync` | `RunAsync` |
| `GeheugenCatalogus` | `CachingCatalogus` |
| `EvalsetLezer.Lees` / `LeesBestand` | `EvalsetReader.Read` / `ReadFile` |
| `EvalsetFout` | `EvalException` |
| `Scoring.Scoor` | `Scoring.Score` |

The evalset format and the report records keep their Dutch domain names.

## Still with the owner

- Accept ADR-0036, especially decisions 1 and 2.
- Confirm the quota: 50K tokens per minute for each chat model, 100K for each embedding model.
- Give the go for the Foundry deployment, which AC3 needs.
- The processing register (E7-06) must name the resource before a real evalset is sent.
