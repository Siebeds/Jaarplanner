# E4-02 — the accept/reject decision the kalender never had

**Story:** E4-02 (FR-7.1, Art. IV.1/IV.2). **Branch:** `story/E4-02-aanvaarden`,
off `origin/main` `8231dd2`, merged up to `fcb517f` before finishing.
**Commits:** `3795c16` (the story), `57b79c0` (the merge).

---

## What the backlog said, and what was actually missing

E4-02's line says the story still owes "the same rule for **DoelKoppelingen**". **That is already
built** and has been since E2-06/E2-08: `DoelsuggestieLijst.tsx` sends `Aanvaard`, `Geweigerd` and
`Manueel`, and E2-08 added leerplandoel substitution on top. Reading the code rather than the note is
what found the real gap.

**Nothing on the kalender could set `Aanvaard` or `Geweigerd`.** `Themakaart.tsx:490` was the only
caller of `useWijzigPlaatsingStatus` and sent only `"Manueel"`, the un-reject. Everything else
existed: `WijzigPlaatsingStatusAsync` accepts all three (it explicitly refuses only `Voorgesteld`),
`JaarplanController.WijzigStatus`, `api.ts`'s `wijzigPlaatsingStatus`, the hook, and the status badge.
**Server, endpoint, client, hook and badge; no switch.** Fifth instance of the
E2-08 / E1-15 / E0-10 / E4-06 pattern.

Two consequences, and the second was not in anybody's notes:

1. **A generated jaarplan reported 0% dekking.** Only `Aanvaard`/`Manueel` count as placed (Art. V.1),
   which **E5-01 now actually computes**, so the only route to a non-zero figure was dragging every
   card, because a move sets `Manueel` as a side effect. Measured, not inferred: see the browser pass.
2. **`Geweigerd` was unreachable, so the entire rejected-card branch was code for a state no teacher
   could produce** — `weigeringUitleg`, `vergrendelUitlegGeweigerdVast`, `weigeringEerstTerugdraaien`,
   the `kanSlepen` drag suppression, the emptied period picker, `kalenderFormat.ts:101/152`. E4-06 spent
   three audit rounds perfecting that copy against demo data and tests, and the "Weigering terugdraaien"
   button could never have been seen by a real teacher.

**So the pair was built, not just accept.** Art. IV.1 words it as one capability ("accept/reject-able"),
it is one endpoint, one hook, one guard and one extra button, and shipping accept alone would have left
the reject state dead while making the asymmetry worse. Flagged to the owner as a scope judgement rather
than assumed silently.

## The design: one structural move, no new colour

The panel held six actions of **two different kinds**:

- **decisions** (aanvaarden, weigeren) — what a `voorgesteld` card is waiting for;
- **adjustments** (verplaatsen, vastzetten, uit de periode halen).

The decision was behind the "Aanpassen" disclosure, so reviewing a dozen proposals meant opening a
dozen disclosures, and "Aanpassen" is an honest label for adjusting and a dishonest one for deciding.
**Decisions moved to the card face; adjustments stayed behind the disclosure.** Nothing else changed:
no new hue (Art. XII has spent the palette and CLAUDE.md permits one chrome accent), no new typeface,
no new structural device. Both buttons sit inside the existing actions block, above the existing
"Aanpassen" link, so no divider was added.

Weight follows `DoelsuggestieLijst` — aanvaarden filled, weigeren `outline` — so the same decision
reads the same way wherever a teacher meets it, which is the reason the status badges already share
their tokens. **The consequence is that "Verplaatsen" lost the default variant:** it was the card's
only primary, which put the loudest weight on an adjustment while the decision had no control at all.
`secondary` was not available — E7-10 records that variant at 1,16:1 against the card with no border.

Two deliberate exclusions, both applying reasoning E4-06 had already established:

