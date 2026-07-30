# E3-07 — Drag-and-drop (`@dnd-kit/core`) — implementation

**Story:** [E3-07](../../E3-jaarplan-kalender.md) · **FR-6.2** (drag between periods), **FR-6.5/FR-7** (immediate
persistence, manual removal) · **ADR-0020** §3 (placements key on the block start date) · directie ruling
2026-07-28 (stale placements) · Art. IV.2 (accept/reject/**adjust**), Art. IX.3 (`vergrendeld`), Art. XII + WCAG
2.2 AA.

**Built 2026-07-30.** The teacher review that closes E3-06 was **explicitly waived by the project owner** for
this story ("no teacher assessment is needed"), so E3-07 did not wait on it. Recorded here because the story
text sequences E3-07 after that review, and a waiver that lives only in a chat log is a waiver that gets lost.

## What was built

The story turned out to be full-stack: **no endpoint to move a placement existed at all.** `JaarplanController`
had GET, POST generatie, PUT status, PUT vergrendeling and DELETE — nothing that changed a placement's period.

### Backend

| File | Change |
| --- | --- |
| `Domain/Planning/Themaplaatsing.cs` | `VerplaatsNaar(DateOnly blokStart)` — sets the new start date, moves the status to `Manueel`, clears `AiMotivatie`. |
| `Application/Planning/Generatie/OngeldigeVerplaatsingFout.cs` | **New.** A move that cannot be honoured (target is not a period boundary; thema already in the target period). |
| `Application/Planning/Generatie/JaarplanGeneratieService.cs` | `VerplaatsPlaatsingAsync` — resolves the target against the derived grid, refuses rather than snaps, no-ops an unchanged position. |
| `Api/Controllers/JaarplanController.cs` | `PUT …/jaarplan/plaatsingen/{id}/blok` with `BlokWijziging(DateOnly BlokStart)`. |
| `Api/Infrastructure/PlanningExceptionHandler.cs` | Maps the new fault to 400 alongside `OngeldigePlaatsingsstatusFout`. |

### Frontend

| File | Change |
| --- | --- |
| `features/jaarplan/api.ts` | `verplaatsPlaatsing`, `verwijderPlaatsing`, `wijzigPlaatsingStatus`. |
| `features/jaarplan/useJaarplan.ts` | `useVerplaatsPlaatsing` / `useVerwijderPlaatsing` / `useWijzigPlaatsingStatus` over one shared `usePlanMutatie`. |
| `features/jaarplan/Themakaart.tsx` | Draggable grip + the `Aanpassen` panel: period picker, remove with two-step confirm, reverse-a-rejection. |
| `features/jaarplan/Periodekolom.tsx` | Droppable column, "Hierheen verplaatsen", and the te-vol **preview**. |
| `features/jaarplan/Jaarplankalender.tsx` | `DndContext`, `PointerSensor`, `pointerWithin`, `DragOverlay`, Dutch announcements, board-level refusal message. |
| `components/ui/button.tsx` | New `destructive` variant (see the colour note below). |
| `i18n/nl.json` | 30 new keys; `kalender.conceptUitleg` corrected (it still told teachers they could not drag). |

## Decisions taken, and why

**1. A move sets the status to `Manueel` and clears the AI motivation.** `AiMotivatie` is documented as the
model's reason for placing the thema *here*; once "here" is the teacher's choice, keeping the text attributes
their decision to the model and prints a justification for a period the thema has left, which inverts what
Art. IV.3 wants the motivation to do. The existing contract already says "null for a purely manual placement".
**Cost, stated plainly:** the model's original reasoning is destroyed, not archived. It argued for a placement
the teacher overruled, and there is nowhere to keep it without new state. *This also lands E4-02's rule
("overriding an AI proposal moves it to `manueel`") early* — a drag is exactly that override, so E4-02 should
find it already satisfied for placements.

Side effect the teacher wants: `IsVervangbaar` turns false, so the next generation run cannot undo a move made
by hand. Pinned by `Een_verplaatste_plaatsing_overleeft_een_hergeneratie`.

**2. Two routes to every action, because SC 2.5.7 requires it.** WCAG 2.2 adds *Dragging Movements*: any
function achieved by dragging needs a single-pointer alternative. The `Aanpassen` panel is that alternative, and
it is also the only route that works on touch, by keyboard, and for a teacher who never discovers dragging.
**The browser check found a second reason it is not optional:** dragging from Periode 6 to Periode 2 spans the
board's horizontal scroll and could not be completed, while the picker did it in two clicks. Over a 7-period
year the picker is the *primary* route for anything but a nudge to a neighbour.

**3. The grip is not focusable and is hidden from assistive tech.** dnd-kit's `attributes` would make it a
`role="button"` tab stop driven by its `KeyboardSensor`, whose default coordinate getter steps by pixels —
across a scrolling ribbon of unequal columns that is not an interaction anyone can follow. A tab stop that
lifts a card and cannot reliably put it down is the "control that does nothing" this project banned after
E3-06. The function is fully duplicated in the panel, so the grip is a pointer affordance and says so.

**4. The delete confirmation is a two-step inline confirm, not a modal.** It replaces the button it guards, so
it cannot be missed or mis-dismissed. `components/ui/` holds a button and a badge — no dialog — so a modal
meant a new Radix dependency, a focus trap and a jsdom shim for a question that fits in the space the button
occupied. It names **the thema and the period**, which is what the E3-01 audit said makes an endpoint that
ignores status and lock safe to expose.

Confirmation fires when `status !== "Voorgesteld" || vergrendeld`, exactly the ratified rule. An untouched
proposal goes on one click because regeneration can re-propose it. Both branches are tested. *Considered and
rejected:* confirming always. It would be one fewer predicate to get wrong, but the rule is ratified and not
mine to widen, and it puts friction on the cheapest, most reversible action in the review loop.

**5. A locked placement can be moved and stays locked.** Art. IX.3 scopes `vergrendeld` to "excluded from
*regeneration*"; it is not a latch against its owner. Moving is reversible (drag it back), which is why only
deletion is confirmed. Clearing the lock as a side effect would silently expose the thema to the next run.

**6. Mutations write the server's returned plan into the cache; nothing is optimistic.** Every edit endpoint
answers with the whole plan. An invalidate-and-refetch leaves a frame where the card has been dropped but the
board still shows it in its old column, which reads as failure. An *optimistic* update would be worse: it is
the application guessing where a thema went, which is the one thing the stale-placement ruling forbids.

**7. `destructive` button = `attentie-ink`, not a new red.** Art. XII spends six hues on doelsoort and more on
suggestiestatus, so chrome gets petrol plus one attention hue; a bespoke red would be the second chrome accent.
`attentie-ink` rather than `attentie` on **margin and hierarchy**: white on `attentie-ink` is **9.93:1**, white
on `attentie` is **4.53:1** — a pass, but by 0.03, and E7-10's own entry rules that a value clearing a threshold
by hundredths is too thin to cite as evidence later. It also reads heavier than the warning tint beside it,
which is right for the card's one irreversible action. Hover measures 8.98:1.

> **Correction (antagonist audit).** This paragraph originally said white on `attentie` measured **4.31:1** and
> therefore *failed*, presented as hand-computed and browser-confirmed. It was neither: an arithmetic slip in
> the green channel, repeated into three backlog entries and a commit message. The real figure is 4.53:1. The
> decision was right and no WCAG failure shipped, but the *evidence* was false in a repo whose contrast figures
> are cited as precedent — the category this backlog has already had to retract twice. Re-derived twice since.

**8. The one place boldness was spent: the board answers "is there room here?" *during* the gesture.** A hovered
period that the incoming thema would tip over the te-vol threshold says so before the drop, with the ▲ and the
words. Phrased as a consequence, never a refusal — the threshold is still review question C's provisional 3.

## Gates

| Gate | Result |
| --- | --- |
| `dotnet build` | 0 warnings, 0 errors |
| `dotnet format --verify-no-changes` | clean |
| `dotnet test` (with `JAARPLANNER_TEST_POSTGRES`) | **454 unit + 91 integration, 0 failed, 0 skipped** |
| `pnpm lint` (eslint + `tsc --noEmit`) | clean |
| `pnpm test` | **87 passed** (was 79: +8 new, 1 rewritten) |
| `pnpm build` | clean |

New backend tests (8 service + 2 endpoint) and 8 frontend tests. See [test-report.md](test-report.md) for the
browser evidence, which is where the drag itself is verified.

**One existing test was rewritten, deliberately.** `shows a stale placement in a non-dismissible notice`
asserted the notice contained **no buttons at all** — which was how E3-06 proved non-dismissibility, and which
no version of E3-07 can satisfy, because the same directie ruling requires inline re-placement *in that notice*.
The intent was preserved and strengthened: the assertion now pins the **full set** of controls, so a dismiss,
close or "later" affordance added later still fails it.

## Deferred, with the story that owns it

- **`--input` at 1.42:1 (E7-10).** Measured again here, unchanged. The new `variant="outline"` buttons
  ("Uit deze periode halen", "Annuleren") inherit it, so this story **adds instances of a known app-wide
  SC 1.4.11 failure**. Not fixed here: the token is used by every input and outline button in the app and
  re-measuring that is E7-10's job. A local override on only these buttons would make them inconsistent with
  every other outline button. **Everything this story authored passes** — the picker deliberately uses
  `border-ink-zacht` (6.08:1) instead of the broken token.
- **"Manueel" is jargon for a non-technical teacher (nobody owns this).** Shared copy from E2's matching
  screen, so not renamed here — but a drag now *produces* this status, so E3-07 makes the word far more common
  than E2 ever did. "Zelf gekozen" or "Zelf geplaatst" reads plainer. Flagged on the backlog rather than
  silently restyling another story's screen.
- **E3-09 still owns the knelpunt rendering.** E3-07 delivers the re-placement *action* the ruling requires;
  the notice's full treatment is E3-09's.
- **E5 must refuse a dekking figure while any placement is stale** (ruling clause 4). E5 is unbuilt, so this is
  a forward obligation, now recorded on E5 as well as here.

## Not done

- **`KeyboardSensor` drag.** Deliberate — see decision 3. Keyboard users move a thema through the panel.
- **Adding a thema to a period from nothing**, and reordering within a period. E4-03 owns the former; nothing
  asks for the latter (a period holds an unordered list, Art. IX.3).
- **A live Azure AI round trip.** Unchanged from E3-01/E2-08: no `AzureAI:ApiKey` on this machine, so the demo
  seeder supplies the plan. Nothing in this story touches the AI path.
