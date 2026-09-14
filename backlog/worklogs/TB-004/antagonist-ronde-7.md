# TB-004 antagonist audit, round 7 (2026-09-14)

**Verdict:** VIOLATIONS FOUND (0 critical, 0 major, 3 minor)

**Scope:** `3212180`. The Foundry resource became fully infrastructure as code: a subscription-scoped `ai-foundry.bicep`
creates the resource group, the account moved to `ai-foundry-account.bicep`, and `deploy-ai.ps1` runs it. The default
deployments were narrowed to the two models with Data Zone quota, and ADR-0036 was accepted. The unchanged C# from
rounds 1 to 6 was not audited again.

## Findings and what was done

1. **`ai-foundry.md` contradicted itself and ADR-0036.** It said the school's dev and tst environments would use this
   resource, right after saying the resource can be deleted without touching anything else. ADR-0036, accepted in the
   same commit, says the same thing. The owner's answer behind the sentence exists only on the TB-006 branch.
   **Fixed:** the sentence is gone. The shared use belongs in the ADR that TB-006 writes, which then amends decision 3
   of ADR-0036. That is recorded in the TB-004 werklog.
2. **The region was a free option (Art. VI.3, ADR-0016).** Data Zone Standard follows the account's region, so
   `deploy-ai.ps1 -Location eastus` would have processed prompts in the US data zone. **Fixed:** the script has no
   region option any more, and the Bicep `location` parameter allows only `swedencentral`.
3. **`-Skip` accepted names it did not know.** Under `powershell -File`, `-Skip a,b` arrives as one string, and a typo
   matches nothing: everything was deployed and the script exited 0. **Fixed:** the script splits on commas and refuses
   any name that is not among the template's `modelDeployments` defaults, before anything is sent.

## Still open

- **Criterion 3:** the live run. Azure refuses the account with 715-123420, and the owner is opening a support request
  (and trying one manual deployment in the portal).
- **Before the PR:** merge `origin/main` again.