- ~~**A stale card gets no decision.**~~ **Half of this was wrong and the antagonist caught it — see
  MAJOR-1 below.** The argument as written applies to *accepting* and was carried across to *rejecting*,
  which `DekkingService` shows is the one action that **resolves** a stale proposal. Left standing with
  its correction rather than rewritten, because the shape of the mistake is the useful part: one flag,
  two cases, and a conjunction that hid the difference. What survives: accepting one would produce a card
  labelled "Aanvaard" that covers nothing and **still** withholds the whole dekking figure, since E5-01
  withholds it while any unresolved stale placement exists.
- **A decided card stops asking.** The pair renders only while a decision is outstanding, so the board
  empties as the teacher works and a card with no buttons left is a reviewed card.

## Copy, which is where most of the work was (the E4-06 lesson)

Three existing strings became false or stale **because of** this story, so they were fixed here:

| String | Why it had to change |
| --- | --- |
| `vergrendelDekking` | Named two statuses and told the teacher what does *not* make a thema count, while offering no route to make it count. Now: *"Vastzetten gaat over de planning, niet over de dekking. Aanvaard het thema als het moet meetellen."* It points at a control two inches above it, and uses the button's own word. This is the sentence E4-06 ruling 3 phrased around the missing control; that reason expired. |
| `vergrendelUitlegVrij` | Presented locking as *the* way to survive a run. There are now two, and locking is the weaker one. Now it gives the lock its honest narrow purpose: keeping a card **without deciding yet**. |
| `conceptUitleg` | The header inventory of what the screen can do, which had already missed **vastzetten** since E4-06 shipped it. *(Superseded during the merge — see below.)* |

**No *general* explanation was added per card.** What a decision means for the dekking is said **once**,
above the board, because prose repeated on a dozen cards is the first thing this screen cuts.
*Amended by the fix round:* there is now exactly one per-card sentence, `beslisVervallen`, and it earns
its place by being true of the stale card and false of its neighbours — which is precisely the kind of
fact a shared line cannot carry. The original claim ("no explanation per card") is what let MAJOR-2
through: it made the absence of a sentence look like a principle rather than an omission.

Two things fixed as by-products, both in the control being refactored rather than found elsewhere:

- **The un-reject button gained the SC 4.1.3 announcement it never had.** Its status change was silent.
- **All three status controls now split a 404 from a real failure.** A 404 means this browser holds a
  stale board and reloading fixes it; "probeer het opnieuw" would be a loop that cannot succeed. Two
  prior audits (E3-07 on the move path, E4-06 on the lock) required exactly this split of a control in
  this panel, so the third one was built with it rather than after it.

`useWijzigPlaatsingStatus` is **hoisted to the card and passed into the panel**: one placement has one
status, so two instances could race, and the panel's `bezig` interlock would not have seen a decision
in flight.

## Verification

**Gates on the landing commit `57b79c0`:** 304 frontend tests (15 files), `pnpm lint` clean,
`pnpm build` clean. *Build is cited deliberately as the type check, not lint — see E7-17.*
Baseline before the merge was 213 (from 205); the jump to 304 is E3-08 and E1-13 arriving.

**Every new assertion was mutation-tested**, because a test nobody has watched fail is not evidence.
Six deliberate breaks, six caught — and the run earned its keep.

> **This sentence is true and it misled, which is worth more than the table under it (antagonist, fix
> round 1).** "Every new **assertion** was mutation-tested" reads as coverage of the new *behaviour*, and
> it is not the same claim. The audit aimed three mutations at branches no assertion touched —
> `beslisUitleg` deleted, both non-accept announcement branches deleted, `beslisGeweigerd` swapped for
> `beslisManueel` — and all three left the suite green. Six-for-six says nothing about what you did not
> assert. The gap is closed below; the wording is kept because the honest form of this claim is
> *"here is what I mutated, and here is what I did not"*.

| Mutation | Caught |
| --- | --- |
| Accept sends `Manueel` instead of `Aanvaard` | 2 tests |
| The `!isVervallen` guard removed | 1 |
| The **non-clicked** button loses its `variables` guard | 1 |
| The 404 split removed | 1 |
| The live region moved inside the block that unmounts | 1 |
| The decision pair not rendered at all | 6 |

