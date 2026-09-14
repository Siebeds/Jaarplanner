# TB-004 antagonist audit, round 3 (2026-09-14)

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 6 MINOR)
**Scope:** `git diff origin/main...HEAD` after the merge of `origin/main` (`4be77dc`). The round-2 fixes `1dadda4`, `d9eb58a` and `59ce439` were read hunk by hunk. The round-2 items were verified in substance.

## Findings and what was done

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | An HTTP timeout (`TaskCanceledException`) got past every `ex is not OperationCanceledException` filter. It ended the whole run with "Gestopt" and lost every result. | Fixed. All three catches decide by the token: `when (!cancellationToken.IsCancellationRequested)`. `Program` prints "Gestopt" only when `stop.IsCancellationRequested`. Tests: `Een_timeout_van_een_chataanroep_stopt_de_run_niet`, `Een_timeout_van_een_embeddingaanroep_stopt_de_run_niet`, `Een_gevraagde_stop_stopt_de_run`. |
| 2 | `_cache.Save()` in the `finally` could replace the `CandidateSelectionException` with an `IOException`, or fail a selection that worked. | Fixed. `TrySaveCache` catches `IOException` and `UnauthorizedAccessException`, logs them and goes on. Test: `Een_cache_die_niet_bewaard_kan_worden_verandert_niets_aan_de_selectie`. |
| 3 | The retrieval table counted failed selections as retrieval misses. | Fixed. A "Fouten" column is added, and "Bij de kandidaten" counts only cases where retrieval ran. Tokens and cost still count failed cases. Pinned in `Betaalde_embeddingtokens_blijven_zichtbaar_als_de_selectie_faalt` and the first runner test. |
| 4 | The regression test for "find the repo from the path" also passed with the old code. | Fixed. `De_bewaking_herkent_een_andere_repo_dan_die_van_de_werkmap` creates a second repo in the temp folder (`git init`, `global.json`, `.gitignore`). A guard that looked at the working directory, which sits inside the Jaarplanner repo, fails it. |
| 5 | The guard probed `cache/embeddings.json`; the cache writes `cache/embeddings-<model>.json`. | Fixed. `EmbeddingCache.FileFor(model)` is public, and `Program` checks exactly the report file and, for variant B, that cache file. |
| 6 | `EvalRunner` was half renamed, and some generic verbs and nouns were still Dutch. | Fixed. The constructor parameters now match the fields (`variants`, `models`, `goalFormat`, `maxSuggestions`, `prices`, `time`). `EvalPrompt.Bouw` became `Build` (parameters `goalFormat`, `maxSuggestions`). `SelecteerAsync` became `SelectAsync`, `Cosinus` became `Cosine`, `EmbeddingAntwoord.Vectoren` became `EmbeddingResult.Vectors`, and `teksten` became `texts`. |

## Still open (not findings)

- **AC3:** the live run against Foundry, which waits for the owner's go for the deployment.
- **ADR index:** the row for ADR-0036 in `docs/adr/README.md`, which waits for the claim `kindrapport` holds on that file.
- **ADR-0036:** the owner's acceptance. Decisions 1 and 2 change the production client.
