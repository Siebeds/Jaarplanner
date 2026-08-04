import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { BinnenkortPagina } from "./app/BinnenkortPagina";
import { NietGevondenPagina } from "./app/NietGevondenPagina";
import { JAARPLAN_PAD } from "./app/routes";
import { Doeldetail } from "./features/doelen/Doeldetail";
import { DOEL_DETAIL_PAD, DoelenPagina } from "./features/doelen/DoelenPagina";
import { ImportPagina } from "./features/import/ImportPagina";
import { JaarplanPagina } from "./features/jaarplan/JaarplanPagina";
import { THEMA_DETAIL_PAD, Themadetail } from "./features/themas/Themadetail";
import { ThemasPagina } from "./features/themas/ThemasPagina";

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
 * `/themas` is the thema-beheer screen (**E1-14**): the list, and one thema at `/themas/:themaId`. It replaced
 * `DoelsuggestieReview`, which was mounted here with a thema-id typed into a text box because no thema list
 * existed to pick from. The review itself was not deleted: per the owner's ruling of 2026-08-04 it is a section
 * on the thema detail, so E2's components (E2-05's list, E2-08's trigger) render there against the thema
 * already open, and the school-wide gap list (E2-06) sits under the thema list.
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
          {/* Same nested shape as `/doelen`, and for the same reason: the thema stays deep-linkable while the
              list keeps its place (E1-14, ADR-0021). */}
          <Route path="/themas" element={<ThemasPagina />}>
            <Route path={THEMA_DETAIL_PAD} element={<Themadetail />} />
          </Route>
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