**The first attempt found a real hole in my own test.** Mutating the *clicked* button's busy branch left
the suite green, and my first reading was "mis-aimed mutation". It was both: the mutation was aimed at
the branch the assertions do not discriminate on, **and** the test only pinned one of the two
directions. Rewritten as `it.each` over both, which the mutation then caught. Recorded because
"the mutation was wrong" was the comfortable conclusion and it was half false.

**Browser pass, on the merged tree, against a live API and real PostgreSQL** (`jp_e402`, migrated from
the real migrations), at 1440px and 390px:

- **The story's central claim, end to end:** pressing "Aanvaarden" took `GET /api/klassen/{id}/dekking`
  from **0 of 2 gedekt to 2 of 2**, through the real hook, the real `PUT`, the real EF store and
  E5-01's real computation, with the placement read back from PostgreSQL as `Aanvaard`. This is the
  composition E5-01's own audit recorded as missing from its story.
- **Full round trip:** `Voorgesteld` → `Geweigerd` **by keyboard** (Tab, Enter; focus ring measured
  `rgb(21,39,46)` at 2.4px) → `Manueel` via "Weigering terugdraaien". Each step announced in its live
  region; the drag grip and the period picker disappeared and returned as the status dictates.
- **All four (status, isVervallen) states rendered.** ~~The stale `Voorgesteld` card correctly offers no
  decision~~ — **this observation was accurate and the word "correctly" was the error.** It offered none because
  of the defect MAJOR-1 fixed; after the fix round it offers "Weigeren" and not "Aanvaarden", re-verified in the
  browser. Kept visible because it is the sharpest example of the trap in this whole story: a browser pass
  confirms what the code *does*, and calling it "correct" smuggles in a judgement the browser cannot make.
  `Aanvaard` and `Geweigerd` cards offer no decision, which is unchanged.
- **E3-08's fine tier**, which only became testable after the merge: the pair renders **and works**
  there too (a rejection driven on the Subthemaperiodes view persisted, and left `BlokNiveau`
  untouched). That confirms the merge decision not to tier-pair `beslisUitleg`.
- **Contrast, alpha composited:** Aanvaarden fill 8,90:1 against the card (so the fill itself carries
  SC 1.4.11, and it has no border); Weigeren's `outline` border 3,40:1; text 8,90:1 and 15,42:1.
  Exactly **one** filled button per card after the "Verplaatsen" demotion, with the destructive control
  still distinct at `rgb(103,54,20)`.
- **390px:** the card is 266px inside a 375px viewport, both decision buttons on one row, and the page
  does **not** scroll horizontally (`body.scrollWidth === clientWidth === 375`). The 680px
  `documentElement.scrollWidth` is the ribbon's content inside its own `overflow-x-auto` (629 in 347),
  which is the design. Stated precisely rather than as "no overflow", because the naive check reports
  overflow here and is wrong.

*Not claimed:* no real-browser axe run. The suite's axe checks run in jsdom, which cannot evaluate
colour, so the palette was measured directly instead. That is the honest split, not a substitute.

## The merge, because one resolution was a decision

E3-08 and E1-13 landed while this was in flight. Conflicts in `Themakaart.tsx` were additive (both
sides added a `Bewerkpaneel` prop). `Jaarplankalender.test.tsx` was rebuilt on `origin/main`'s file
rather than resolved line by line, since both sides had restructured it.

**`conceptUitleg` went to E3-08, and that was a judgement rather than a default.** I had extended it
with the capability list plus the dekking rule; E3-08 deliberately moved the inventory *out* of that
string and made the vocabulary tier-aware. Taking mine would have quietly undone their redesign. The
dekking sentence became its own key, `kalender.beslisUitleg`, rendered above the board beside E3-08's
tier sentence and **deliberately not paired through `BORDUITLEG`**: a decision is available on every
proposal in every view, which the fine-tier browser check then confirmed. The "or move it yourself"
half was dropped, because that is only true on the tier where moving works.

## Findings that are not this story's

