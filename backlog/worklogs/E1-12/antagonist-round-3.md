# E1-12 — antagonist audit, round 3 (2026-09-13, narrow)

Audited: `git diff 578e039..0257d8a` (fix round 2: `b21f497` amendment text, `0257d8a` code). Verdict: **VIOLATIONS FOUND
— 0 CRITICAL, 0 MAJOR, 4 MINOR**, all doc and copy accuracy. The six DI-blocked endpoint tests were disclosed and not
counted. The response is under "Fix round 3" in `implementation.md`.

**Round-2 status.** 1 MAJOR resolved: a row without `$$expanded` or a well-formed `uniqueCode` now refuses the whole
read, so every `Problemen` key is a real ref and the `Verdwenen` / `NietIngelezen` split is exact; the live data (998
rows) has none of those, so the new refusal cannot fire today. The cost, stated on the class: one typo in KOV's data now
blocks the whole import instead of one row. 2 MAJOR resolved: all six round-2 probes are refused; both converter versions
run over live data show nothing newly refused and no accepted text changed. 3 partly (the Dutch fixed, the English docs
not; new finding 1). 4, 5, 6 resolved. 7 and 8 recorded, still the owner's or lead's. 9 answered: `krcItems` 1.2 has no
MD goal set, `Doelsoortbalk` drops zero-count doelsoorten, the register has its own minimumdoelen view.

1. **[MINOR] The English docs still say "could not", and the new `IsLeeg` doc is false for a skipped import.**
   `IMinimumdoelImportService.cs:34-35, 75, 90-95, 97`. In the `Overgeslagen` branch every stored minimumdoel went
   unread, yet all lists are empty so `IsLeeg` is true. Fix: "was not imported"; exclude the skip from `IsLeeg` or say so.
2. **[MINOR] The plural `NietIngelezenMelding` does not inflect its second sentence.** `MinimumdoelImportService.cs:154`:
   "3 minimumdoelen … De vorige tekst blijft staan." Fix: "De vorige teksten blijven staan."; update the test.
3. **[MINOR] The FR-2.2 note is not marked as the implementer's reading and carries the wrong date.**
   `docs/Functionele_Analyse_Jaarplanner.md:151` reads "(Noot 2026-09-11, ADR-0032: …)" but was written on 2026-09-13
   and its second half is an unruled interpretation; `CLAUDE.md:184` likewise dates a 2026-09-13 edit to 2026-09-11.
4. **[MINOR] Docs left behind by the wider refusal.** `OpstapBronFout.cs:3-6`, `IMinimumdoelBron.cs:15`,
   `IMinimumdoelImportService.cs:20` still say "could not be read at all"; the refusal now also covers a complete read
   refused for one unidentifiable row. ADR-0032 decision 3's refused-markup list omits a non-plain `sup` and an unclosed
   link.

Checks (abridged): Art. II; Art. III.1 (both converter versions over the 998 live minimumdoelen: 0 refused, 0 text
differences; over 5,835 G goals: the same 43 refused, 0 text differences on accepted goals; all 3 `sup` in the data are
plain powers of ten; 0 malformed known-name tags; 13 links in 4 shapes, all convert); III.3; III.4; V.6/X (targeted
78/78 including the live contract test; unit 910 passed, 1 skipped; format no output); VI, VII.2, VIII, IX, XIV, scope
untouched.
