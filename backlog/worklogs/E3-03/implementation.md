# E3-03 — Aim for full coverage over the year (FR-5.3)

**Branch:** `story/E3-03-volledige-dekking`, off `origin/main` `2a29297`.
**Status when this was written:** `[~]`. Built and self-gated; **no independent audit has run**.

## The problem the story actually had

The acceptance criterion — *"a freshly generated plan reports high coverage in E5"* — cannot be met, and not
because of a defect. A generation run persists every placement as `voorgesteld` (Art. IV.2), and only
`aanvaard`/`manueel` placements count as taught (Art. V.1), precisely so the AI cannot grant coverage
(Art. IV.1). **A freshly generated plan therefore reports 0 covered, permanently and correctly.** Satisfying the
criterion literally would have required weakening Art. V.1.

The story's own entry anticipated this and asked for a deliberate decision. The decision taken:

> Report a **`Dekkingsvooruitzicht`**: what the plan covers **today** beside what it **would** cover if the teacher
> accepted every proposal standing in it. The second figure is a prospect and is never called dekking.

Both figures travel together and both are withheld together, so no caller can present the ceiling as coverage.

## What was built

Two halves, following the split E3-02 established for FR-5.2 (the AI client is a fake in every test, Art. IV.6, so
"the model covered well" is unfalsifiable here and asserting it would assert the fake).

### 1. Asked — the prompt

`JaarplanGeneratiePromptBuilder.SystemPrompt` gained a `Dekking` section, placed **after** the spreading rules
because those are declared "in deze volgorde belangrijk" and a thema crammed into a period too short for it covers
its goals on paper only:

- cover as many **different** leerplandoelen as possible; a thema you place nowhere contributes nothing;
- place every thema at least once **as long as it fits in the blocks**, and when it does not, drop the one whose
  doelen another planned thema already carries;
- between two thema's for the same block, prefer the one with doelen not yet in the plan;
- do not repeat a thema while another has no block at all.

The user prompt now states `Aantal thema's`, beside E3-02's `Aantal beschikbare blokken`. That is what makes
"place every thema" checkable by the model, and it makes the one case these rules arbitrate — more thema's than
blocks — visible at a glance instead of discoverable halfway down a list.

The two JSON-format bullets moved under their own `Antwoordvorm:` heading; they had been hanging off the
"Spreiding" list, where a new topical section above them would have made the misfiling worse.

**Deliberately absent, and asserted as absent:** any target, percentage, or mention of the curriculum. A bar would
ask the model to judge its own coverage — the retry loop E3-02 refused to build — against a denominator it cannot
see, since it is grounded on the school's own thema's alone (Art. IV.4).

### 2. Measured — `DekkingService.BerekenVooruitzichtAsync`

Returned on `POST …/jaarplan/generatie` and rendered under the spreading report.

**It lives on `DekkingService`, and that is the load-bearing decision.** Every rule that decides coverage — which
of the four link layers count, which placement statuses count, what a stale placement does to a figure, which
goals are in scope — is applied by exactly the code that computes the real dekking. A leaner copy beside the
generator is how the two would drift, and this codebase has already paid for that class twice (the te-vol
threshold; the four link layers, where three different answers coexisted). The scope resolution was extracted into
one `BepaalBereikAsync` that both figures read, and `TelOnopgelosteVervallen` likewise, so the two cannot withhold
their numbers in different states.

New predicate: `IsVoorstelbaar` = "counts already, or is an open proposal". Written that way rather than as "not
rejected" — equivalent for the four known statuses, different for an **unrecognised** one, where this direction
fails closed like `TeltVoorDekking` already does.

**Why the controller composes it instead of the generation service.** `DekkingService` reads the plan through
`IJaarplanLezer`, which `JaarplanGeneratieService` itself implements; a dependency from the generator would close
the loop. The alternatives were a second coverage computation (rejected above) or a fourth constructor parameter
on the generation service, which would have coupled every generation test to a coverage port. So
`JaarplanController.Genereer` asks for the outlook and attaches it. **The cost is an obligation** — a new
generation endpoint must attach it too — which is written into E4-04 and E4-05 rather than left in this file.