1. **`kalender.indelingUitleg` is dead** — zero references in `frontend/src`. It is the string the
   E3-06 audit introduced *to replace* a server-generated Dutch label (cited as the fix in the Art. II.3
   entry in `backlog/README.md`), so the kalender explains its period grain to nobody. The dead-key
   guard in `catalogus.test.ts` is scoped to `doelen.*`, so nothing catches it. **Reported, not fixed.**
2. **SC 2.5.8 Target Size:** the "Aanpassen" disclosure measures **61×16 CSS px** and "Aanpassen
   sluiten" 102×16, against a 24×24 minimum. Styled as an underlined text link, so the inline exception
   is arguable but weak for a standalone control. Predates this story (E3-06/E3-07); my own buttons are
   106×36 and 91×36. **Routed to E7-10.**
3. **Stale placements and dekking interact more sharply than either story states.** With one unresolved
   stale `voorgesteld` placement, dekking returned `isBetrouwbaar: false` and `aantalGedekt: null`, so
   no accept anywhere in the plan can move a figure the API refuses to give. That is E5-01 as ruled, but
   the teacher's way out is now a **weigering**, which is the one action that clears `onopgeloste` and hands the
   figure back. *Corrected after the fix round, which inverted this:* it used to read "combined with this story's
   deliberate choice to offer no decision on a stale card, the teacher's only way out is re-placement or removal".
   **What E5-02 must be handed is therefore sharper than a line of copy.** `kalender.herzienUitleg` ends "Zolang
   dit openstaat is de dekking van dit jaarplan onbetrouwbaar", and `vervallenPlaatsingen` filters on staleness with
   **no status filter**, so after a weigering the card stays in the "Te herzien" notice under that sentence while
   the API reports `isBetrouwbaar: true, onopgeloste: 0`. E5-01 already filed that divergence against **E5-02**
   (see [E5-dekking-export.md](../../E5-dekking-export.md)); what changed is that it is no longer a corner case but
   **the advertised remedy**. No teacher can see the contradiction today, because no dekkingsoverzicht exists.
4. **A teacher can now directly create a stale *rejected* card**, which is the combination **E3-07 is
   reopened over**. One press of "Weigeren" on a stale proposal produces it, and `kalender.beslisVervallen`
   recommends that press. The indirect route still exists too (reject a placed card, then the school edits
   its vakantiedata), so the state has gone from *hard to reach* to *routine*. **This story does not close
   E3-07; it enlarges what E3-07 owes**, and E4-02 fixed only the one instance it created itself
   (`kalender.weigeringUitlegVervallen`).
   > *Rewritten three times, and the third rewrite is the finding (antagonist round 3).* It first said the
   > opposite. Fix round 2 corrected the headline **and left the old sentence's reason clause attached**, so
   > it read "a teacher CAN now … because the stale card offers no decision" — a claim and its own negation
   > in one sentence, produced inside the fix for exactly that class, in the item that fix had singled out as
   > "the one that mattered". **The mechanism worth naming: I edited the clause I had noticed and left the
   > grammar around it.** A partial in-place substitution reads as fixed to whoever wrote it and as nonsense
   > to whoever reads it next. Rewrite the whole sentence, or do not touch it.

## For the next story

- **E4-01** still owns "live coverage reflection". The write half is done here and E5-01 supplies the
  read, but there is no dekkingsoverzicht to reflect *into* until E5-02, so that half stays blocked.
- **E4-05/E4-07:** the six strings E4-06 listed still need re-reading when the preserve/overwrite rule
  lands. This story changed two of them (`vergrendelUitlegVrij`, and `vergrendelDekking` which is
  outside that list), so **re-read the current text, not E4-06's quotation of it.**

---

# Fix round 1 — antagonist round 1: VIOLATIONS FOUND (3 MAJOR, 7 MINOR, 2 QUESTION)

All ten addressed. The audit was right about every one of them, and two of the three MAJORs were the
same mistake wearing two hats.

## MAJOR-1 — the stale exclusion was right about accepting and wrong about rejecting

