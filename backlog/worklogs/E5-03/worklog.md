# E5-03 — dekkingspercentage, doelsoortfilter en ontbrekende doelen (FR-9.2)

Branch `story/E5-03-percentage-filter`, off `origin/main` `b9d2786`. Seven commits, local only.

## What it delivers

FR-9.2's three halves on `/dekking`: a **dekkingspercentage**, a **doelsoortfilter**, and a **lijst van de
ontbrekende doelen** (a gaps-only view of the existing list). Plus one backend test.

**No backend behaviour changed, and that was the plan rather than a shortcut.** `DekkingWeergave.Doelen` was designed
for this and says so in its own XML doc: *"the gap-analyse (E5-05) is the subset with IsGedekt false; the doelsoort
filter (E5-03) filters this list. Both are presentation over this one computation rather than second queries that
could drift."* So the filter is client-side over one payload, by the previous story's explicit design.

## The design question the story turned out to be about

Not the percentage. **Which narrowing may touch the figure.** There are now two on this screen and they are not the
same kind of thing:

| control | changes | lives |
| --- | --- | --- |
| `Bereikschakelaar` | the denominator, **server-side** (refetches) | summary |
| **doelsoort** | what is measured, client-side — the figure follows | summary |
| **alleen ontbrekende** | only what is shown — the figure must **not** follow | on the list |

The third one is the trap. If the figure followed it, asking to see your gaps would report 0% every single time,
because every row it leaves standing is by definition uncovered. `gemetenDoelen` and `toonbareDoelen` are separate
functions for exactly this reason, and the split is pinned by a test that would otherwise pass either way.

The placement carries the distinction so the copy does not have to repeat it: the two that change the measurement sit
together with "Meten tegen"; the one that changes the view sits on the thing it changes.

**It also falsified a paragraph on `Bereikschakelaar`**, which justified its label with *"a filter hides rows and
leaves the figure alone, and this does the opposite"*. True when written, and E5-03 is the filter that changes the
figure. Rewritten rather than deleted, with the real distinction stated: server-side denominator versus narrowing the
answer already in hand.

## The two rules that had to survive

1. **The withheld figure.** `aantalGedekt` is `null` while a stale placement is unresolved (directie 2026-07-28), but
   **every row still carries its own `isGedekt`**, so a client-side count over a filtered subset reconstructs exactly
   the total the ruling withholds. That route was open to any caller. It is closed in `bepaalCijfer` alone, and the
   gate is still the server's flag — the counts moved to the rows, the *permission* did not.
2. **One source for the figure.** `bepaalCijfer` is computed once by the page and passed to the summary, the list
   header and every group. It used to be called twice; equal by construction while it took one argument, a coincidence
   to rely on once it takes a narrowed list.

## `bepaalPercentage` clamps to 1..99

Plain rounding turns `1 of 500` into **0%** and `499 of 500` into **100%**. The second is the worst thing an
inspectie-facing screen can say. The fraction is always printed beside the percentage, so the clamp is checkable by
the person reading it and not only by a test.

## Gates

**567 frontend tests / 23 files** and **15 Postgres integration tests**, 0 failed, 0 skipped. `pnpm lint`,
`pnpm build`, `dotnet format --verify-no-changes` all clean. **Twenty-six mutations across seven rounds, all
twenty-six bite.**

