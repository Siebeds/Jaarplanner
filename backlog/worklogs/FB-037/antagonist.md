# Antagonist — FB-037 stroken-doorklik (audit)

*Saved by the implementing session: the antagonist is read-only. Verdict and findings verbatim; the resolution of each
MINOR is added below the findings.*

**Verdict:** COMPLIANT
**Scope:** `main...HEAD` on `ticket/FB-037-stroken-doorklik` (5b9b4f5, f0c924e), worktree `C:\Source\Jaarplanner\.claude\worktrees\fb-037-stroken-doorklik`

## Not blocking
- [MINOR] `frontend/src/features/plan/Subthemabalk.tsx:58`, `frontend/src/i18n/nl.json:1098` — the list's accessible name "Thema's en subthema's in beeld" now also renders when no subthema runs in view (the test "toont het thema ook als er in beeld nog geen subthema loopt" is exactly that case), so the name asserts more than its render condition guarantees (CLAUDE.md conditional-copy rule). Pick the key on `reeksen.length`, or a wording true in both cases.
- [MINOR] `frontend/src/features/plan/Agendascherm.tsx:451-459` — the 2.5.8 "equivalent control" argument rests on `themasInBeeld` naming every thema a band in the grid can link to, and that set is untested (the Subthemabalk tests hand `themas` in). Cheap fix: make it a pure function beside `themavakken` with one test.
- [MINOR] `frontend/src/features/plan/Themastroken.tsx:434`, `frontend/src/features/plan/Subthemastroken.tsx:346` — Chrome focuses an anchor on mouse click; on a ctrl/middle-click (new tab) focus is left on a link inside `aria-hidden`, and a screen reader hears nothing. `onMouseDown={(e) => e.preventDefault()}` on both links prevents the focus without stopping navigation.
- [MINOR] `backlog/E10-eigenaarsvergadering.md:91-94` — the rewritten bullet says "the rail row is the control a keyboard uses", but in the build the row's button opens verrijkingen and the separate icon link beside it goes to the chapter; the unchanged line above still says "Each row is a single control". Name the link, not the row.

## What I checked and found compliant
- **Art. XII / ADR-0024 colour:** no new accent use; hover is `lijn-veld/70` / `lijn-sterk` (neutral) plus ink and underline, so state is not colour alone. Existing accent ticks and the global focus ring are within the five sanctioned uses (`frontend/src/index.css:74-82`); the balk card's `hover:border-accent` pre-existed.
- **Art. II.3 / II.5:** the two new keys and the changed label are in `nl.json`, no em dash; every `aria-label`/`title` comes from `t()`.
- **WCAG 2.1.1:** bands `tabIndex={-1}` inside `aria-hidden` (passes axe aria-hidden-focus); balk gives one link per thema and per run, in DOM order after each card's button.
- **WCAG 2.5.8:** balk links 32px tall and 28×28; the balk now also renders above the month grid (`Agendascherm.tsx:964-985`); `perThema` adds the thema of any run outside every periode, so no band's destination is missing from the balk.
- **WCAG 2.5.3:** "Open thema {naam}" contains the visible name; the icon-only subthema link relies on `aria-label` + `title`.
- **No link inside a button:** Maandrooster's day button is an overlay sibling (`Maandrooster.tsx:191-220`); Tijdraster's heading button is a sibling of the strips (`Tijdraster.tsx:507-533`); a test asserts the balk link is not inside a button.
- **FB-020 not regressed:** button, `onOpen` and preview branches unchanged; a test asserts the link does not call `onOpen`; `Verrijkingenblad` renders outside the view branch (`Agendascherm.tsx:1124`) so it works from the month too.
- **ADR-0042 supersedes, does not rewrite:** supersedes 0026 decision 5 in part; 0026 gains only a status pointer, its text marked "left as written" (line 17); index and matrix rows added.
- **Art. VI:** no server change; `GET api/themas/{themaId}` (`ThemasController.cs:45`) has no policy narrower than signed-in, so every agenda reader can open the linked page; no pupil data, no secrets, no new dependency.
- **Art. XIV / scope:** no open decision assumed; stays within FR-6.1 and the owner's rulings recorded in the ticket.

## Resolution (implementing session)

All four MINORs fixed; no re-audit round (ADR-0037: MINOR findings never start one).

1. The list is named by what it holds: `subthemabalk.label` with a run in view, `subthemabalk.labelThemas` ("Thema's in
   beeld") without; the test for the thema-only case asserts the name.
2. `themasInBereik` in `themavakken.ts`, used by `Agendascherm`, with its own tests in `themavakken.test.ts`.
3. Both band links take `onMouseDown={(e) => e.preventDefault()}`; the browser pass re-ran its clicks on them.
4. The E10-01 bullets name the link beside the row's button, and the target-size line covers both controls.