**The defect.** `magBeslissen` was one flag, so the argument for withholding *aanvaarden* on a stale card
silently annexed *weigeren*. The accept argument holds. The reject one is **falsified by E5-01's own
code**: `DekkingService` counts `IsVervallen && !IsGeweigerd` as unresolved, so **a weigering is
precisely what resolves a stale proposal** and restores the withheld figure, and that service was
written expecting the state to exist. Verified against the source rather than taken from the audit.

Without it, saying *no* to a stale proposal had two routes and both were wrong: re-placing sets
`Manueel`, which makes the thema **count** (the opposite of rejecting, and a `Manueel` card then has no
decision pair to undo it), and "Uit het jaarplan halen" is unrecoverable in a codebase with no soft
delete. So the only way to refuse a stale proposal was the irreversible one.

**Sharper than the audit put it:** `DekkingService:121-122` justifies poisoning the figure on a stale
`voorgesteld` placement with *"the teacher may still accept it, and accepting it would raise the
figure"*. My exclusion made that premise false. The conclusion survives (re-placement still raises the
figure) but the stated reason is half stale, and that is now recorded for E5-02.

**Fix.** One flag became two, `magAanvaarden` and `magWeigeren`, so the asymmetry is something a reader
has to look at rather than something a conjunction hides. **Measured end to end in a browser:** with one
stale proposal outstanding dekking reported `isBetrouwbaar: false, onopgeloste: 1, aantalGedekt: null`;
pressing "Weigeren" on that card took it to `isBetrouwbaar: true, onopgeloste: 0`, figure restored. The
fix is measured, not argued.

## MAJOR-2 — the board sentence was false about the card rendered above it

`beslisUitleg` said *"Aanvaard of weiger **elk** voorstel op zijn kaart"* while a stale card offered
neither, so the instruction could not be followed and the dekking clause offered no way out. Two changes:
the quantifier is gone (*"Je beslist per kaart: aanvaarden of weigeren."*), and the stale card now carries
`beslisVervallen` — *"Zolang dit thema in geen enkele periode staat, kan je het niet aanvaarden. Weigeren
kan wel."* Deliberately states the fact and the available action rather than instructing, because
"kies eerst een periode" would point at a picker E3-08's fine tier does not offer. This is the treatment
`vergrendelUitlegVervallen` already gives the lock, which the audit correctly noted was the screen's own
precedent arguing against me.

## MAJOR-3 — three comments arguing for the opposite of what shipped

This repo's most persistent defect class, and I produced three fresh instances in the same story that
was warned about it. All three concerned the one string I reworded:

1. `Themakaart.tsx` still defended `vergrendelDekking`'s *old* phrasing: a condition, covering both
   counting statuses, "deliberately not built here". The shipped string is an imperative naming one
   status and pointing at a button this story added. Rewritten to say what changed **and what the new
   phrasing gives up**, plus why that is acceptable *only* in the state where it renders.
2. My own comment said the dekking fact is stated once "in `kalender.conceptUitleg`" — the merge had
   moved it to `beslisUitleg` in the same commit that wrote the comment.
3. A test comment quoted `vergrendelUitlegVrij` wording this story had changed.

## MINORs

- **`beslisUitleg` was unpinned** — the audit deleted it and all 304 tests stayed green. Now asserted
  **once and outside any card**, which is the property worth having.
- **Two of three live-region branches were unasserted**, including the un-reject announcement this
  worklog **claimed as a delivered SC 4.1.3 fix**. Both now asserted. *The audit's sharpest procedural
  point, and it is about my wording:* "every new **assertion** was mutation-tested" is literally true and
  reads as coverage of the new behaviour, which it was not. Six mutations against six assertions says
  nothing about the branches no assertion touched.
- **The interlock is one-directional** and the comment claimed the race was closed. Panel-then-face is
  still open. Left open **deliberately** and now documented with its bound: every write returns the full
  plan, so the board self-corrects and nothing is lost server-side. Closing it means lifting the panel's
  whole `bezig` to the card, which is a larger change to E3-07's and E4-06's controls than this story
  should make.