## Verification

| Gate | Result |
| --- | --- |
| `dotnet test` unit | **584 passed, 0 skipped** (was 571; +13) |
| `dotnet test` integration | **200 passed, 0 skipped**, against real PostgreSQL |
| `pnpm test` | **478 passed** (was 470; +8) |
| `pnpm build` (`tsc -b` + vite) | clean |
| `pnpm lint` | clean |
| `dotnet format --verify-no-changes` | clean |
| Browser | 5 states × 2 widths, headless Chrome over CDP |

**The unit tests were calibrated rather than trusted.** Two mutations of `IsVoorstelbaar` were applied and the
suite re-run: `!IsGeweigerd(status)` failed exactly the unknown-status test, and `=> true` failed both that one and
the rejected-placement test. The file was restored from a copy taken before the first mutation and diffed against
it, rather than with `git checkout` — E3-07 lost two real fixes that way.

**Postgres, not in memory** (E7-16): `DekkingsvooruitzichtPostgresTests` runs a real generation with only the model
faked, then computes the outlook through the real `EfDekkingOpslag`, and asserts both the figures and that
accepting one proposal moves the figure without moving the ceiling.

**The browser pass** could not use Playwright (another session held the browser profile), so it drove headless
Chrome over CDP. The generation POST was answered in-page by wrapping `window.fetch`, because this machine has no
`AzureAI:ApiKey`; everything else was real, including the API on a scratch PostgreSQL with the demo seeder. The
figures are proven by the Postgres tests — this pass proves the rendering, the copy, the contrast and the layout:

- contrast against `bg-paper`: **14,55:1** on the figures, **5,73:1** on the muted lines and the eyebrow;
- no overflow at 1440px or at exactly 390px;
- the withheld state prints **no number at all**, and the 0-of-0 state prints a sentence rather than "0 van 0".

## Two defects the browser pass found, both in copy

1. The explanatory line first read *"Een thema telt pas mee voor de dekking zodra jij het aanvaardt"* — **the exact
   defect E4-06's owner ruling 3 fixed**, because `manueel` counts too, so aanvaarden is sufficient but not
   necessary, and a teacher who dragged a thema into a period would have been told their own decision did not
   count. It now reuses `beslisUitleg`'s ruled-on negative framing: *"Zolang een thema een AI-voorstel blijft, telt
   het niet mee voor de dekking."*
2. Both figures began with "Gedekt", so the second was tightened to *"Als je alle voorstellen aanvaardt: 9 van 14."*

## Two findings that outlived the story

- **E7-16, instance 8, and it points the other way.** `EfDekkingOpslag.HaalDekkendeKoppelingenAsync` throws
  `NotImplementedException` on the EF **in-memory** provider while running fine on Npgsql. Five pre-existing
  in-memory endpoint tests began answering 500 the moment the generation endpoint computed coverage. That fixture
  now stubs `IDekkingOpslag` (documented at the registration) and every figure it can no longer observe is asserted
  against real PostgreSQL. Filed on E7-16, whose counts were recounted from its own list while doing so: the
  heading said six, the list held seven, and this makes eight.
- **E7-17, met in the wild.** `pnpm test` stayed green with four broken type annotations in test fixtures; only
  `pnpm build` found them. The working agreement still points every session at `pnpm lint`.

## What this story does not claim

- **No minimumdoel-level figure.** Blocked on E1-12, like everything else at that level.
- **No percentage.** E5-03 owns the dekkingspercentage; a second one computed here could drift from it.
- **No gap list.** Which doelen are unreachable is the dekkingsoverzicht's per-doel list (E5-02) and E5-05's
  presentation; this reports the count.
- **The prompt half is asked, not proven.** No test here asserts that a real model achieves better coverage,
  because no test here can.
