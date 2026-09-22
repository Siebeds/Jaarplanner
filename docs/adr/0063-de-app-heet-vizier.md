# ADR-0063 — The app is called Vizier and carries the Vizier logo

- **Status:** Accepted
- **Date:** 2026-09-22
- **Deciders:** Project owner: the name Vizier, the logo, and that the repository and infrastructure keep the name
  Jaarplanner, on 2026-09-22 (FB-083). Directie has not been asked.
- **Relates to:** [ADR-0024](0024-single-frontend-inkt-en-signaal.md) (the "Inkt en Signaal" palette the logo is drawn
  on), [ADR-0017](0017-ui-ux-design-system.md) (WCAG 2.2 AA and Dutch copy).
- **Realises:** FB-083; FB-084 and FB-085 build on it. **Constitution:** Art. II.3 and XII unchanged.

## Context

The app introduced itself as "Jaarplanner" over a three segment year bar: a working name and a mark that grew up in
the build. The school now has a brand: a drawn logo (a V of two strokes with a dot beneath it) and a wordmark that
says **Vizier**. The delivered kit is in `assets/merk/`, with its guide in `assets/merk/README.md`. What a teacher
saw in the app did not match what the logo, the manual and the rest of the communication say.

## Decision

1. **The product's name in the app is Vizier.** It is `app.naam` in `frontend/src/i18n/nl.json`, and every sentence
   a user reads that names the product says Vizier.
2. **Everything else keeps the name Jaarplanner:** the repository, the C# namespaces and assemblies, the database,
   the Azure resources, the `docs/` files, the CSRF header and the constitution's own title. Renaming those is its own
   piece of work, not a consequence of this decision.
3. **The logo replaces the year bar as the mark.** The sidebar shows the horizontal logo (mark and name), the 56px
   rail the mark alone, and the sign-in screens (afgemeld, geen toegang) the horizontal logo above their message. The
   name stays in the accessibility tree as text in every state. The year strip on the Plan screen is a different
   thing and is unchanged.
4. **The app loads the logo by fixed name from `frontend/public/merk/`.** `merk-horizontaal.svg`,
   `merk-beeldmerk.svg` and their `-donker` versions. Replacing those files with same-named ones changes the logo
   without a code change. Only `frontend/src/app/Merk.tsx` knows the box sizes.
5. **The colourway follows the app's weergave, not only the device.** Both versions are rendered and Tailwind's
   `dark:` variant shows one, so an explicit light or dark choice under Instellingen gets the right logo.
6. **The logo's colours are the palette's.** Its ink `#15181E` is `--color-inkt`, its dot `#126C78` is
   `--color-accent` (`#39B5C6` on dark is the dark accent), and its grey wing is the line greys. The dot takes the
   place of the old mark's accent segment, so the accent gains no sixth use. A change of accent hue therefore means
   redrawing the logo too.

## Consequences

- A rebrand later is four files in `public/merk/`, plus `app.naam` and the product sentences in `nl.json`, plus the
  static copy in `frontend/index.html` (FB-084, FB-085).
- A logo with other colours must be checked against Art. XII before it goes in: the palette has no room for another
  hue family.
- Code, logs and operator messages still say Jaarplanner, so a developer and a teacher use two names for one app.
  That is accepted until the rename of the repository and infrastructure is decided.
