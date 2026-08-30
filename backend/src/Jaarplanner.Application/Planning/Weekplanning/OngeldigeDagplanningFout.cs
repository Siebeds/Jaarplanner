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
    /// That activiteit already sits in that <b>lesuur</b> of that day.
    /// <para>
    /// A day holds several activiteiten and the same activiteit may fill several lesuren, so only the exact
    /// slot collision is refused. The sentence names the lesuur rather than the day for that reason: telling a
    /// teacher to pick another day when picking the next hour would do sends them away from the fix.
    /// </para>
    /// </summary>
    public static OngeldigeDagplanningFout ActiviteitStaatErAl(DateOnly datum, int lesuur) =>
        new($"Deze activiteit staat al in lesuur {lesuur} op {Dagnotatie.Formatteer(datum)}. "
            + "Kies een ander lesuur of een andere activiteit.");

    /// <summary>
    /// The subthema is for an age this class does not teach. The subthema counterpart of
    /// <see cref="ActiviteitHoortBijAndereLeeftijd"/>, refused for the same structural reason (Art. IX.2).
    /// </summary>
    /// <param name="leeftijd">The subthema's own age, named so the sentence says what is wrong rather than that
    /// something is.</param>
    public static OngeldigeDagplanningFout SubthemaHoortBijAndereLeeftijd(string leeftijd) =>
        new($"Dit subthema is voor {leeftijd}. Deze klas geeft die leeftijd niet, dus kies een subthema van deze klas.");

    /// <summary>
    /// The two dates of a marked-off subthemaperiode are the wrong way round.
    /// <para>
    /// Reachable from a screen with two date fields, so it is a Dutch 400 rather than the aggregate's bare
    /// <c>ArgumentException</c>, which no handler maps and which would reach a teacher as a 500.
    /// </para>
    /// </summary>
    public static OngeldigeDagplanningFout PeriodeLooptAchteruit() =>
        new("De laatste dag van de periode ligt voor de eerste dag. Kies een latere laatste dag.");

    /// <summary>
    /// The activiteit belongs to another class. Art. IX.2 makes the class scope structural, so this is refused rather
    /// than silently copied.
    /// <para>
    /// <b>Reachable only by a hand-built request</b> — every screen offers a teacher the activiteiten at the ages
    /// the class teaches. It is still a Dutch 400 rather than an English 500, because the alternative is deciding on
    /// a caller's behalf that they could not possibly be a teacher.
    /// <para>
    /// <b>It also carries more weight than it used to.</b> Since 2026-08-30 this service check is the only one:
    /// <c>Jaarplan.PlaatsActiviteit</c> no longer has a klas to compare against, so nothing behind this refuses a
    /// mismatched pair.
    /// </para>
    /// </para>
    /// </summary>
    public static OngeldigeDagplanningFout ActiviteitHoortBijAndereLeeftijd(string leeftijd) =>
        new($"Deze activiteit is voor {leeftijd}. Deze klas geeft die leeftijd niet, dus ze kan hier niet ingepland worden.");
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
