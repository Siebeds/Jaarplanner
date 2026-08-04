# E5-02 — Per-class dekkingsoverzicht (FR-9.1)

**Branch:** `story/E5-02-dekkingsoverzicht` off `origin/main` `1dfe9b8` · **Commits:** `6032e59` (denominator), `e7c20d3` (screen), `e9dc200` (browser-pass fix)

Kept short on the owner's ruling of 2026-08-04 that documentation length is itself a risk: on E4-02 every late-round MAJOR sat in prose a previous fix round had written, not in the product.

## What this story was

E5-01 computed dekking, Postgres-tested it, shipped it behind an endpoint and said plainly that this was **not** FR-9, because no teacher could see it. This is that half. `/dekking` stops being a placeholder and becomes the second anchor screen.

## Two owner rulings, obtained before building

1. **E5-09's wireframes-first gate is postponed**, the same way E3-06's teacher review was. E5-09 stays open.
2. **A class is measured against its own jaar/fase by default**, with the whole curriculum as a switch. This is the Art. XIV question *"waartegen wordt een klas gemeten?"* answered **for the single-leerjaar case**; the graadklas half stays open because `Klas.Leerjaar` is one ordinal.

## The denominator (`6032e59`)

E5-01 had already built and Postgres-tested `HaalLeerplandoelenAsync(jaarFasen)` for exactly this, so resolving the ruling was a value at one call site. What had to be added is the honesty around it: the payload states the scope applied, the codes used, whether it had to widen, and how many loaded doelen it left out. A narrower denominator flatters coverage, which is the one direction this figure must never move by itself.

**The fallback direction is the load-bearing part.** `Jaarfasen.VoorLeerjaar` returns `null`, not an empty list, when it cannot map a leerjaar. An empty jaar/fase set means *"the whole curriculum"* one layer down and *"no goals at all"* to a reader, and the second would report a class as having nothing left to cover. So a refusal **widens** the scope and is declared in the payload.

E5-01 left a test whose comment said it should fail and be rewritten when the ruling landed. It did, and it was.

## The screen (`e7c20d3`)

**The summary slot is the design, and it is not a percentage.** It holds one of three things at the same weight: a count, *"nog geen betrouwbaar cijfer"* with what to do instead, or *"nog niets om tegen te meten"* when the scope is empty. That third state is the one a screen could most easily render as success, since 0 of 0 satisfies `gedekt === totaal` and would fill a progress bar.

**It discharges the reconciliation E5-01 assigned here, in copy rather than code.** The kalender's notice counts every stale placement including rejected ones; this figure counts only unresolved ones. Unexplained, a teacher reading two numbers for one apparent thing concludes the tool is broken.

**Covered is the loud state and the gap is quiet**, which is the opposite of the obvious choice: in September a freshly planned class is legitimately uncovered nearly everywhere, so a solid red chip per row would paint the normal state as an emergency and, covering the screen, stop signalling anything.

**Deliberately absent, and stated on screen rather than only in a comment:** no percentage or doelsoort filter (E5-03), no gap-analyse traceable to where a doel belongs (E5-05), no export (E5-06), and no **minimumdoel level** (E5-04, blocked on E1-12), which is the level the onderwijsinspectie actually tests.

## What looking found (`e9dc200`)

The summary said *"Zolang dat zo is, geeft dit overzicht geen cijfer"* and two lines below it every group printed **"2 van 14 gedekt"**. Group counts are additive, so a teacher could add them up and reconstruct exactly the total the directie ruling of 2026-07-28 forbids, in its misleading form: a stale placement's doelen count as niet gedekt there while what is unknown is which period they sit in. No test noticed. **The rule was enforced where someone looked and left standing where nobody did**, which is the class E4-06 named.

The row chips stay: *"this doel is covered by thema X"* is a per-doel fact that holds either way, and what the ruling forbids is a figure for the plan.

**A correction to my own evidence, in the same commit.** A grep over Chrome's `--dump-dom` output was briefly my proof that the tally was gone. `--dump-dom` serialises only the top-level document, so a grep for iframe content **could not have failed**. Re-verified by reading the facts from inside the frame.

## Verification

Browser pass with headless Chrome from Bash against a live API (port 5499), Vite (5500) and a real PostgreSQL (`jp_e502`), the app loaded in a same-origin iframe at an exact width because a headless window clamps `--window-size` to ~504px. Four states, each read from inside the frame:

| state | figure | group tally | scope |
| --- | --- | --- | --- |
| healthy, own scope | 4 van 16 doelen gedekt | present | `L3`, 1 doel left out |
| after switching | 4 van 17 doelen gedekt | present | whole curriculum, URL + request both `bereik=HeelCurriculum` |
| stale placement | **none** | **none** | `L3` |
| leerjaar 7 (graadklas) | 0 van 17 doelen gedekt | present | fallback notice shown while "Deze klas" is pressed |

Accepting a placement through the real E4-02 endpoint took dekking **0 → 4 of 16**, with the covering thema named.

Contrast, alpha composited: lowest text pair **5,08:1** (white on `dekking-gedekt`), niet-gedekt chip boundary **6,48:1**, switch track **3,40:1** (SC 1.4.11), body prose 5,73–6,08:1, the figure 15,42:1. No horizontal overflow at 1440px or at exactly 390px.

**Gates:** 554 unit + 182 integration (0 skipped, real PostgreSQL) + 348 frontend / 17 files; `dotnet format --verify-no-changes` clean; `pnpm lint` and `pnpm build` clean.

**Six load-bearing claims mutation-checked**, each restored and re-verified green: defaulting the controller to `HeelCurriculum` fails 5 endpoint tests; zeroing `AantalBuitenBereik` fails 2 unit tests; printing the withheld figure fails 5; dropping `?bereik=` from the request fails 19; a space-joined group key fails 1; removing the empty-scope state fails 5; fetching without a class fails 1; restoring the tally unconditionally fails 1.

## What this story hands on

- **E5-03 / E5-05:** the denominator is no longer the whole curriculum. Read `bereik` before printing a percentage or a gap list: one class now has two legitimate denominators, and a figure that does not say which it used is not evidence.
- **E5-04 / E5-06:** the screen states its own absence of minimumdoel level and of an export. Remove those sentences when you land, or they become false.
- **Any story with a fake of `IDekkingOpslag`:** the port gained `TelAlleLeerplandoelenAsync` and `HaalLeerjaarAsync`.
- **`DemoDataSeeder` writes an em dash into `Leerplandoel.Tekst`** (`"Voorbeelddoel 1 — demodata…"`), and this screen now renders it to a user. Pre-existing and already logged under the Art. II.3 entry as demo-fixture Dutch; logged here per E1-15's rule that the right question is *"did I make one visible?"*, not *"did I add one?"*. Not fixed here: it is the seeder's string, not this story's.

## Still open on this story

- **`kalender.herzienUitleg`** (inherited from E5-01 plus the owner ruling of 2026-08-03): the sentence is false for a **rejected** stale placement. Offered to E3-07 first, who are in that file and that card state; unanswered so far.
- **`backlog/README.md` progress table**: E5 row 1 → 2, Totaal **re-derived from the rows** rather than incremented. E3-07 holds that file.
- **The antagonist audit and a test-runner pass** have not run. Everything above is self-reported and self-measured.
