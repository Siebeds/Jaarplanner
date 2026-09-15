# FB-036 — antagonist

## Round 1 (on 2ac22b2): VIOLATIONS FOUND, one MAJOR

**MAJOR — the wizard's subthema delete removed colleagues' woordwebs and got around D5.** Under D2 anyone may keep a
web on a subthema an open wizard run created. `WizardrunService.VerwijderSubthemaAsync` counted only subdoelen and
activiteiten someone else put under it, so the cascade FK took a colleague's web along, against I25 ("what the same run
created, and nothing else"); and themabeheer could empty a thema in the wizard first and then pass D5's thema delete.

*Fixed:* the wizard's subthema delete refuses a subthema that holds any woordweb, with its own Dutch sentence
("Op dit subthema houdt iemand een woordweb bij. Dat zou mee verdwijnen, dus de wizard verwijdert het niet.").
`WoordwebEndpointsTests.Themabeheer_verwijdert_geen_nieuw_thema_waarop_een_collega_een_woordweb_bijhoudt` now also
takes the two-step route and checks the web survives. Recorded in ADR-0041 and the Art. VI.1 defaults bullet.

**MINOR, all fixed:**

1. Default (e) in Art. VI.1 and FA A.11 still said a gebruiker without a right may do nothing beyond the maker's
   delete right: both now name keeping a woordweb of one's own (D2).
2. The amendment stated two things W1–W7 did not rule. "Outside the wizard" (IV.8, FA A.7) now reads "whether the
   wizard shows it too is E6-05's"; "every signed-in gebruiker reads every woordweb" is now default **D7** (ADR-0041,
   VI.1, FA A.11).
3. ADR-0030 §3 had no row for `WoordwebBewerken`: added, with footnote ⁹.
4. The GET sent other people's open proposals and rejected words to every reader, though the screen hid them: the
   server now sends another person's web with its standing words only (D7), and the AI test checks what a colleague
   receives.

Gates after the fixes: backend unit 1727 passed; integration (woordweb, wizard, write-route sweep, rights) 54/54
against PostgreSQL; `dotnet format` clean. No frontend file changed.

## Round 2 (on 251a5e9 and 51da344): COMPLIANT

A re-audit of the MAJOR only (ADR-0037). **Resolved:** the wizard's subthema delete refuses while any woordweb is on the
subthema, inside its transaction and before the cascade; the two-step route is tested; the rule is stated as a default
(I25) in Art. VI.1, ADR-0041, ADR-0030 §3 footnote 9 and FA A.11.

**No new CRITICAL or MAJOR.** The antagonist checked every other path that could remove someone else's woordweb:

- The thema delete is guarded by D5.
- The ordinary subthema delete is directie's and the hoofdleerkracht's, under D4, with the count in the confirmation.
- The FR-1 import removes no thema or subthema.
- Removing a gebruiker cascades only her own webs.
- The D7 read filter only sends less.
