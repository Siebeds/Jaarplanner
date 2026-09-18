# TB-032 antagonist audit (2026-09-18)

**Verdict: COMPLIANT.** No CRITICAL or MAJOR findings.

MINOR findings and what was done:

- "zodat niemand anders met je account verder kan" promised more than closing windows delivers (a Windows PRT sign-in
  survives). **Fixed:** the sentence now ends at "Sluit dan alle browservensters."
- `"cookies"` in `Clear-Site-Data` clears the whole registrable domain, which matters on a future custom domain.
  **Fixed:** stated in the doc comment of `Aanmelding.WisSitegegevens`.
- `"storage"` also wipes the per-browser light/dark choice (ADR-0027) and the remembered klas. **Documented** in the
  same comment; whether to keep `"storage"` is put to the owner.
- ADR-0031 is amended by a ticket instead of a new ADR. **Accepted** by the auditor for a change this small: the ticket
  asked for it, the body is left as written, and the index is updated.
- "Je bent afgemeld" on a page anyone can open by URL is true on the built path (the page is only reached after a
  successful `POST /api/afmelden`) but not guaranteed by the route. An honest check would read `/api/ik`, which the
  ticket rules out ("vraagt de API niets"). **Put to the owner.**

Open before the ticket can close: `https://<host>/afgemeld` in the demo's Entra app registration (an Azure change that
needs the owner's approval), then acceptance criterion 1 on the live demo.

Gates: Vitest 1232 passed, `pnpm lint` clean, `dotnet format` clean, backend unit 2134 passed, integration 569 passed
with one flaky test (`JaarplanPersistentieTests.Verwijderen_neemt_de_plaatsingen_mee`, unrelated, 3/3 on its own).
