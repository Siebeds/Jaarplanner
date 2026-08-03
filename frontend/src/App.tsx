import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { BinnenkortPagina } from "./app/BinnenkortPagina";
import { NietGevondenPagina } from "./app/NietGevondenPagina";
import { JAARPLAN_PAD } from "./app/routes";
import { Doeldetail } from "./features/doelen/Doeldetail";
import { DOEL_DETAIL_PAD, DoelenPagina } from "./features/doelen/DoelenPagina";
import { ImportPagina } from "./features/import/ImportPagina";
import { DoelsuggestieReview } from "./features/matching/DoelsuggestieReview";
import { JaarplanPagina } from "./features/jaarplan/JaarplanPagina";

/**
 * Route table (E0-10, ADR-0021). Declarative `react-router-dom`; every screen renders inside {@link AppShell}.
 *
 * `/` redirects to the jaarplan — the kalender is an anchor screen (Art. VIII) and the most complete thing
 * here, so it is the honest landing page. The redirect `replace`s so Back does not bounce off it.
 *
 * The remaining `BinnenkortPagina` routes exist so the §3 information architecture is visible and clickable
 * without pretending to work; the nav marks them "nog niet beschikbaar". Keep these paths in step with
 * `app/routes.ts`, which is what the navigation renders from. **E1-16** replaced `/doelen`'s placeholder with
 * the real register and **E1-13** replaced `/import`'s, so `routes.ts` flips both entries to `isGebouwd`.
 *
 * `DoelsuggestieReview` is mounted at `/themas` because reviewing a thema's AI-suggested goals is where it
 * belongs in the IA. It still asks for a thema-id by hand: replacing that with a real thema list is
 * **E1-14**. Deliberately not fixed here — this story owns the frame, not the screens. (Generating the
 * suggestions was **E2-08**, and has since landed; the trigger sits on that page.)
 *
 * `DndContext` is gone from this level. It wrapped an app with nothing draggable in it (an E0-05
 * "library is importable" proof); **E3-07** introduces drag-and-drop and should mount it around the
 * kalender that actually uses it, together with the sensors and keyboard support that story requires.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to={JAARPLAN_PAD} replace />} />
          <Route path={JAARPLAN_PAD} element={<JaarplanPagina />} />
          <Route path="/themas" element={<DoelsuggestieReview />} />
          {/* The detail is a NESTED route, not a sibling: `/doelen/:code` renders inside the register's
              right-hand pane, which is what makes one doel deep-linkable while the list and its filters stay
              where they are (E1-16, ADR-0021). */}
          <Route path="/doelen" element={<DoelenPagina />}>
            <Route path={DOEL_DETAIL_PAD} element={<Doeldetail />} />
          </Route>
          <Route path="/dekking" element={<BinnenkortPagina uitlegKey="binnenkort.dekking" />} />
          <Route path="/import" element={<ImportPagina />} />
          <Route path="/beheer" element={<BinnenkortPagina uitlegKey="binnenkort.beheer" />} />
          <Route path="*" element={<NietGevondenPagina />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
