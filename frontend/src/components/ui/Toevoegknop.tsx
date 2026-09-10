import { Knop } from "./Knop";
import { IcoonPlus } from "../Iconen";

/**
 * "Add one of these here." One shape for every one of them, on purpose.
 *
 * **It exists because there were three shapes for one intention** (owner, 2026-08-30: "er is geen
 * consistentie tussen een doel koppelen en een subthema toevoegen"). On one thema page,
 * "Doel koppelen" was a borderless text button, "Subthema toevoegen" and "Activiteit toevoegen"
 * were outlined ones, and "Vraag suggesties" was borderless again. Four controls, three weights, and
 * the weight did not track anything a teacher could name.
 *
 * The rule now: **anything that adds or links a thing into the section it sits in is this
 * component.** Anything that is not (asking the model for suggestions, deleting, editing) is
 * deliberately something else, and the difference in weight then carries a real difference in kind.
 *
 * **It goes UNDER its section heading, not at the right end of it** (same conversation: "kan je geen
 * plusknop zetten onder de subtitel? ik vind het zo onduidelijk als knop rechts in de subtitel"). A
 * control on the heading line reads as part of the heading, floats far from the list it acts on at
 * desktop widths, and wraps into the heading on a phone. Under it, it reads as the first thing you
 * can do to the list below.
 *
 * **It is borderless (2026-08-30, second pass).** It was outlined, and on the redesigned thema fiche
 * that made it the loudest object on the screen: a thema page carries four to six of these, they are
 * the only bordered boxes on a page of text, and they sit at exactly the x where the eye goes
 * looking for content. That is the "chrome outranks content" half of why the screen kept reading
 * badly however the elements inside it were arranged.
 *
 * The plus is what says "this adds", and it stays. What goes is the box around it. The rule above is
 * untouched: there is still exactly ONE shape for adding or linking, and it is still this component.
 * The cost is that it now carries the same weight as "Vraag suggesties", so the difference in KIND
 * between adding a thing and asking the model for candidates rests on the words and the plus rather
 * than on the outline. That is the cheaper of the two losses: a teacher meets six add-controls per
 * page and one suggestion request, so the repeated one is the one that has to be quiet.
 */
export function Toevoegknop({
  label,
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /**
   * When the visible label is not enough to tell this control from its siblings.
   *
   * A subthemakaart carries one "Doel koppelen" for its subdoelen and one per activiteit, and a
   * screen reader announcing the same three words three times says nothing about which. Sighted
   * users get that from position. WCAG 2.5.3 wants the visible label contained in the spoken one,
   * so callers extend it rather than replace it.
   */
  "aria-label"?: string;
}) {
  return (
    <Knop
      rang="stil"
      className="h-9 min-h-9 px-2.5 text-meta"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <IcoonPlus aria-hidden="true" className="h-4 w-4" />
      {label}
    </Knop>
  );
}
