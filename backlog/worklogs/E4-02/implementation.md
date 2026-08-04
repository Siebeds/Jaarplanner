# E4-02 — the accept/reject decision the kalender never had

**Story:** E4-02 (FR-7.1, Art. IV.1/IV.2). **Branch:** `story/E4-02-aanvaarden`.
**Commits:** `3795c16` (story), `57b79c0` (merge of `origin/main` `fcb517f`), `cd6e3e0` / `447fe0a` /
`c6b0dde` / `e47e7e8` (fix rounds 1–4).
**Verdicts:** four antagonist rounds, all VIOLATIONS FOUND, all addressed — see [`antagonist.md`](antagonist.md).
**Independent verification:** [`test-report.md`](test-report.md), **PASS on all nine claims**.

> *Shortened at the owner's instruction, 2026-08-03.* This file was 548 lines of round-by-round narrative.
> Every audit round after the second found defects **only in text this story had added**, so length was
> itself the risk. The round history lives in `antagonist.md`; what is kept here is what the next reader
> needs. The full original is in git history at `e47e7e8`.

---

## What was missing

`Themakaart.tsx` called `useWijzigPlaatsingStatus` from exactly one place and sent exactly one status,
`"Manueel"` — the un-reject. So **neither `Aanvaard` nor `Geweigerd` was reachable from the kalender**,
while `WijzigPlaatsingStatusAsync` (which refuses only `Voorgesteld`), the controller, `api.ts`, the hook
and the status badge all existed. Server, endpoint, client, hook and badge; no switch. Fifth instance of
the E2-08 / E1-15 / E0-10 / E4-06 pattern.

The backlog said this story still owed "the same rule for DoelKoppelingen". That was already built
(E2-06/E2-08). **Reading the code rather than the note is what found the real gap.**

Two consequences:

1. **A generated jaarplan reported 0% dekking.** Only `Aanvaard`/`Manueel` count as placed (Art. V.1),
   which E5-01 now computes, so the only route to a figure was dragging every card — a move sets `Manueel`
   as a side effect.
2. **`Geweigerd` was unreachable, so the whole rejected-card branch was code for a state no teacher could
   produce.** E4-06 spent three audit rounds perfecting that copy against demo data, and its "Weigering
   terugdraaien" button could never have been seen.

Both halves of the pair were therefore built, not just accept: Art. IV.2 words it as one capability, and
shipping accept alone would have left the reject state dead while worsening the asymmetry.

## The design

**Decisions on the card face; every edit stays behind "Aanpassen".** The panel held six actions of two
kinds — decisions (what a proposal is waiting for) and adjustments — and reviewing a dozen proposals meant
opening a dozen disclosures. Weight follows `DoelsuggestieLijst`: aanvaarden filled, weigeren `outline`,
so the same decision reads the same way on both screens. **Consequence: "Verplaatsen" lost the default
variant**, because two filled buttons on a 288px card are two main actions. (`secondary` was unavailable —
E7-10 records it at 1,16:1 with no border.) The pair renders only while a decision is outstanding, so the
board empties as the teacher works.

**On a stale card the two halves part company, and this is the story's one subtle rule.**
`magAanvaarden` requires `!isVervallen`; `magWeigeren` does not.

- **Aanvaarden withheld:** accepting would produce a card labelled "Aanvaard" that covers nothing and still
  withholds the whole dekking figure. A decision that resolves nothing.
- **Weigeren offered:** `DekkingService` counts `IsVervallen && !IsGeweigerd` as unresolved, so **a
  weigering is what resolves a stale proposal** and hands the figure back. Without it, refusing a stale
  proposal had two routes and both were wrong: re-placing sets `Manueel`, which makes the thema *count*,
  and removal is unrecoverable.

The first version withheld both — one flag, two cases, a conjunction that hid the difference. That was
antagonist round 1's MAJOR, and splitting the flag is what makes the asymmetry visible to a reader.

## Copy

Changed because this story falsified it: `vergrendelDekking` (named two statuses and pointed at no
control; now points at the button above it, retiring the phrasing E4-06 ruling 3 built around the missing
control) and `vergrendelUitlegVrij` (presented locking as the only way to survive a run; now the narrow
one, for keeping a card without deciding yet).

Added: `beslisUitleg` once above the board, gated on a decision being outstanding; `beslisVervallen` on the
stale card, the one per-card sentence, because it is true of that card and false of its neighbours;
`aanvaarden`/`weigeren` plus per-thema labels; three decision announcements.

