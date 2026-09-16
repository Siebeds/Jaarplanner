# FB-004 — Antagonist, round 1

**Verdict: COMPLIANT.** No CRITICAL and no MAJOR finding, so no second round was needed
(Art. X.7, XIII, ADR-0037).

Audited: `git diff main...HEAD` on `ticket/FB-004-rapporttekst-herwerken`, against CONSTITUTION.md and
ADR-0035 §3.3 / §3.5 / §3.8 (R21 to R25, D13, D14).

## Fixed in `5d1db51`

- **`HerschrijfResponseParser`** passed `JsonException.Message` through into the 422 body, and that message
  quotes the offending character of the model's answer, which is a rewrite of pupil data. The class doc
  claimed it quoted nothing. Now a fixed sentence.
- **The rejection seal bound only the doel**, so a teacher who edited her own text while the panel stood open
  could put the mark on a text nobody had proposed anything for, which is the state
  `HerschrijvingGeweigerd`'s own doc says must not exist. The seal now binds the source text as well, and a
  rejection is held against the text that stands there now.
- **`WeigerHerschrijvingAsync` answered 204 when nothing was marked**, so a decision could go unrecorded in
  silence (Art. IV.2). It now refuses with the teacher's own sentence; the same change covers the case above.
- **`ZegelKloptNiet` said "Dit voorstel is verlopen"** for three causes the server cannot tell apart. It now
  says only what all three share, per the CLAUDE.md rule that a sentence asserts only what its condition
  guarantees.
- **`useHerschrijf` had no `gcTime: 0`**, so TanStack's mutation cache kept a proposal the teacher walked away
  from without deciding, for the default collection window.
- **`Naamvervanging` could substitute a child's name into a `#NAAM1#` the teacher typed herself.** Vanishingly
  rare, cheap to close: her own token maps to itself and new placeholders are numbered above it.

## Left as they are

- **The two `…HerschrijvingGeweigerd` flags are write-only.** Nothing reads them: not the API, not the screen,
  not an export. Art. IV.2 asks that the decision be kept, not that it be shown, and the ticket asks for
  neither. The cost is that a regression which stopped writing the mark would only be caught by the unit
  tests. Worth a line in FB-006 (the download) or FB-007 if a reader for it is ever wanted.
- **R25's notice is rendered inside the panel, which opens on the click that already sent the text.** The
  ticket's own acceptance criterion says exactly that ("wanneer de leerkracht op herwerken klikt, dan ziet die
  bij de knop de melding"), and CLAUDE.md forbids repeating explanatory prose per row, which showing it beside
  every rapportdoel's button would do. Whether she should read it before the first request is the owner's to
  rule, not this session's to change under him.
- **Ordinal matching misses a name typed with other capitals or a decomposed accent.** That is D14 as written
  ("the match follows the capitals of the stored name"), and R25 declares the filter best-effort. Widening it
  would start catching ordinary words, which D14 chose not to do.

## Round 2 of the browser pass, after `5d1db51`

The rejection's semantics changed after the first browser pass, so it was redone. E, F, G all still pass, and
two cases were added: the ordinary rejection right after "Bewaard" (no refusal, 204) and a rejection on a text
that changed while the panel stood open (400, "Dit voorstel geldt niet meer. Vraag een nieuw voorstel.").

The race that worried this session does not happen: clicking the AiKnop blurs the field, which makes
`useAutobewaren` save at once instead of after its 1200 ms, so the save leaves before the rewrite request. It
could not be made to fail at any timing.

One finding came out of it and is **fixed**: the panel's left column followed the live field, so a teacher who
kept typing saw "Je eigen tekst" over a sentence the AI had never seen. It now shows the text the proposal was
made for, captured when the request went out.

**One asymmetry is left for the owner.** A rejection is refused when the stored text has moved on, but an
acceptance is not: clicking *Overnemen* in that state overwrites the sentence she just typed with a proposal
made for the older one, without a word. Holding the acceptance against the source text too would mean giving
the ordinary save route a way to refuse, which is a change to the path every autosave takes and beyond this
ticket. Since the left column now shows the older text, the mismatch is at least visible before she decides.
