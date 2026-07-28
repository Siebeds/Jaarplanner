# E3-10 — Test report

This is a **design story**: the deliverable is a wireframe for human review, so there is no automated test
surface. Verification was visual and structural.

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| A wireframe exists, low-fidelity | ✅ | `docs/ux/wireframes/e3-10-kalender.html`, rendered and inspected in a real browser (Chromium, 1280×1100) |
| Reviewed with directie/teachers | ✅ | Approved 2026-07-28 |
| Informs the build | ✅ | Five inherited decisions recorded in `implementation.md` and routed to E3-06/07/09 |
| Covers FR-6.1–6.5 | ✅ | Mapping table in `docs/ux/wireframes/e3-10-kalender.md` |
| Colour never the sole carrier (Art. XII / WCAG) | ✅ | doelsoort as letter+count chips; knelpunt as border + icon + word |
| Keyboard path for DnD present | ✅ | Printed on the screen, not hidden |
| `prefers-reduced-motion` respected | ✅ | Media query present; no animation used at all |
| Responsive to phone width | ⚠️ **unverified** | Stacking media query written but **not** visually checked — the browser resize tool was unavailable at the time |
| No frontend code / no `nl.json` change | ✅ | Artifact is a standalone doc under `docs/`, outside the app build; `pnpm` gates untouched |

**Note on Art. II.3.** The wireframe contains Dutch UI copy, deliberately: it is a documentation artifact,
not a component, so the "no hard-coded Dutch in components" rule does not apply to it. When E3-06 builds this
screen for real, every string must come from `frontend/src/i18n/nl.json`.