**Browser** (headless Chrome over CDP, real API, real PostgreSQL, 1440px and 390px): 43% unfiltered (6 of 14), 63%
narrowed to MD (5 of 8), still 63% with the gaps-only view on and only the three uncovered MD codes listed. With a
genuinely stale placement, filtered and unfiltered: no percentage, no total, no missing-count, no group tally, no
meter. No overflow at 390px, every target ≥24px, worst composited contrast **5,08:1** (E5-02's existing Gedekt badge).

*Verified in jsdom only:* the withheld + gaps-only + no-gaps state. Reaching it in a browser needs every measured doel
covered **and** a stale placement at once, which the demo seed cannot produce.

*One test run reported 1 failure I did not capture,* between two green runs and immediately after a `pnpm install` that
failed at the worktree root. Every run since is green. I cannot reproduce it and will not call it nothing.

## Seven antagonist rounds, and what they cost

Every round found something. **Six of the defects were user-facing copy, and not one was an arithmetic error.**

| round | found |
| --- | --- |
| 1 | **MAJOR** the copy told the teacher to use a control the screen did not render · **MAJOR** an MD-filtered percentage read as coverage at minimumdoelniveau · 3 MINOR |
| 2 | **MAJOR** *my round-1 fix* introduced a sentence false in two ways · 3 MINOR |
| 3 | **MAJOR** *my round-2 rewrite* was false in the opposite direction |
| 4 | 2 MINOR — the guard banned my two sentences rather than the rule |
| 5 | 3 MINOR — the standing rule I added to `CLAUDE.md` misattributed one of its own examples |
| 6 | 1 MINOR — the new query param was a contract shared by two features, declared by neither |

**Three of those were introduced by a fix round answering the audit.** That is the repo's own recorded pattern
(E3-08's two MAJOR classes came the same way) and it held here exactly.

### The empty-state sentence, three attempts

Worth writing out, because the mechanism is general.

- **v1** *"Hier staat niets zolang dit overzicht geen cijfer geeft. Los eerst de plaatsingen op, dan zie je welke doelen
  ontbreken."* — false twice. `groepen` never reads `isBetrouwbaar`, so gaps **do** render in that state and the list is
  empty only when there are none; and resolving a placement can never reveal a row, only cover more doelen.
- **v2** *"… kan je daar niet uit besluiten dat alles gedekt is."* — false the other way. `DekkingService` builds its
  covering set from `!p.IsVervallen && TeltVoorDekking(p.Status)`, so staleness only ever **suppresses** coverage. The
  inference it forbade was valid and stable under resolution.
- **v3** *"Er staan hier geen doelen om te tonen."*

**The bind, recorded so the fourth author does not rediscover it:** the one accurate explanation of the emptiness is
*"er ontbreekt niets"*, and that is `gedekt === totaal`, i.e. the withheld figure. So the slot may state the fact and
must say nothing about coverage in either direction, **including denials**. Twice I tried to explain the state; twice
the explanation was the defect. The bind only ever forbade saying something *about coverage* — it never required saying
something about coverage that is untrue.

### The general rule, now in `CLAUDE.md`

> **A conditional sentence may assert only what its own render condition guarantees.**

That is the mechanism behind all four false sentences **and** the three false code comments on this story. Each reached
past what its branch proved: *"Kies bij Doelsoort"* asserted a control another branch owned; *"tellen mee in dit
cijfer"* presupposed a figure another branch owned; v1 asserted that `groepen` consults `isBetrouwbaar` (frontend, one
file away); v2 asserted a property of `isGedekt` that `DekkingService` owns. The corollary is the operational half:
**when the honest explanation is forbidden, say less, never say something else** — a situation that recurs here by
design, because rulings empty explanatory slots (FR-11's export, E5-04's minimumdoelniveau).

### On testing copy, where I was half wrong

I claimed no key-based test can detect a lying sentence. **True of `getByText(t(key))`**, which moves with the
catalogue — reverting either false version failed no test. **Not true in general**, and this repo already disproved it:
`catalogus.test.ts` holds three families that read the **value** and assert properties of its content.

The precise split, which is the useful form: a **render** assertion catches a sentence whose *referent* is missing; only
a **catalogue** guard catches one whose *content* is false. Both now exist for this slot. The catalogue guard's
load-bearing assertion turned out not to be the keyword list but the **structural** one — the value must be a single
sentence, which is *"state the fact and stop"* expressed directly and is the only assertion that catches an arbitrary
paraphrase.

## Things this story fixed that were not its own

- **The client↔server count invariant was asserted nowhere**, including in the backend, where every assertion pins an
  absolute value. `DekkingEndpointsTests.Dekking_totalen_komen_overeen_met_de_rijen_die_ze_beschrijven` now pins it
  against real PostgreSQL. Adding 1 to the server's `AantalGedekt` fails it.
- **`DOELSOORT_PARAM`** hoisted to `app/routes.ts`, the second instance of a drift `JAARFASE_PARAM` already had a
  written answer for.

## Left for the owner

1. **`backlog/README.md`'s Art. XIV entry is recorded but not ruled on.** E5-03's gaps-only toggle renders the
   not-gedekt subset while the figure is withheld, so the tool now performs the filtering step that the recorded
   question assumed a teacher would do by hand. No figure is printed and the ruling is not breached on its own terms,
   but the exposure changed. **E5-03 ships the permissive reading by default** and the entry says so. Suppressing the
   toggle while `!isBetrouwbaar` closes both halves at once.
2. **The `[x]`, the progress table and this story's checkbox are not set**, because `file-backlog-E5-dekking-export.md`
   is held by a stale claim from the finished E5-02 session and a claim is not mine to break.

## For whoever picks up E5-05 or E5-02's follow-ups

- **`Dekkingsamenvatting`'s "Naar Inladen" link has no `search`**, so it drops the klas/schooljaar selection. The only
  cross-screen link in this feature that does not carry it — and E5-02's round-2 audit enumerated every `to={` and
  concluded the vervallen marker was the only one missing it, so that conclusion was one short. On `main`, untouched
  here.
- **A seventh backend `Doelsoort`** would render `doelsoort.undefined` into a `<select>` option and every badge. Left
  in a comment rather than guarded at runtime: Art. VII.1 fixes the six, and the shared TS union makes it a compile
  error at the mapping long before it reaches a label.
- **If you add a third figure to this screen, route it through `bepaalCijfer`.** It is the only thing standing between
  a filtered row count and the total the directie ruling withholds.
