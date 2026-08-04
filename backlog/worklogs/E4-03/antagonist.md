# E4-03 — Antagonist rounds

## Round 1 — `4a6ad37` → VIOLATIONS FOUND (1 MAJOR, 5 MINOR, 2 QUESTION)

**No code-level constitutional violation was found.** The MAJOR and three of the five MINORs are in prose:
a claim about the repository, two comments that had stopped describing their code, and one dead key. That is
the fourth story in a row here whose worst findings were in what it *said* rather than what it *did*.

### MAJOR — "recorded against the stories that own them" was false, and a `grep` was all it took

`backlog/README.md` asserted that this story's two scope gaps were recorded against their owning stories.
Neither appeared anywhere but E4-03's own entry and worklog, and **E1-14, the story named as owner, is `[x]`**,
so an unbuilt FR-7.2 verb had been handed to a story that cannot pick it up. The sentence contradicted itself
inside one clause as well, promising things were *recorded* while calling one of them *to file*. Net effect for
the hours it stood: **a story marked `[x]` against an FR it does not fully satisfy, with no open item owning
the remainder.**

**Fixed** on an owner ruling (2026-08-04): **E4-08** filed, owning FR-7.2's ninth verb×object cell (an
activiteit cannot be moved between subthema's, so the only route is delete-and-retype, losing its `hoek`, its
`verwachteUitkomsten` and every hand-made `DoelKoppeling`). E4-03's entry now states what its `[x]` does and
does not assert. The false paragraph was **replaced by its own retraction** rather than quietly softened. The
enum-casing finding is deliberately not a story (the owner was offered filing it and declined): the data was
repaired and the repair verified, so what remains is a hardening question, recorded as one.

*The lesson is not about scope:* **"this is recorded elsewhere" is a checkable claim, so check it** — one grep
over `backlog/E*.md`, plus a look at whether the destination story is still open.

### The five MINORs, all fixed

| # | Finding | Fix |
| --- | --- | --- |
| 1 | **Dead `nl.json` key** `plaatsThemaKeuzeHier`, which was *also* the missing explanation: the thema already in this period was dropped from the list, so a teacher looking at its (rejected) card in that very column found it silently absent | Rendered as a **disabled** option carrying that sentence. The submit stays gated on a real choice and `plaatsAllesAlHier` still covers "nothing selectable" |
| 2 | **`themaPeriodeOrdinalen`'s comment claimed a tier filter the code did not implement**, and the one input class it existed for is exactly the one that slipped through: each themaperiode's first sub-block shares its parent's start date, which this story's own backend test documents | Filters on `plaatsing.blokNiveau`, and the board now passes its own tier explicitly, so at the fine tier the map is correctly **empty** instead of quietly carrying fine ordinals under copy that says *"themaperiode {n}"* |
| 3 | **A reachable 404 was told to contact the administrator.** A colleague deleting a thema through E1-14's screen while this picker holds a cached list is a 404, which the teacher can fix by reloading; `Themakaart` already had the precedent | Three branches via `plaatsFoutmelding` (400 / 404 / other), new key `plaatsThemaVerdwenen`, pinned by a test and mutation-checked |
| 4 | **Focus on *opening* was unpinned**, carried entirely by React's `autoFocus` (the only occurrence in the codebase, with no lint rule), in the very component whose focus-on-*closing* bug was this story's headline finding | Test added and mutation-checked by removing `autoFocus`. Also **dropped `aria-expanded`**, which was hard-coded `false` on an element that ceases to exist when the value would be `true` |
| 5 | **`plaatsThemasFout` said "probeer het opnieuw" with no control to do it with** — an instruction pointing at nothing (the E3-06 rule applied to copy) | A real retry button reusing the board's own `kalender.roosterOpnieuw` copy, including its in-flight label, plus a test that presses it and recovers into a usable picker |

### The two QUESTIONs, recorded rather than guessed (owner ruling)

Both are wider than this story and both are now Art. XIV items in `backlog/README.md`:

1. **A `vast moment` constrains generation and nothing about a manual placement.** E3-07's move path is
   equally blind and E4-03 added the first *creation* route into such a period. The teacher registered that
   moment themselves, so silence is the tool forgetting an instruction it was given, while a refusal would
   make it override its own user. Also noted on **E4-05**, the cheapest place to settle it.