- **`statusFoutmelding` mis-described its precedent:** the lock splits on 404, the move path on 400 with
  *different* semantics ("pick another period", not "reload"). Corrected to say what the two actually
  share, which is only the shape.
- **A test comment claimed `herzienUitleg` "points at a picker"** — it is the notice's intro and points
  at nothing. Gone with the rewritten test.
- **SC 2.5.3 Label in Name** breaks while a request is in flight (the `aria-label` keeps the thema name,
  the visible label becomes "Bezig…"). It is the file's existing `aanpassen`/`aanpassenSluiten` pattern
  rather than something this story invented, so it is **routed to E7-10** with the SC 2.5.8 item, and the
  drift is now recorded at the two new controls instead of being silent.
- **Backlog obligations this story discharged were left standing.** E4-01's *"this story and E4-02 must
  build the accept affordance"* is struck through rather than deleted, keeping the sentence that said
  why it mattered. `backlog/README.md` still carries the same claim in its E4 row and **I cannot edit
  it** — the lead holds that file's claim; escalated in the groepschat as a false statement rather than
  a stale count.

## Gates after the fix round

**308 frontend tests** (15 files, up from 304: five tests replaced one), lint clean, build clean.

**Eight fresh mutations against the fix round, eight caught** — including the three the audit had proved
were free before it (`beslisUitleg` deleted, the two announcement branches deleted, `beslisGeweigerd`
swapped for `beslisManueel`), plus a deliberate re-introduction of the MAJOR-1 regression itself, which
now fails two tests.

**Browser re-verified on the fixed tree:** the stale card shows "Weigeren" and the explanation and no
"Aanvaarden"; the three healthy cards show both buttons and **no** explanation; the board sentence
appears exactly once; and the rejection restored the withheld dekking figure as measured above.

**Not re-verified after the fix round:** the contrast figures and the 390px layout, which the fix round
did not touch (no token, no variant, no layout change; the stale card gained one `outline` button and one
`text-ink-zacht` sentence, both already measured shapes on this card).

---

# Fix round 2 — antagonist round 2: VIOLATIONS FOUND (3 MAJOR, 8 MINOR)

Verdicts and findings are in [`antagonist.md`](antagonist.md). This is what changed and what it cost.

**The round earned itself, because it audited the fix round as new code** rather than as a patch —
this project's own lesson from E1-13, where a round-2 fix created the MAJOR that then blocked it. Two of
its three MAJORs are defects the **fix round introduced**, and one is the same class it had just been
pulled up for.

## MAJOR-1 — five documentation statements falsified by the commit that wrote them

`cd6e3e0` made a stale proposal rejectable *and* committed the epic entry and worklog saying "a stale card
gets no decision". I struck one instance and missed five. **The one that mattered was inverted:** *"a
teacher still cannot directly create a stale rejected card"*. They now can, in one press, and that is
exactly the combination **E3-07 is reopened over** — so the sentence would have told the next reader that
E3-07's remaining work sits on an unreachable state, when this story had just made it routine. Corrected,
and the E3-07 line now says this story **raises** what that one owes.

*The lesson, and it is not "check your prose":* the documentation was authored **before** the fix and
committed **with** it, so every sentence describing the old behaviour arrived in the repo already false.
Writing docs first and fixing code second is normal; committing both in one breath without re-reading the
first is how three of this story's four documentation defects happened.

## MAJOR-2 — the new button led to a sentence promising a period that does not exist

`weigeringUitleg` closes with *"het thema komt dan als jouw eigen keuze in deze themaperiode"* — true
inside a real period, false on a stale card, where un-rejecting yields `Manueel` with `isVervallen` still
true. It also contradicted `weigeringEerstTerugdraaien` a few lines above on the same card.

**The string is E4-06's; the defect is E4-02's.** Before this story that state needed a rejection *plus* a
vakantie edit by the school. Now "Weigeren" is on the stale card and `beslisVervallen` recommends it, so
the false promise became the advertised destination. Split into `weigeringUitlegVervallen`.

