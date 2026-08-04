# E1-14 landing 1 — browser pass

Run 2026-08-04 09:5x–10:2x, against a **real API and a real PostgreSQL** (throwaway database
`jp_e114` on the local Postgres 17, migrated with `dotnet ef database update`, seeded by
`Demo__Seed=true`). API on 127.0.0.1:5495, Vite on 5496 with `VITE_API_PROXY_TARGET` pointed at it.
Both ports and the database were claimed in the groepschat first and released after.

Driven with **Playwright MCP**, not CDP. Worth recording because the board's diagnostic from
2026-08-03 was right and paid off immediately: Playwright answered *"Browser is already in use"*, and
the cause was again the shared Edge profile `mcp-msedge-a1f3e3d` — six orphan `msedge.exe` processes
from 2026-08-03 18:04 plus a stale `lockfile`. Nobody held the `playwright-edge-profile` claim and
every other session had posted `LEAVE`, so the command lines were captured first, the six PIDs killed
by id, the lockfile removed, and it launched. No CDP workaround was needed.

## What was exercised (1440×900 unless stated)

| Flow | Result |
| --- | --- |
| `/themas` list against seeded data | 7 thema's, each with duur, themadoel count and uptake |
| Open a thema | school-wide zone, class zone, AI section; **no thema-id text box anywhere** |
| No klas chosen | "Kies bovenaan een klas…" and **zero** `…/voor-klas/` requests |
| Klas chosen (L3) | heading reads *"VAN L3 DERDE LEERJAAR (DEMO)"*, one request, for that klas only |
| Create "Sneeuw en ijs" | saved, navigated to the new detail, `?schooljaar=&klas=` preserved |
| The 2-or-3 advice | appeared on the new thema: *"Nog geen themadoel"* beside *"Advies: 2 of 3"* |
| Woordenschat as lines | `sneeuw/ijs/smelten` round-tripped and rendered as "sneeuw, ijs, smelten" |
| Link a leerplandoel | searched `DEMO-L3-1`, linked `DEMO-L3-10`, list count moved to "1 themadoel" (singular) |
| Unlink a themadoel | removed, and Water's advice marker appeared as its count dropped to 1 |
| Delete, refused | "Ik en mijn klas" is placed in the jaarplan: our sentence plus the server's own, *"staat nog 1 keer in een jaarplan"*. Thema still there |
| Delete, allowed | "Sneeuw en ijs" deleted, back on the list with the class selection intact |
| 390 px | no horizontal scroll (`scrollWidth == clientWidth == 375`), no element past the viewport, list correctly replaced by the detail, "Alle thema's" back link visible |

## The defect the browser found and the tests did not

After a successful delete the screen fired **`GET …/voor-klas/{klasId}` for the thema it had just
deleted**, and the server answered **404**. Cause: the shared mutation wrapper invalidates the
`["thema"]` prefix, which asks every mounted thema query to refetch, including the one being
navigated away from. Invisible locally, and one slow request away from telling a teacher
*"Dit thema kon niet geladen worden"* immediately after a delete that succeeded.

**The first fix was wrong and is worth recording:** `removeQueries(["thema", themaId])` reproduced the
same 404, because removing a query that still has a mounted observer makes that observer fetch again
at once. The fix that holds is to invalidate only the two lists that actually changed and leave the
deleted thema's own entries alone; nothing mounts them again, and a fresh visit to that URL is
answered from the bibliotheek with "dit thema bestaat niet".

Pinned by a regression test asserting **no request naming the deleted thema after the delete**, and
that test was mutation-checked: restoring the prefix invalidation fails it.

## Contrast, measured in the browser with alpha composited

| Element | Ratio |
| --- | --- |
| Section headings *"VAN DE SCHOOL"* / *"VAN L3…"* (petrol on card) | 8.90 |
| Advice marker and advice line (attentie-zacht / attentie-ink) | 9.39 |
| "Wijzigen" / "Leerplandoel koppelen" (ink on card) | 15.42 |
| "Verwijderen" and "Ontkoppelen" (geweigerd on card) | 6.48 |
| Confirm button "Ja, verwijder dit thema" (foreground on geweigerd fill) | 6.48 |
| Primary button "Nieuw thema" (petrol fill) | 8.90 |
| Muted explanatory text, status word, 12 px read-only note | 6.08 |
| Consequence sentence | 6.08 |

Every text pair is above 4.5:1, and the two 12 px cases are above it too rather than relying on the
large-text exemption. **One number below 3:1, deliberately accepted:** the confirmation panel's own
border measures 2.06:1 against its surroundings. It is a container, not a control: the panel is
identified by its heading *"Dit thema verwijderen?"* and its consequence sentence, and both controls
inside it carry their own boundary (a solid fill on the confirm, `border-input` on "Annuleren"). So
SC 1.4.11 is not engaged by the border. Recorded rather than silently left, because "it is only a
container" is exactly the reasoning that should be visible to whoever checks next.

## Corrections after the antagonist audit of 2026-08-04 (round 1)

Three things in this record needed fixing, and the third is the one that matters.

1. **A quotation that was not one.** The advice row was written as *"Nog geen themadoel · Advies: 2 of 3"*.
   The list separates those two spans with a flex gap and renders no middot; the `·` separators live in
   `Klaslaag`. Corrected above. A quoted string has to be copied, not reconstructed from memory.
2. **Two states this pass never reached**, both found by the audit instead: a thema at the **cap of three**
   themadoelen (where the server refuses the write, so the screen was offering a control that could not
   succeed), and **switching thema with a form open**, which overwrote one thema with another's values.
   Both are now fixed and pinned by tests, and both are the two-pane interaction this pass should have
   exercised. The lesson for the next pass on a list-plus-detail screen: drive the *transitions* between two
   selections, not just each selection.
3. **What the pass could not verify, stated plainly:** the audit is read-only and could not check the contrast
   table or the 390 px claim, so those numbers rest on this run alone. They were measured with alpha
   composited against the real backdrop, and the method is in the table above; anyone re-checking should
   re-measure rather than trust the figure.
