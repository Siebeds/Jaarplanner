import { useCallback, useMemo, useState, type ReactNode } from "react";

import { bewaarVoorkeur, leesVoorkeur, uitlegContext, useUitleg } from "./uitlegcontext";

/**
 * The provider and the wrapper every instructional sentence renders inside (E9-01).
 *
 * **Why this exists.** The directie review of 2026-08-19 found the screens hard to read: roughly 113 catalogue strings
 * of 110 characters or more, some 19 500 characters of prose, teaching a tool that teachers will have been trained on.
 * The owner ruled a single switch, **default off**, persisted per user — over deleting the sentences, precisely so a
 * training can turn them back on.
 *
 * ## The line this draws is the whole design, and it is not "long text versus short text"
 *
 * **In scope, so it goes inside {@link Uitleg}:** sentences that **teach the tool**. How a drag works, what a tier
 * shows, that a setting is optional, what the AI will do with it, what a period is for.
 *
 * **Out of scope, and these render unconditionally whatever the switch says:**
 * - every **error** and every **degrade** ("de weergave kon niet geladen worden");
 * - every **withheld-figure** explanation (the dekkingscijfer being held back, directie 2026-07-28);
 * - every *"this control is not available and here is why"* — the **E3-06 rule**, where an unbuilt or blocked
 *   destination says so in visible text;
 * - every **consequence a teacher is about to commit to**, such as E3-07's disclosure that moving a thema discards its
 *   AI motivation and any decision on it.
 *
 * **If you are unsure which half a sentence is in, ask whether a teacher could act on it when something has gone
 * wrong. If yes, it stays.** A teacher must never lose the sentence telling them what just went wrong, or that a
 * figure is being withheld, because they switched off help they read as clutter.
 *
 * ## Why a component rather than `{isAan && …}` at each call site
 *
 * 1. A call site **declares** that its sentence is instructional, in the JSX, where a reviewer reads it.
 * 2. The in-scope set becomes **greppable** — `rg "<Uitleg"` is the audit, instead of a judgement scattered over
 *    twenty-five files and re-derived by whoever edits next.
 * 3. It cannot be half-applied invisibly. A sentence someone forgot to wrap still renders, which is the **safe**
 *    direction: the failure mode is "too much text", the state we are already in, and never a lost error message.
 */
export function UitlegProvider({ children }: { children: ReactNode }) {
  const [isAan, setIsAan] = useState(leesVoorkeur);

  /**
   * **The write is deliberately outside the state updater.** It used to sit inside `setIsAan(vorige => …)`, which is
   * impure: React may call an updater more than once (StrictMode does so on purpose), so the `localStorage` write
   * happened twice and the update was processed outside React's batching. The symptom was an `act()` warning on every
   * click in the tests — noise that would have masked the next real one, and a pattern that is wrong regardless of
   * whether anything visibly broke.
   *
   * `isAan` is in the dependency array, so the closure is always the current render's.
   */
  const schakel = useCallback(() => {
    const volgende = !isAan;

    setIsAan(volgende);
    bewaarVoorkeur(volgende);
  }, [isAan]);

  // Memoised so every consumer does not re-render on each render of the shell.
  const waarde = useMemo(() => ({ isAan, schakel }), [isAan, schakel]);

  return <uitlegContext.Provider value={waarde}>{children}</uitlegContext.Provider>;
}

/**
 * Renders its children only when the teacher has asked for help.
 *
 * Renders **nothing at all** when off — not hidden, not collapsed, not `sr-only`. A hidden element still occupies the
 * DOM or the accessibility tree, and the owner's complaint was that the screens are crowded; leaving 113 invisible
 * paragraphs in place would fix the look and none of the substance for a screen-reader user, which is the half of the
 * audience least able to skim past them.
 *
 * @param children The instructional sentence. **Never an error, a degrade, a withheld-figure explanation or a
 *   consequence disclosure** — see the note on {@link UitlegProvider} for which half a sentence belongs to.
 */
export function Uitleg({ children }: { children: ReactNode }) {
  const { isAan } = useUitleg();

  return isAan ? <>{children}</> : null;
}