*The part worth keeping:* **an existing E3-07 test was pinning the defect.** It asserted `weigeringUitleg`
for the stale case, so it failed the moment the split landed. It is now parameterised over `isVervallen`,
asserts the *other* variant is absent, and both variants keep the `"hier"` scoping E4-06 made load-bearing.
A test that fails when you fix something is worth more than one that passes.

## MAJOR-3 — the banner still calls the dekking unreliable in the state the new button resolves

`herzienUitleg` ends *"Zolang dit openstaat is de dekking van dit jaarplan onbetrouwbaar"*, and
`vervallenPlaatsingen` filters on staleness with **no status filter**, so after a weigering the card stays
in the notice under that sentence while the API reports `isBetrouwbaar: true, onopgeloste: 0`. **E5-01 had
already filed this divergence against E5-02**; what this story changed is that it went from a corner case
to the advertised remedy. The hand-off is corrected and sharpened; the string is legitimately E5-02's, and
no teacher can see the contradiction today because no dekkingsoverzicht exists. **I measured that exact
flip in the browser and did not look up at the banner above it**, which is the honest version of how this
got through.

## MINORs

- **The stale-rejection test asserted the request and never rendered the result** (default `naPlan`
  returns the unchanged plan). That is the mechanism behind MAJOR-2: the `Geweigerd × stale` screen the new
  button creates was never rendered by any test. Now it is.
- **A comment named `magBeslissen`**, which the same commit deleted.
- **`vergrendelDekking`'s `!isVervallen` guard was unpinned** — the auditor's M9 survived with 308 green —
  and the round-1 reword made losing it *worse*, because *"Aanvaard het thema"* names a button a stale card
  does not have, where the old conditional phrasing was merely vague. Now pinned.
- **The face error had no test on the state the split created** — M10 survived, so a failed weigering on a
  stale card would have failed **silently**: no alert, no reload advice. Now pinned.
- **"Routed to E7-10" was routed nowhere.** SC 2.5.8 (61×16 targets) and SC 2.5.3 (label vs busy state)
  existed only in a source comment and this worklog. Both are now **filed in E7-10**, with the
  measurements and with the reason they need one app-wide answer rather than two new controls fixed alone.
  *A story does not route a finding by naming a destination; it routes it by writing in the destination.*
- **This worklog had no `antagonist.md` beside it, and the two round-1 QUESTIONs were in no artefact.**
  Both now answered there, with the two residues that are genuinely the owner's stated as such rather than
  quietly closed.
- **`beslisUitleg` still rendered on a board with nothing left to decide.** Removing the quantifier fixed
  the stale card, not a fully decided plan, where the sentence described controls that were nowhere on
  screen. Gated on `openBeslissingen > 0`, counted over the **plan** rather than the grid, because a stale
  proposal sits in no block and is still a decision the teacher owes.

## Gates after fix round 2

**314 frontend tests** (15 files), lint clean, build clean.

**Six mutations, six caught, including the auditor's two survivors** (M9 `vergrendelDekking`'s guard, M10
the face error's gate) and both directions of the `weigeringUitleg` split, plus removing the
`openBeslissingen` gate and narrowing it to exclude stale.

**Browser re-verified:** the stale rejected card shows `weigeringUitlegVervallen` and the placed rejected
card keeps E4-06's wording; the two sentences on the stale card no longer contradict each other (*"draai
eerst de weigering terug, daarna kan je een themaperiode geven"* followed by *"terugdraaien geeft het nog
geen periode"* describe the same two steps); and with all four placements decided, `beslisUitleg` is gone
from the screen.

**Not re-verified:** contrast and 390px layout, untouched by both fix rounds (no token, variant or layout
change; the two new paragraphs use `text-ink-zacht`, already measured on this card).

---

## Round 3 — two MAJORs, both small edits, both about evidence rather than behaviour

Round 3 found **no defect in what the screen does.** Its two MAJORs are that two fixes were not
*provable*, and one of them was not even *coherent*. That is the more uncomfortable kind of finding.

