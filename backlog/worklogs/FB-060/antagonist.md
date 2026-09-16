# Antagonist — FB-060 emoji per thema

**Verdict:** COMPLIANT (round 1, on 65ec6c58..6dd503de)

No CRITICAL or MAJOR findings. Checked: the migration only adds a nullable `varchar(32)` to `themas` (Art. IX); create
and update keep `ThemaBewerken` and the rule is enforced in `Thema.WijzigIcoon` (Art. VI.1); no pupil data; import
and dekking untouched; copy in nl.json, no em dashes, the server sentence is one a teacher can act on (Art. II.3);
the emoji is aria-hidden and always beside the name, carrying no state (Art. XII); scope inside the ticket; the
silently accepted typed emoji is as the owner asked.

## MINOR findings and what was done

1. The rule accepted bare text symbols (→, ■, ⌀) as an emoji. Fixed: symbols from the arrow, technical,
   geometric-shape and misc-arrows blocks and the loose ones (©, ®, ™, ...) count only with U+FE0F, except the few
   that display as emoji by default. The client's typed-emoji check now uses the same idea
   (`\p{Emoji_Presentation}` or a pictograph with U+FE0F). Tests added on both sides.
2. `ThemaWijziging.Icoon` defaults to null, so a PUT without the field clears the emoji. Kept: the only caller always
   sends it, and `ThemaInvoer.icoon` is required in the client type.
3. The open trigger wore the accent ring. Fixed: ink. The selected emoji cell keeps the accent (a selected item).
4. No test for Escape. Added.
5. No 403 test for setting an icoon without `ThemaBewerken`. Not added: the policy on the endpoint is unchanged and
   covered by the existing rights tests.
