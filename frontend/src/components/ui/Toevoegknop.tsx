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
      rang="rustig"
      className="h-9 min-h-9 px-3 text-meta"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <IcoonPlus aria-hidden="true" className="h-4 w-4" />
      {label}
    </Knop>
  );
}
