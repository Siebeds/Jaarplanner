# TB-037 — browser check, 2026-09-21

Chrome 153 and Microsoft Edge 153, against the frontend in mock mode (`pnpm dev:mock`). Those are the engines that
draw a clear button of their own on `input[type="search"]`, so they are the engines where the defect is visible.
Firefox draws none and was never affected.

## How it was measured

`getComputedStyle(input, '::-webkit-search-cancel-button')` is useless for this question: Chrome returns the box of
the input itself, identical with and without the class. The cross was therefore measured as a real node in the
user-agent shadow DOM over CDP: `DOM.describeNode(pierce: true)` yields the node with
`pseudo=-webkit-search-cancel-button`, after which `CSS.getComputedStyleForNode` gives its `display` and
`DOM.getBoxModel` says whether it is laid out at all.

Every field got a control run: take the class off that one element in the running page and measure again. That run is
what proves the measurement can see the cross, rather than always reporting nothing.

## Result

| Field | With `eigen-wisknop` | Control: class removed |
| --- | --- | --- |
| Doelenregister, Chrome, 1280x800 | native `display: none`, no box model; 1 own clear button | `display: block`, box 10x10 at x 1150-1160: two crosses |
| Doelenregister, Chrome, 390x844 | native `display: none`, no box model | `display: block`, box 10x10 at x 268-278 |
| Doelenregister, Edge, 1280x800 | native `display: none`, no box model; 1 own clear button | `display: block`, box 10x10 at x 1150-1160 |
| Bestemmingsblad, Chrome, 1280x800 | native `display: none`, no box model; 1 own clear button | `display: block`, box at x 1206-1216 |

Clearing still works: the counter reads 26 doelen, the term "woord" leaves 2 doelen, and one press of the own button
puts it back at 26 with an empty field. On 1280 and on 390, in both browsers.

The class is not applied too widely. The two search fields without a clear button of their own keep the native cross:
rapportdoelen (`display: block`, box 10x10 at x 1234-1244) and the emojikiezer (box 10x10 at x 873-883). On both, a
click on it empties the field. There that single native cross is the only way to clear with the mouse, and it stays.

In the CSS Vite serves, the rule reads `.eigen-wisknop::-webkit-search-cancel-button { display: none; }`: bound to the
class, not an element selector.

Unit tests cannot reach this. jsdom does not evaluate `::-webkit-search-cancel-button`, so the two tests added in
`DoelenScherm.test.tsx` and `Bestemmingsblad.test.tsx` assert the class on the input instead. They catch a rewritten
`className` bringing the second cross back, not the effect itself. Both were confirmed to fail with the class removed.

## Noticed outside this ticket

`/doelen` logs a React warning before anything is searched: `Cannot update a component (DoelenScherm) while rendering
a different component (DoelenScherm)`, a setState during render. It predates this change (the diff touches two
`className` strings, one utility and two test files), but it is worth a look.

To open the rapportdoelen form, the response of `GET /api/ik` was patched in the running page (the mock user is admin,
and admin deliberately does not hold `RapportsetBewerken`). No file was changed; the search field itself is unmodified
product code.
