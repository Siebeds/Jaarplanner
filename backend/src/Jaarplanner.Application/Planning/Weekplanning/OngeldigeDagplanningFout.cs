namespace Jaarplanner.Application.Planning.Weekplanning;

/// <summary>
/// Thrown when scheduling an activiteit onto a day cannot be honoured (E9-03, FR-6.2/FR-7.2): the day is not a
/// teaching day, it falls outside the school year, the activiteit is already on it, or the activiteit belongs to
/// another class. The (thin) Api maps this to a <b>400</b> via <c>PlanningExceptionHandler</c>.
/// <para>
/// <b>Why not <c>OngeldigePlaatsingFout</c>, which refuses the analogous thing one tier up.</b> That type documents
/// itself around a *thema* placed in a *periode*, and every sentence it holds instructs the teacher to reload the grid
/// or pick another period — advice that is wrong here, because a day that is not a lesdag is not a stale grid, it is a
/// closure the school entered on purpose. Reusing it would make its own summary false, which is the defect class this
/// project has retracted most often.
/// </para>
/// <para>
/// <b>One factory per case</b>, following the <c>OngeldigePlaatsingFout</c>/<c>OngeldigeImportFout</c> precedent: a
/// refusal whose message is composed at the throw site exists twice the moment a second caller needs it, and the two
/// copies drift. Every sentence a teacher can read for this fault is in this file.
/// </para>
/// <para>
/// Dutch, because all four conditions are teacher-actionable — the Dutch side of the ratified Art. II.3 split.
/// <b>Unlike <c>OngeldigePlaatsingFout</c>, these do name the day</b>, and that is a deliberate divergence rather than
/// an oversight: a teacher who dropped an activiteit on a closed day needs to know *which* day was refused, because
/// the whole point of the week view is that several days are on screen at once. It is formatted as Dutch
/// <c>d MMMM yyyy</c> through <see cref="Dagnotatie"/>, never as the ISO string the move path leaks and gets away with
/// only because no screen renders it.
/// </para>
/// </summary>
public sealed class OngeldigeDagplanningFout : Exception
{
    private OngeldigeDagplanningFout(string message)
        : base(message)
    {
    }

    /// <summary>
    /// The day is inside the school year but the school is closed — a vakantie or a vrije dag covers it.
    /// <para>
    /// <b>The closure is named</b> rather than described generically, because the school entered that name itself
    /// ("Herfstvakantie", "Pedagogische studiedag") and it is the fact that makes the refusal make sense. Refusing
    /// without it would leave a teacher looking at a day their calendar calls ordinary.
    /// </para>
    /// </summary>
    public static OngeldigeDagplanningFout DagIsGesloten(DateOnly datum, string sluitingsnaam) =>
        new($"Op {Dagnotatie.Formatteer(datum)} is de school gesloten ({sluitingsnaam}). Kies een andere dag.");

    /// <summary>
    /// The day falls outside the school year altogether. Kept apart from <see cref="DagIsGesloten"/> because there is
    /// no closure to name and the remedy differs: this is a teacher looking at the wrong school year, not at a
    /// holiday.
    /// </summary>
    public static OngeldigeDagplanningFout DagValtBuitenSchooljaar(DateOnly datum, string schooljaarNaam) =>
        new($"{Dagnotatie.Formatteer(datum)} valt buiten schooljaar {schooljaarNaam}. Kies een dag binnen dit schooljaar.");

    /// <summary>
    /// That activiteit is already on that day. A day holds several activiteiten — that is the normal case — so only
    /// the exact duplicate is refused, and the same activiteit on another day stays legitimate.
    /// </summary>
    public static OngeldigeDagplanningFout ActiviteitStaatErAl(DateOnly datum) =>
        new($"Deze activiteit staat al op {Dagnotatie.Formatteer(datum)}. Kies een andere dag of een andere activiteit.");

    /// <summary>
    /// The activiteit belongs to another class. Art. IX.2 makes the class scope structural, so this is refused rather
    /// than silently copied.
    /// <para>
    /// <b>Reachable only by a hand-built request</b> — every screen offers a teacher the activiteiten of the class
    /// whose plan they are editing. It is still a Dutch 400 rather than an English 500, because the alternative is
    /// deciding on a caller's behalf that they could not possibly be a teacher.
    /// </para>
    /// </summary>
    public static OngeldigeDagplanningFout ActiviteitHoortBijAndereKlas() =>
        new("Deze activiteit hoort bij een andere klas en kan niet in dit jaarplan gepland worden.");
}

/// <summary>
/// The one Dutch day format the weekplanning refusals use.
/// <para>
/// Here rather than inline at four throw sites for the reason <see cref="OngeldigeDagplanningFout"/> gives about its
/// factories: a format string duplicated per message is a format string that will eventually differ per message. It
/// is pinned to <c>nl-BE</c> explicitly rather than left to <c>CurrentCulture</c>, which would make a teacher-facing
/// sentence depend on the server's locale — the host-dependence an E5-01 finding had to remove elsewhere.
/// </para>
/// </summary>
internal static class Dagnotatie
{
    private static readonly System.Globalization.CultureInfo Nederlands = new("nl-BE");

    internal static string Formatteer(DateOnly datum) => datum.ToString("d MMMM yyyy", Nederlands);
}