2. **Art. V.1 conditions the *link* status; `DekkingService` also gates on the *placement* status.** A real
   narrowing of a non-negotiable article, recorded by owner ruling in an epic file rather than by the
   Art. XI.1 amendment it needs. Pre-dates this story (E5-01) but is the whole justification for landing a
   hand-placement as `Manueel`.

### What the round confirmed rather than found

Worth recording, because it is evidence the design decisions were checked and not merely asserted: the auditor
verified the Art. II.3 claim itself (the jaarplan feature renders neither `error.message` nor `error.detail`
anywhere, so the two new server sentences cannot reach a screen); confirmed `Manueel` is load-bearing in both
directions by reading `IsVervangbaar` and `TeltVoorDekking`; walked the E4-06/E4-02 copy family string by
string and found **no conflict** with a hand-placed card; confirmed the status-blind occupancy check is correct
against `IsAlGeplaatst`; found nothing carrying state by colour alone; and re-derived the backlog arithmetic
independently, including the denominator from all four bracket states.

---

## Cross-check: the two gates converged

The **test-runner** returned **PASS on all eight claims with no defects**
([`test-report.md`](test-report.md)) and independently reported **two of the same MINORs** — the dead key and
the false comment — having found them by a different route. Two independent passes landing on the same two
lines is the strongest signal either gate produced.

It also went further than the story's own verification in three ways worth keeping: it built a **whole plan by
hand** (seven thema's, dekking **0 → 14/14**, `isBetrouwbaar: true`, no generation run); it drove a card to
`Geweigerd` and confirmed the picker **still** withholds that thema while a visible rejected card sits in the
column; and it ran a **control experiment** proving the AI path is unusable in that environment (no `AzureAI`
config, so `POST …/generatie` answers 500 and writes nothing) while the hand path succeeds on the same
process. That last one is the cleanest possible evidence for *"los van de AI"*.

**Its fourth MINOR is closed here too:** `PLAATSUITLEG.niveauOnbekend` was the one unexercised branch, now
pinned by a test that makes the server answer a tier the app has no name for and asserts the unknown-tier
sentence appears while the fine tier's does **not** (that one names a view the teacher may already be on).

## The fix round was re-verified in a browser, because a fix round is where the next defect lives

Every visible change from round 1 was driven in headless Chrome against a fresh database and a real API, not
just in jsdom:

- **The disabled options render exactly as intended.** In a period holding three thema's, those three read
  *"… (staat al in deze themaperiode)"* and are `disabled`, while the other four are selectable and each says
  which period it already occupies. The submit button is still `disabled` until a real choice is made.
- **axe 4.10.2 with the disabled options on screen: 0 violations**, five pre-existing `color-contrast`
  *incomplete* nodes and none of them added here. Re-run rather than assumed, because `option[disabled]` is a
  new element type on this screen and browser-default disabled text is outside our token system.
- **The failed-library state and its retry both work end to end.** Reproduced honestly by blocking
  `*/api/themas/bibliotheek*` at the network layer (CDP `Network.setBlockedURLs`) rather than by faking a
  rejection: the panel shows the sentence inside a `role="alert"`, offers "Opnieuw proberen", offers **no**
  submit, and pressing the retry after unblocking recovers into a picker with all 8 options and the error gone.

**One measured finding worth carrying, and it is app-wide rather than this story's.** In the real app that error
state takes **about seven seconds** to appear, because `main.tsx` constructs a bare `new QueryClient()` and
TanStack then retries three times with backoff, so the teacher reads *"De thema's worden geladen."* for that
whole time first. Every test harness in this repo sets `retry: false`, so **the error path is instant in tests
and slow in production**, and my first browser probe waited two seconds, concluded the retry button never
appeared, and was wrong. Not a defect introduced here and arguably the right behaviour (a transient failure
heals itself without the teacher doing anything), but it means no test in this repo measures how long any error
state takes to arrive. Recorded rather than filed, since changing the retry policy is an app-wide decision.

**A contrast divergence, recorded rather than reconciled away:** the report measures the trigger's boundary at
**3.40:1** and this story's worklog at **3.21:1**. Neither is wrong and both clear SC 1.4.11's 3:1 — they use
different backdrops. 3.40:1 is the border against the button's own solid white fill (the *inside*), 3.21:1 is
the same border against the composited `rgba(250,248,245,0.7)` well (the *outside*). SC 1.4.11 is about
adjacent colours, so both sides count and both pass; state the backdrop whenever either figure is cited, which
is the standing rule in this repo after three records of one pair disagreed.
