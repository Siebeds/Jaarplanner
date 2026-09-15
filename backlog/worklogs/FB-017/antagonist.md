# FB-017 antagonist audits

Three audits, all with the verdict VIOLATIONS FOUND on MINOR findings only. There was no CRITICAL or MAJOR finding in
any of them. Every finding is listed below with what was done about it.

## Round 1, audit A: the whole ticket

1. "Deze week loopt er geen subthema." showed while the runs were still loading, or after they failed to load.
   - **Fixed.** The agenda passes `lopend: string[] | "laadt" | "mislukt"`.
   - While loading with nothing chosen, the list shows loading rows. After a failed load it says nothing about the
     week.
2. "Deze week" read wrong in the month and day views.
   - **Fixed.** The copy names the ISO week: "Loopt in week {nummer}" and "In week {nummer} loopt er geen subthema.".
3. A chosen subthema stayed chosen for good.
   - **Fixed.** `subthemaKeuze` holds `{ subthemaId, klasId, week }` and applies only to that klas and week.
4. The section was hidden from anyone who may only read the klas, which differs from the ticket.
   - **Owner ruling, 2026-09-15:** the switch and the cards are shown, read-only. The two fiche lists remain for
     planners only.
   - Implemented in the navigation, the agenda, the panel and the section (`Leeskaart`). Recorded under the ticket's
     *Open vragen*.
5. The write-on-drop gesture and the sheet's validation were not tested.
   - **Fixed.** `kaartLanding` is the drop decision the agenda calls, and it has its own tests.
   - `Activiteitplaatsingblad.test.tsx` covers the sheet's defaults, the dropped hour, the submit, and the end-before-
     start check.
6. Question: had the page been looked at in a real browser?
   - **Answered.** See `browser-pass.md`.

## Round 1, audit B: the grab-offset fix in `tijdsleep.ts`

The diagnosis and the fix are right, and the fix may stay inside FB-017 because it is the root cause of acceptance
criterion 3.

1. A comment promised a fallback that can never fire.
   - **Fixed.** The comment is reworded and an `isConnected` guard is added.
2. Existing blocks and fiches were not driven after the fix.
   - **Fixed.** Browser checks J and K were added.
   - The te-testen log tells the functional architect that dragging existing blocks and fiches now lands where the
     item is carried.

## Round 2: re-audit of the fixes

1. The week the list talks about was not always fully read: day view, the phone's three days, or a day outside every
   periode.
   - **Fixed.** `reeksbereik` always includes the Monday–Sunday of the anchored day. Tested with a day that falls
     between two periodes.
2. "Nothing runs" was judged against the subthema's the list could offer, not against every subthema that runs.
   - **Fixed.** The sentence now needs the unfiltered week to be empty. A running subthema that the list cannot offer
     is still a run, and then the list says nothing about the week.
3. The loading and failure tests did not pin the fix: tests M1 and M3 still passed after the fix was undone.
   - **Fixed.** The panel test now waits until the subthema list has loaded before it asserts.
   - Two agenda tests were added: one where the week's read never answers, one where it fails. Neither may show the
     sentence.
4. A stale comment in `Navigatie.tsx`.
   - **Fixed.**
5. Notes, also taken up:
   - The chips on a phone now wait for the rights, as the sidebar does.
   - The panel's `magPlannen`, `activiteitenWeek` and `onKiesActiviteit` are required, so there is no fail-open default.

**Not taken up**, noted only: for a klas whose leeftijd cannot be derived, the empty-list sentence "Voor de leeftijd
van deze klas…" presupposes a leeftijd. The auditor did not trace what the endpoint returns in that case, and neither
did this ticket. It is left for whoever touches `Klasleeftijd.NietAfTeLeiden`.

Under ADR-0037 a MINOR finding does not start another round, so there was no third audit.
