import { useSelectie } from "../../app/useSelectie";
import { Jaarplankalender } from "./Jaarplankalender";

/**
 * The jaarplan page (E3-06).
 *
 * The class comes from the shell's selector via the URL (E0-10, ADR-0021). Until E0-10 this page carried
 * its own text input for pasting a klas-id — the only way the kalender was reachable at all — and the
 * page is now thin because selecting a class stopped being its job.
 *
 * The empty-selection message lives in {@link Jaarplankalender}, which already renders
 * `kalender.geenKlas` when no class id is present; that copy now points at the selector above rather than
 * at an input that no longer exists.
 */
export function JaarplanPagina() {
  const { klasId } = useSelectie();

  return (
    <section className="w-full text-left">
      <Jaarplankalender klasId={klasId} />
    </section>
  );
}
