# E3-07 — the reopening, verified against this story's own criteria (2026-08-04)

**Tree:** worktree `.claude/worktrees/e3-07-kaartstatus`, branch `story/E3-07-kaartstatus`, based on
`origin/main` `1dfe9b8` (contains E1-13, E3-08, E5-01, E4-06 **and** E4-02).
**Stack:** API `http://localhost:5497` (`/health` → `Healthy`) against PostgreSQL 17 database `jp_e307`;
Vite `http://localhost:5498`; headless Chrome over CDP on 9307.

## Why a verification was owed at all

The story left one narrow question open: *does the reopening close on E3-08's evidence, or does E3-07 owe
a verification of its own?* E3-08 measured the symptom gone three times. **All three predate E4-02**, which
landed afterwards (PR #25) and rewrote the copy on these exact cards. So the evidence was about a tree that
no longer exists.

## How the state was reached

Not by a direct database write of the final state. `Verkeer` was made **stale** the way a vakantie edit
makes a card stale (`BlokStart` → `2026-12-01`, a date that starts no themaperiode; the server then derives
`isVervallen: true`, `blokOrdinaal: null`), and the **rejection was pressed in the browser** — the route
E4-02 advertises, since `kalender.beslisVervallen` tells the teacher that weigeren is the one decision a
stale card allows. Read back from PostgreSQL: `Geweigerd | 2026-12-01`.

## 1. The reopened symptom is gone → CONFIRMED

On the stale **rejected** card, measured in the browser:

- `kalender.herplaatsKies` is **absent** (the sentence the reopening quotes).
- `<select>` count on the card: **0**. Drag grip: **absent**.
- What remains: *"Dit thema is geweigerd, dus je kan het niet verplaatsen. Draai hieronder eerst de
  weigering terug. Daarna kan je het thema een andere themaperiode geven."* plus its
  **Weigering terugdraaien** button.

The contradiction the owner reopened this story over (an instruction to pick a period, one paragraph above
a statement that the thema cannot be moved, with no picker) **does not reproduce**. The control card holds:
the stale **Voorgesteld** card in the same plan renders `herplaatsKies` **and** one `<select>`, so the
suppression is scoped to the rejection rather than blanket.

## 2. One defect inside this story's own copy → FOUND

The sentence above ends *"Daarna kan je het thema een **andere** themaperiode geven."* The paragraph
rendered directly beneath it on the same card says *"…maar dit thema staat in **geen enkele periode**: het
komt dan terug als jouw eigen keuze en heeft **nog steeds geen periode**."*

*"Andere"* presupposes a themaperiode this card does not have, and the next paragraph denies exactly that
presupposition. Same class as the reopening: one card, two sentences, one of them untrue of this state.

**Severity, stated precisely rather than inflated.** The *promise* is true: after reversing the rejection
the placement becomes `Manueel` and the picker returns, measured (`selects: 1`). Only the word *andere* is
wrong. This is a false presupposition in one word, not a false remedy.

**Neither authoring story was blind to it, and that is the useful half.** `weigeringEerstTerugdraaien`'s
second-step clause was added by **E3-08** (`62591ee`, fix round 4, owner ruling); `weigeringUitlegVervallen`
was added by **E4-02** (`447fe0a`, fix round 2). A first reading of mine assumed the two could never have
been seen together and that was **wrong** — verified with `git show 447fe0a:frontend/src/i18n/nl.json`,
which already contains the E3-08 clause. E4-02 authored the second sentence directly beneath the first. So
the pair survived E4-02's four antagonist rounds and its test-runner PASS, all of which read this card.

**Fix:** split on `isVervallen`, exactly as the paragraph two lines below already does
(`weigeringUitleg` / `weigeringUitlegVervallen`) — a stale variant without *andere*. Deliberately **not** a
reword of the shared string: the non-stale rejected card's sentence is correct and more informative, and
degrading the correct half to repair the other is the mistake E4-02 recorded on itself.

## 3. A second defect, measured, outside this story's scope → FILED, NOT FIXED

The **"Te herzien" notice** keeps the card after the rejection that resolves it, and then makes a false
statement about the whole plan. Same session, same browser, same database:

| Stale card status | The notice says | `GET …/dekking` says | |
|---|---|---|---|
| `Voorgesteld` | dekking onbetrouwbaar | `isBetrouwbaar=false`, onopgelost `1` | agree |
| **`Geweigerd`** | dekking onbetrouwbaar | **`isBetrouwbaar=true`, onopgelost `0`** | **disagree** |
| `Manueel` (after undo) | dekking onbetrouwbaar | `isBetrouwbaar=false`, onopgelost `1` | agree |

So the notice is right for every stale card **except a rejected one**, and `kalender.herzienUitleg`
(*"Zolang dit openstaat is de dekking van dit jaarplan onbetrouwbaar"*) is false one press after the screen
recommended that press.

**Root cause:** `kalenderFormat.vervallenPlaatsingen` filters on `isVervallen` with **no status filter**,
while `DekkingService` counts `IsVervallen && !IsGeweigerd`.

**Why it is not fixed here.** The owner scoped this reopening to one *card* state, and this is the notice
plus a shared selector.

**Who owns it, corrected after the antagonist audit of 2026-08-04 — this section was wrong twice, in the
direction that made this session look like the discoverer.** It read *"E3-08 filed it and routed it to E3-09
… E3-09 is still `[ ]`, so nobody holds it today"*, and dated the enabling ruling 2026-08-04. Re-derived
from the artefacts rather than from memory:

- **E5-02 owns it, in writing and with the decision already specified.** `backlog/E5-dekking-export.md:36-37`
  addresses E5-02 in the second person (*"`kalender.herzienUitleg` is the thing to fix, and it is yours"*),
  `backlog/E4-bewerking-hergeneratie.md:24` records the same hand-off, and **this story's own
  `Themakaart.tsx`** says it too (*"while E5-02's ruling on that divergence is still open"*). E3-09 was the
  earlier half of the routing; E5-02 is the later and authoritative one. So *"nobody holds it"* was false,
  and filing it a third time is the drift this backlog keeps having to retract.
- **The ruling is dated 2026-08-03**, not 2026-08-04 — stated identically in
  `backlog/E5-dekking-export.md:37`, `backlog/E4-bewerking-hergeneratie.md:24` and two E4-02 worklogs. The
  2026-08-04 timestamp belongs to E4-02's *announcement of it in the groepschat*, which is what this section
  had read. A ruling and the message reporting it are not the same event, and conflating them backdated an
  existing decision into this session's discovery.

What this session did add is a **measurement**: the three-row matrix above, which shows the divergence is
confined to exactly one status. The owner's decision of 2026-08-04 was to verify it separately and route it
afterwards; that verification is the matrix, and the routing question is whether it stays with E5-02.

## The fix, and what pins it

`Themakaart.tsx` branches the rejected card's first paragraph on `isVervallen`, exactly as the rejected
section two paragraphs below already branches `weigeringUitleg`. One new key,
`kalender.weigeringEerstTerugdraaienVervallen`, identical to the shared string minus *andere*.

**Measured in the browser after the fix**, both branches, real API + real PostgreSQL:

| Card | First paragraph ends | `andere themaperiode` | says "geen enkele periode" | `<select>` |
|---|---|---|---|---|
| `Geweigerd` + stale (`Verkeer`) | *"…een themaperiode geven."* | **no** | yes | 0 |
| `Geweigerd` in a period (`Herfst en oogst`) | *"…een **andere** themaperiode geven."* | yes | no | 0 |

**Gates:** 315 vitest / 15 files (314 on `main` + 1), `eslint --max-warnings 0` clean, `pnpm build`
(`tsc -b`, the type check that actually runs — see E7-17) clean. Backend untouched.

**Mutation testing, reported with what was *not* mutated** (E4-02's rule: six-for-six says nothing about
what you did not assert). Three mutations aimed at the branch the new assertions discriminate on, three
caught: reverting the branch to the shared string → **2** failures; giving the new key *andere* back → **1**;
swapping the two branches → **3**. **Not mutated:** the `isGeweigerd` guard itself and the picker suppression
(both already pinned by E3-08's tests, which still pass), and `vervallenPlaatsingen` (unchanged by this fix).

> **A fourth mutation existed and I did not run it — the antagonist did, and it survived (2026-08-04).**
> Inserting an adjective, *"een **andere, vrije** themaperiode"*, restores the presupposition on the stale card
> with **315 passed, 0 failed**: `/andere themaperiode/i` is a bigram, and the `toContain("geen enkele
> periode")` half is satisfied by `weigeringUitlegVervallen`, a string this fix does not touch. So the docblock's
> claim that a reword would fail here was **false when written**. Fixed by asserting word-boundary quantifiers on
> the stale key itself. Three-for-three said nothing about the mutation I did not think of, which is the whole
> point of the rule I was quoting.

**At 390px** (iframe frame width 390px; `body` measures **375px**, the 15px difference being the vertical
scrollbar — stated because a "390px" heading over a 375px figure otherwise looks like a mismeasurement, and the
antagonist correctly queried it): the sentence does not overflow its container (253px in a 297px card), and the
page does not scroll horizontally (`body.scrollWidth` 375 = `body.clientWidth` 375). A
`documentElement.scrollWidth` of 1700 was chased down rather than reported: every element past the viewport sits
inside a deliberate scroll container, the `<nav>` being `overflow-x-auto` with a 571px list in a 347px track. It
reproduces E4-02's own figure and is not a defect.
