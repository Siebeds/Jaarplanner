namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// Thrown when something new would be put into a period the teacher has marked as bezet with a <b>blocking vast
/// moment</b> (FR-5.4) — by a per-period regeneration (E4-05), by a hand-placement (E4-03) or by a drag (E3-07).
/// The (thin) Api maps this to a <b>409</b> via <c>PlanningExceptionHandler</c>.
/// <para>
/// <b>One type for three call sites, deliberately, because it is one rule</b> (owner ruling 2026-08-06, clause 2:
/// same rule for human and machine). This is the opposite call from the one <see cref="OngeldigePlaatsingFout"/>
/// documents — there, two <i>different</i> operations happened to share a condition, so reusing one type would have
/// made its own summary false. Here a single rule is enforced wherever content can enter a period, and giving each
/// site its own fault is how three copies of one rule come to disagree about it.
/// </para>
/// <para>
/// <b>Why 409 and not 400</b>, unlike the three faults beside it. The request is well-formed and every id in it
/// exists; what it conflicts with is a <i>stored parameter of the teacher's own</i>. That distinction is not
/// decoration: the frontend disables the control for a blocked period and shows the reason in place, so if this fault
/// is ever reached the teacher's view is out of date, and the client can tell "reload, the grid moved" (400) from
/// "that period is blocked" (409) without reading Dutch prose out of a <c>detail</c> field.
/// </para>
/// <para>
/// <b>What this rule does not do, and the messages must not imply otherwise:</b> nothing is retroactive. A placement
/// that was already in the period before the moment was registered stays exactly where it is (owner ruling
/// 2026-08-06). So the period is not "empty" and not "unavailable" — it accepts nothing <i>new</i> while the moment
/// stands. A stranded placement is a signalling question and belongs to E3-09.
/// </para>
/// <para>
/// Dutch, and both messages name the moment the teacher gave it: this is teacher-actionable, which is the Dutch side
/// of the ratified Art. II.3 split, and a refusal that cannot say <i>which</i> commitment blocks the period leaves
/// them hunting through the generation settings. The frontend renders its own <c>nl.json</c> copy rather than these
/// (Art. II.3), so the name is passed to it structurally as well; see <c>GeblokkeerdePeriodeWeergave</c>.
/// </para>
/// </summary>
public sealed class PeriodeIsBezetFout : Exception
{
    private PeriodeIsBezetFout(string message)
        : base(message)
    {
    }

    /// <summary>
    /// A per-period regeneration was asked for a blocked period (FR-8.2). Refused <b>before</b> the model is called,
    /// so the teacher does not wait on a run that cannot place anything (owner ruling 2026-08-06, clause 1).
    /// <para>
    /// The remedy names the settings rather than another period, because the teacher chose <i>this</i> period: telling
    /// them to pick a different one answers a question they did not ask.
    /// </para>
    /// </summary>
    public static PeriodeIsBezetFout VoorHergeneratie(string momentNaam) =>
        new($"In deze periode staat \"{momentNaam}\", dus ze wordt niet gevuld. Haal dat vaste moment weg bij de " +
            "instellingen voor het genereren als je hier toch een thema wil.");

    /// <summary>
    /// A hand-placement or a move was aimed at a blocked period (FR-7.2, FR-6.2). Same rule as the AI's, which is the
    /// whole point of the ruling: a teacher who marked the period as bezet is not silently allowed to plan over it.
    /// </summary>
    public static PeriodeIsBezetFout VoorPlaatsing(string momentNaam) =>
        new($"In deze periode staat \"{momentNaam}\", dus er kan geen thema bij. Kies een andere periode, of haal " +
            "dat vaste moment weg bij de instellingen voor het genereren.");
}