1. **The correction to round 2's MAJOR-1 was self-contradicting.** I rewrote the headline of finding 4
   and left the old sentence's reason clause attached, so it read *"a teacher CAN now directly create a
   stale rejected card … because the stale card offers no decision"* — a claim and its own negation, in
   one sentence, **inside the fix for exactly that class**, in the item that fix had singled out as "the
   one that mattered". Fourth consecutive round of this project's dominant defect class.
   **The mechanism, which is the transferable part:** I edited the clause I had noticed and left the
   grammar around it. A partial in-place substitution reads as fixed to whoever wrote it and as nonsense
   to whoever reads it next. *Rewrite the whole sentence, or do not touch it.* Now rewritten whole.
2. **The MAJOR-2 fix was pinned structurally, not semantically.** Every assertion added for
   `weigeringUitlegVervallen` was either a `t(key)`-versus-`t(key)` tautology (which variant renders on
   which card) or a property **inherited from E4-06** (`"hier"`, `"hele jaarplan"`). The property the
   split existed to create — *does not promise the card a period* — was asserted **nowhere**, and the
   auditor put the false promise back with all 314 tests green. **Third round running that a fix's
   defining property turned out to be unfalsifiable.** Now pinned negatively *and* positively, plus a
   pin on the placed variant still making the promise, so the pair cannot be satisfied by flattening the
   two strings into one cautious sentence.

**Six MINORs**, and five of them are one rule applied inconsistently inside one commit:

- **`kalender.weigering*` was never in the catalogue family guard**, which polices exactly the
  hergeneratie claim both its members make. This story added the second member. The prefix now covers it,
  free of charge (both values already satisfy the assertion), and a third variant can no longer escape.
- **The epic entry's own status line still said "Awaiting the antagonist audit"** after two audits and two
  fix rounds, and its `*Verification:*` line still carried the misleading mutation sentence and a
  superseded test count — corrected in the worklog, left in the backlog. *"Fixed where noticed, left where
  not"* is the pattern round 2 graded MAJOR, recurring one file over.
- **Three of four hand-offs named a destination instead of writing in it** — the very rule this story had
  just enforced on itself for E7-10. Now written **into** their destinations: the E3-07 entry says this
  story enlarged what it owes and why; **E5-02** carries the divergence, the ruling it needs and the
  instruction not to fix it by rewording the true half; and `kalender.indelingUitleg` being dead is filed
  against **E3-06**, whose story introduced it, together with the fact that it falsifies a sentence the
  open Art. II.3 entry cites as evidence.
- **Two state gaps are now recorded as choices** rather than left implicit: the split branches on the
  server's `isVervallen` while the "Te herzien" notice uses a wider client-side predicate (deliberate:
  the copy stays aligned with the figure rather than with the notice), and `beslisUitleg` can render above
  a board whose only outstanding decision sits in the notice (deliberate: suppressing it would leave a
  decision unexplained, which is the defect the gate exists to prevent).

**One QUESTION, and it is the owner's.** Round 3 rejected my framing of MAJOR-3 as "copy E5-02 owns". The
directie ruling of 2026-07-28 says the figure is onbetrouwbaar *while any placement is unresolved*;
`DekkingService` narrows that to exclude rejected placements and **its own comment calls this "a judgement
call, not an owner ruling"**. So `herzienUitleg` is faithful to the ruling and the *service* is the
divergence — meaning the sentence that looks wrong is the true one. Filing that as a copy task is how a
rule conflict gets resolved by rewording the correct half. It belongs in the **Art. XIV** list, which
lives in `backlog/README.md`, which this session cannot edit; escalated in the groepschat and written into
E5-02 instead.

### Gates after fix round 3

**314 frontend tests** (15 files), lint clean, build clean. **Four mutations, four caught**, including the
auditor's own survivor (MU13, the false promise restored), the half-fix that merely deletes the phrase
without saying anything, flattening both variants into one, and an unscoped hergeneratie promise — which
now fails **twice**, once at the hand-written assertion and once at the widened family guard.

**No browser re-run.** Fix round 3 changed one string's *assertions*, one test-file prefix, five
documentation files and two comments. The only user-visible text touched is unchanged in content; nothing
about layout, colour or control state moved.