**Split because this story made a false promise reachable:** `weigeringUitleg` closes with *"het thema
komt dan als jouw eigen keuze in deze themaperiode"*, false on a stale card, where un-rejecting yields
`Manueel` with `isVervallen` still true. Before E4-02 that state needed a rejection *plus* a vakantie edit;
now "Weigeren" sits on the stale card and `beslisVervallen` recommends it. `weigeringUitlegVervallen` is
the stale variant. An existing test — E4-06's (`81b4ed9`), inside E3-07's `describe` block — had been
**pinning the defect**, and failed the moment the split landed.

Fixed as by-products in the control being refactored: the un-reject button gained the SC 4.1.3
announcement it never had, and all three status controls now split a 404 ("reload") from a real failure
("try again") — the split E3-07 and E4-06 each required of a *different* control in this same panel.

## Verification

**Independently confirmed by the test-runner** ([`test-report.md`](test-report.md)) against a live API and
real PostgreSQL, driving the browser rather than the API. Every figure came back exact:

- **Accepting moves dekking 0 of 2 → 2 of 2**, read back from PostgreSQL as `Aanvaard`.
- **Rejecting a stale proposal restores the withheld figure**: `isBetrouwbaar` false→true,
  `onopgeloste` 1→0.
- The five-state matrix, at both E3-08 tiers; the `Voorgesteld → Geweigerd → Manueel` round trip by
  keyboard only, each step announced in a real `sr-only` live region.
- Contrast **8,90:1** (Aanvaarden fill) and **3,40:1** (Weigeren border), text 8,90:1 / 15,42:1.
- Targets **106×36** and **91×36**; the pre-existing "Aanpassen" link **61×16**, a genuine SC 2.5.8 miss.
- 390px: card 266px, both buttons on one row, no page-level horizontal scroll.
- Gates: **314 tests / 15 files**, lint and build clean.

**Three qualifications the verifier added, which belong here rather than in a footnote:**

1. **"Moves the coverage figure" is leerplandoel-level only.** `minimumdoelen` has zero rows (E1-12
   blocked), so the level the onderwijsinspectie tests is untested, and no screen shows the figure yet
   (`/dekking` is still `binnenkort`). Verified at the API, not as something a teacher can see.
2. **My stated cause for the 390px `scrollWidth` was wrong** (the conclusion was right): **two** scrollers
   contribute, the nav ribbon as well as the period ribbon. The verifier also used a check I had not —
   `window.scrollTo(9999,0)` leaves `scrollX` at 0.
3. `ReferenceError: magBeslissen is not defined` in a browser console buffer is a **stale Vite HMR artefact
   of my editing session**, not a defect: that identifier does not exist at HEAD. A fresh load is clean.

Unverified, stated rather than glossed: the DoelKoppeling half of the *Done when* was taken by reference
(it is E2-06/E2-08's code, outside this diff), and the accept-versus-panel-edit race the code documents as
deliberately open was not attempted in either direction.

## Hand-offs, all written **into** their destinations

- **E7-10** — SC 2.5.8 (61×16 targets) and SC 2.5.3 (label vs busy state), both app-wide patterns, with
  measurements and the reason they need one answer rather than two controls fixed alone.
- **E5-02** — the `herzienUitleg` / `DekkingService` divergence, now carrying **the owner's ruling of
  2026-08-03**: a rejected stale placement leaves the figure trustworthy, the narrowing stands, and the
  **copy** is what changes. E4-02 had argued the opposite and was wrong.
- **E3-07** — this story *enlarges* what it owes: `Geweigerd × vervallen`, the combination it is reopened
  over, is now one press away rather than needing a vakantie edit.
- **E4-01** — the accept-affordance obligation is discharged; what remains is proving a *move* end to end.
- **E4-05/E4-07** — two of the six strings E4-06 listed have changed. Read the file, not E4-06's quotation.

## The three lessons worth carrying

1. **Re-derive every claim about the repo against `HEAD` when you commit it, and write the command beside
   it.** My "`indelingUitleg` is dead" filing was true pre-merge and false after my own merge; I asserted
   it twice more without re-checking, once into another story's entry, creating a work item nobody could
   do. One `grep -c` would have caught it.
2. **Ask what property a new test adds.** Mine asserted which `nl.json` key renders on which card — a
   tautology — plus two properties E4-06 already owned. The property the fix *existed* for was asserted
   nowhere, and an auditor restored the defect with the suite green. Three rounds running.
3. **Rewrite the whole sentence, or do not touch it.** Three of four documentation defects were partial
   in-place substitutions: I edited the clause I had noticed and left the grammar around it, which reads as
   fixed to whoever wrote it and as nonsense to whoever reads it next.
