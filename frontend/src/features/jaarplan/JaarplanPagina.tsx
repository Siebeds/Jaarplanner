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
 *
 * **The `key` is load-bearing, not a list-rendering habit.** The klas selector lives in the shell *above* the
 * `<Outlet/>` and on the same route, so switching class changes a prop and remounts nothing. The kalender holds
 * unsaved teacher input for one class in component state (the pending generation parameters, E3-04), and a plain
 * prop change would carry class A's edit into class B's run: because a generation body *replaces* B's kept
 * settings wholesale, that would silently overwrite B's stored settings with A's. Keying on the class id makes
 * that state die with the class it belongs to, which is the only place this can be fixed once — the alternative
 * is every future piece of per-class state inside the subtree having to remember to reset itself.
 */
export function JaarplanPagina() {
  const { klasId } = useSelectie();

  return (
    <section className="w-full text-left">
      <Jaarplankalender key={klasId} klasId={klasId} />
    </section>
  );
}
