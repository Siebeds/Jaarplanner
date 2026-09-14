# TB-004 antagonist audit, round 1 (2026-09-14)

**Verdict:** VIOLATIONS FOUND (2 MAJOR, 7 MINOR)
**Scope:** `git diff origin/main` on `ticket/ai-doelsuggesties-eval` at `4f111d0`.

## Findings and what was done

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | MAJOR | The keyless fallback changed production behaviour: a host with an endpoint and a deployment but no key used to fail with the configuration error and send nothing; it would now sign in with `DefaultAzureCredential` and send the prompt. It also made the managed-identity route live although the ticket rules it out of scope, and the test for "missing key: throws, nothing sent" was removed. | Fixed. `AzureAI:Authentication` (`Key` by default, or `Entra`) makes Entra an explicit choice. A missing key throws again before anything is sent, and the test rows are restored. "Preferred" is gone from the appsettings comment. |
| 2 | MAJOR | Three architecture decisions had no ADR: keyless authentication, the v1 route, and a second Azure resource. | Fixed with ADR-0036 (Proposed). ADR-0035 is taken by TB-005. The index row waits for the `docs/adr/README.md` claim, which another session holds. |
| 3 | MINOR | The chat cost left out billed calls whose answer was invalid, so the token and cost columns disagreed. | Fixed. The cost counts every call that got a response (`GevalResultaat.Beantwoord`). Test: `Een_ongeldig_antwoord_telt_mee_in_de_kost`. |
| 4 | MINOR | Latency included throttle waits and excluded invalid answers. Embedding tokens were lost on a retry. The token cache comment was unverified. | Fixed. Only the last attempt is timed, and invalid answers are included in the percentiles. `EmbeddingSelectie` retries each call itself, so tokens survive a retry (test: `Embeddingtokens_blijven_geteld_na_een_nieuwe_poging`). `EntraTokenProvider` caches the token until 5 minutes before expiry (test: `Het_token_wordt_hergebruikt_tot_kort_voor_het_verloopt`). |
| 5 | MINOR | Texts still described the key-only contract. | Moot after fix 1. With the default `Key`, the controller comment, E2-09's premise and `docs/dev-setup-secrets.md` are true again. The client's class doc is updated. |
| 6 | MINOR | Art. II.2: Dutch CLI options and generic identifiers; the Art. II.6 citation did not cover the case. | Fixed in part. Options and configuration keys are English (`--models`, `--variants`, `--goal-format`, `--out`, `Prices:*:Input`), as are the generic helpers (`Retry`, `RepoGuard`, `EmbeddingCache.Save`, `ReportWriter` internals). The Dutch output now cites Art. II.6 clause 1. The evalset format and the report records keep Dutch names, as domain records; the README says why. |
| 7 | MINOR | AC4 held only for the default output folder. | Fixed. Inside the repo the runner refuses an output folder that git does not ignore, and it warns about an evalset in such a place (`RepoGuard`; test: `Git_negeert_eval_data_en_verder_niets`). |
| 8 | MINOR | The eval scored codes production step 6 drops (already chosen themadoelen). | Fixed. They are dropped before scoring, as in `ThemaOpbouwAssistService` (test: `Een_gekozen_themadoel_telt_niet_mee`). |
| 9 | MINOR | One commit mixed the production change with the tool. | Fixed. The history was split before the push: AI client, ADR, eval tool, infrastructure, ticket. |

## Open questions the audit raised

- Should a school's app use its managed identity for AI? Left to TB-006; ADR-0036 decides nothing on it.
- Should Art. II.6 extend to owner-facing tooling output? Not needed: the output relies on clause 1.
- The processing register (E7-06) must name the Sweden Central resource before a real evalset is sent. This is recorded in ADR-0036 and `infra/ai-foundry.md`.
- Free text in a real evalset may contain pupil names. The README has a rule for it, and the export ticket must check it.
- The ticket asked for low quota. The Bicep now sets 50K tokens per minute for each chat model and 100K for each embedding model, pending the owner's confirmation.

## Checks the audit ran (summary)

- **Art. III:** read-only catalogue.
- **Art. IV.4/IV.5/IV.6:** prompt, parser and fakes are production's.
- **Art. VI.3/VI.4:** Data Zone Standard and `disableLocalAuth`; no secrets.
- **Privacy:** `eval-data/` is ignored, the example set is fictional, and the cache holds only the catalogue.
- **Art. VIII:** `Azure.Identity` is at the Api's version.
