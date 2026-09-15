import type { ReactNode } from "react";
import { Knop } from "../components/ui/Knop";
import { t } from "../i18n";
import { ApiError } from "../lib/api";
import { useIk } from "../lib/aanmelding";
import { Tussenpagina } from "./Tussenpagina";

/**
 * Nothing of the app until it knows who is signed in (TB-026).
 *
 * Without this gate the shell drew at once and learnt from the first 401 that nobody was, so a browser
 * without a session showed the navigation and the agenda for as long as that round trip took, before
 * `aanmeldOmleiding` sent it to the sign-in. Now the tussenpagina stands in the shell's place while
 * `useIk` is pending, and after a 401 while the browser is on its way out. No screen fires its own
 * queries for someone about to be sent away, either.
 *
 * **Any other failure** is a server that did not answer, which neither the shell nor the sign-in would
 * mend: the page says the app cannot open and offers the one thing that can help, asking again. While
 * that second request runs, the page is back to opening, so the sentence about the sign-in is said only
 * after a 401 (the render condition of that sentence, and the only case in which it is true).
 *
 * The two pages a sign-in can end on stay outside this gate, for the reason they stay outside the shell.
 */
export function Aanmeldpoort({ children }: { children: ReactNode }) {
  const ik = useIk();

  if (ik.data) return children;

  const nietAangemeld = ik.error instanceof ApiError && ik.error.status === 401;

  if (ik.isError && !nietAangemeld && !ik.isFetching) {
    return (
      <Tussenpagina>
        <div role="alert" className="mt-8 max-w-[30rem]">
          <p className="text-body font-medium text-inkt">{t("aanmelding.tussenpagina.fout")}</p>
          <p className="mt-1 text-body text-inkt-zacht">{t("aanmelding.tussenpagina.foutUitleg")}</p>
        </div>
        <Knop rang="hoofd" className="mt-6" onClick={() => void ik.refetch()}>
          {t("aanmelding.tussenpagina.opnieuw")}
        </Knop>
      </Tussenpagina>
    );
  }

  return (
    <Tussenpagina bezig>
      <p role="status" className="tussenpagina-status">
        {nietAangemeld ? t("aanmelding.tussenpagina.doorsturen") : t("aanmelding.tussenpagina.openen")}
      </p>
    </Tussenpagina>
  );
}
