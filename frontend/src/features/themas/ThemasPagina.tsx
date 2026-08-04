import { useEffect, useState } from "react";
import { Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";

import { t } from "../../i18n";
import { OngekoppeldeDoelenLijst } from "../matching/OngekoppeldeDoelenLijst";
import { Themaformulier } from "./Themaformulier";
import { Themalijst } from "./Themalijst";
import { useMaakThema } from "./useThemas";
import type { ThemaInvoer } from "./types";

/**
 * The Thema's screen (E1-14, FR-3.1/3.2/3.3): the school's own content, and the way in to one thema.
 *
 * **Two panes with the selection in the URL**, the same shape as the Doelen register (E1-16, ADR-0021): the
 * list on the left, one thema at `/themas/:themaId` as a nested route, so a thema is deep-linkable and Back
 * works. At phone width the detail *replaces* the list rather than sitting under it, because stacking them
 * means scrolling past every thema to read the one just opened.
 *
 * **What replaced what.** `/themas` used to render the doelsuggestie review behind a thema-id typed into a
 * text field, which E2-08 shipped as an admitted stopgap: no thema list existed to pick from. The review now
 * lives on the thema detail, so the field is gone. The school-wide gap list (E2-06) stays here at the bottom,
 * because it is about the whole school rather than about one thema.
 */
export function ThemasPagina() {
  const [nieuw, setNieuw] = useState(false);
  const navigate = useNavigate();
  const { search } = useLocation();
  const gekozenThemaId = useMatch("/themas/:themaId")?.params.themaId;
  const maakThema = useMaakThema();

  /*
    **A click on a thema wins over an open create form** (antagonist round 1).

    The pane used to prefer `nieuw` over `gekozenThemaId`, so with the create form open every click in the list
    changed the URL and moved `aria-current` while the pane kept showing the empty form: a control that visibly
    does nothing, which is the rule E3-06 exists for. The click is the clearer statement of intent, so it wins
    and the form closes. That does discard whatever was typed, which is the honest trade: the form is four
    fields, and the alternative was a list that looked broken.
  */
  useEffect(() => {
    if (gekozenThemaId) {
      setNieuw(false);
    }
  }, [gekozenThemaId]);

  function bewaarNieuw(invoer: ThemaInvoer) {
    maakThema.mutate(invoer, {
      onSuccess: (thema) => {
        setNieuw(false);
        // Straight to what was just created, with the klas/schooljaar choice intact: the next thing a teacher
        // wants is to give the new thema its themadoelen, and that lives on the detail.
        navigate({ pathname: `/themas/${thema.id}`, search });
      },
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-ink sm:text-[1.75rem]">{t("themabeheer.titel")}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-zacht">
              {t("themabeheer.uitleg")}
            </p>
          </div>
          {nieuw ? null : (
            <button
              type="button"
              onClick={() => setNieuw(true)}
              className="rounded-md bg-petrol px-4 py-2 text-sm font-semibold text-petrol-foreground hover:bg-petrol-helder"
            >
              {t("themabeheer.nieuw")}
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
          {/* The list hides at phone width while a thema is open, for the reason in the doc comment. */}
          <div className={gekozenThemaId || nieuw ? "hidden lg:block" : ""}>
            <Themalijst gekozenThemaId={gekozenThemaId} />
          </div>

          <div className={gekozenThemaId || nieuw ? "" : "hidden lg:block"}>
            {nieuw ? (
              <Themaformulier
                onBewaar={bewaarNieuw}
                onAnnuleer={() => setNieuw(false)}
                bezig={maakThema.isPending}
                fout={maakThema.error}
              />
            ) : gekozenThemaId ? (
              <Outlet />
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-card/70 px-5 py-8 text-center text-sm text-ink-zacht">
                {t("themabeheer.kiesThema")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* School-wide gap list (E2-06, FR-4.4): about the whole school, so it belongs beside the list rather
          than on any one thema. It updates as links change, through the shared query invalidation that every
          beheer mutation performs. */}
      <section aria-labelledby="ongekoppeld-titel" className="border-t border-border pt-8">
        <h3 id="ongekoppeld-titel" className="text-xl font-bold text-ink">
          {t("ongekoppeld.titel")}
        </h3>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-zacht">{t("ongekoppeld.uitleg")}</p>
        <div className="mt-5">
          <OngekoppeldeDoelenLijst />
        </div>
      </section>
    </div>
  );
}
