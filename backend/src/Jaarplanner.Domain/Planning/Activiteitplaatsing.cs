using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Domain.Planning;

/// <summary>
/// One <see cref="Activiteit"/> placed on one <b>teaching day</b> of a <see cref="Jaarplan"/> (E9-03, FR-6.2/FR-7.2).
/// This is what makes "what am I doing on Tuesday?" a question the plan can answer.
/// <para>
/// <b>It keys on a calendar <see cref="Datum"/>, not on a planningsblok — and that is the whole design.</b> The
/// obvious alternative was a third <see cref="Planningsblokniveau"/> (<c>Week</c>, or <c>Dag</c>), and it is wrong on
/// three independent grounds:
/// </para>
/// <para>
/// <b>1. The grid is ratified and a week is not part of it.</b> Art. IX.3 and ADR-0013 fix the planning grid at the
/// two-tier themaperiode/subthemaperiode pair, configurable behind the E3-05 seam. A week is a calendar unit, which is
/// exactly the assumption <see cref="Planningsblokniveau"/> is guarded against gaining — that enum has a test whose
/// only job is to fail when a calendar unit appears in it. Widening it to satisfy a screen would compile in an
/// assumption Art. XIV still leaves open, in the one place the constitution asked us not to.
/// </para>
/// <para>
/// <b>2. A block boundary moves; a Tuesday does not.</b> <see cref="Themaplaatsing.BlokStart"/> keys on a
/// <i>derived</i> boundary, so editing one vakantie can leave it pointing at a date that is no longer the start of any
/// block — that is what <c>IsVervallen</c> exists for, and it costs this codebase a persistent notice, a re-placement
/// route and a withheld dekkingscijfer. A concrete teaching day inherits none of that: edit the calendar and a date
/// either stays a lesdag or becomes a closure, which is a different and much smaller problem (see
/// <see cref="IsOpGeslotenDag"/>). Keying an activiteit on a block would have imported a staleness problem it does not
/// have.
/// </para>
/// <para>
/// <b>3. They answer different questions.</b> A themaperiode answers "in which stretch of the year does this thema
/// live?"; this answers "on which day does this activiteit happen?". Collapsing both into one ordinal space is the
/// "two views disagree about the same period" defect the E3-02/E3-06 review had to repair twice.
/// </para>
/// <para>
/// <b>A subthema IS placed, since 2026-08-25.</b> This paragraph used to say the opposite: that a subthema has no
/// placement type and no row, its span being derived from the activiteiten under it, because a second placed thing
/// would be a second thing to keep in step. The owner overruled it on a ground the note did not weigh, that a period
/// has to be able to exist before its content does: five days marked off for a subthema with one activiteit ready is a
/// five-day plan, and a calendar drawing one day shows a different plan rather than a smaller one. The objection was
/// still right, and <see cref="Subthemaplaatsing"/> answers it by reading less rather than storing more: the calendar
/// draws the UNION of the stored window and the days that carry an activiteit, so the two cannot contradict each other
/// by construction.
/// </para>
/// <para>
/// <b>For a shared activiteit this does not affect dekking, and that is not an oversight.</b> Art. V.1 makes a shared
/// activiteit's goal gedekt once its subthema is placed in the klas's agenda (the <see cref="Subthemaplaatsing"/>,
/// ADR-0047). Scheduling it onto a Tuesday moves nothing in that computation; anything here that started to raise a
/// dekkingscijfer for it would be letting the calendar grant coverage twice for the same content. <b>An own activiteit
/// is the one exception</b> (ADR-0049 D7): it never counts through its subthema, so this placement is its only route.
/// </para>
/// </summary>
public sealed class Activiteitplaatsing
{
    // EF Core materialisation only.
    private Activiteitplaatsing()
    {
    }

    /// <summary>Creates a placement of one activiteit on one day.</summary>
    /// <param name="jaarplanId">The owning jaarplan.</param>
    /// <param name="activiteitId">
    /// The placed activiteit. It inherits its <c>Subthema</c>'s klas and leeftijd (Art. IX.2), and that the klas
    /// matches this plan's is enforced by <see cref="Jaarplan.PlaatsActiviteit"/> — the only layer that knows both.
    /// </param>
    /// <param name="datum">
    /// The teaching day. That it <i>is</i> one is checked by the service against the <see cref="Schooljaar"/>, which is
    /// the only layer holding the closures; this type stores an honest key, it does not validate the calendar.
    /// </param>
    /// <param name="status">
    /// The human-in-the-loop status (Art. IV.2). A teacher placing an activiteit is
    /// <see cref="KoppelingStatus.Manueel"/>.
    /// </param>
    /// <param name="begin">When it starts on that day, as the teacher chose it.</param>
    /// <param name="einde">When it ends. Must lie after <paramref name="begin"/>.</param>
    public Activiteitplaatsing(
        Guid jaarplanId,
        Guid activiteitId,
        DateOnly datum,
        KoppelingStatus status,
        TimeOnly begin,
        TimeOnly einde)
    {
        JaarplanId = RequireId(jaarplanId, nameof(jaarplanId));
        ActiviteitId = RequireId(activiteitId, nameof(activiteitId));
        Datum = datum;
        Status = RequireStatus(status);
        (Begin, Einde) = RequireTijden(begin, einde);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning jaarplan.</summary>
    public Guid JaarplanId { get; private set; }

    /// <summary>The placed activiteit (klas/leeftijd-scoped through its subthema, Art. IX.2).</summary>
    public Guid ActiviteitId { get; private set; }

    /// <summary>
    /// The day this activiteit happens. A real calendar date, deliberately not a derived block key — see the type
    /// documentation for why that distinction is load-bearing.
    /// </summary>
    public DateOnly Datum { get; private set; }

    /// <summary>The persisted human-in-the-loop status of this placement (Art. IV.2).</summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>
    /// When this activiteit starts on its day: a clock time the teacher chose (owner, 2026-09-11, ADR-0027).
    /// <para>
    /// <b>It replaced <c>Volgorde</c>, an ordinal into seven numbered lesuren.</b> The owner asked for an agenda that
    /// looks like Outlook, where a teacher drags a block to 10:15 and pulls its bottom edge to 11:00, and a slot number
    /// cannot say either. It also orders the day, which is the job <c>Volgorde</c> had: a reading moment placed at
    /// 8:45 stays before the one at 9:30 whatever order they were entered in.
    /// </para>
    /// </summary>
    public TimeOnly Begin { get; private set; }

    /// <summary>
    /// When it ends. <b>Stored per placement rather than derived from the activiteit</b>, because resizing one block on
    /// one Thursday is exactly what the time grid offers, and a length read off the activiteit would move every other
    /// day that activiteit is planned on along with it.
    /// </summary>
    public TimeOnly Einde { get; private set; }

    /// <summary>
    /// Whether anything may discard this placement without asking the teacher.
    /// <para>
    /// <b>Today this is false for every row that exists, and saying so is the point.</b> Nothing generates activity
    /// schedules — E9-03 deliberately left AI day-planning out of scope, because FR-5 generates thema's onto periods
    /// and says nothing about days — so every placement here is a teacher's own and
    /// <see cref="MenselijkBeslotenActiviteitplaatsingen"/> currently counts all of them. The predicate exists anyway
    /// because it is what the <c>Klas</c> delete guard must ask, and a guard that hard-codes "all of them" would
    /// quietly start destroying proposals the day a generator appears.
    /// </para>
    /// <para>
    /// There is no <c>Vergrendeld</c> flag alongside it, deliberately: locking exists on
    /// <see cref="Themaplaatsing"/> to survive a regeneration, and nothing regenerates these. A flag with no consumer
    /// is a control that does nothing.
    /// </para>
    /// </summary>
    public bool IsVervangbaar => Status == KoppelingStatus.Voorgesteld;

    /// <summary>
    /// True when this placement's day has stopped being a teaching day — the school added a vakantie or a vrije dag
    /// over a date that already held an activiteit.
    /// <para>
    /// <b>Computed on read from the schooljaar, never stored</b>, and passed the schooljaar rather than asking a
    /// service: the same rule Art. V.1 applies to dekking applies here for the same reason, which is that a stored
    /// answer is a second copy of a fact that can change without it.
    /// </para>
    /// <para>
    /// <b>It is a much smaller problem than <c>Themaplaatsing.IsVervallen</c> and must not be modelled like one.</b> A
    /// stale thema placement points at a date that is no longer any period's boundary, so the tool genuinely cannot say
    /// where the thema sits; that is why it withholds the dekkingscijfer. Here the tool knows exactly where the
    /// activiteit is — the school just closed that day. Nothing is withheld and nothing is unreliable; the day is shown
    /// as closed with the activiteit still on it, and the teacher moves it. Do not wire this into any coverage or
    /// reliability figure.
    /// </para>
    /// </summary>
    public bool IsOpGeslotenDag(Schooljaar schooljaar)
    {
        ArgumentNullException.ThrowIfNull(schooljaar);

        return !schooljaar.IsLesdag(Datum);
    }

    /// <summary>
    /// Moves this activiteit to another day and/or another time, which is also how it is made longer or shorter
    /// (E9-04, FR-6.2/FR-7.2; clock times since ADR-0027).
    /// <para>
    /// <b>Unlike <see cref="Themaplaatsing.VerplaatsNaar"/>, this neither rewrites the status nor destroys anything.</b>
    /// That method has to convert a proposal into the teacher's own placement and drop an AI motivation that argued for
    /// a period the thema has left — which is what makes a thema move a small unrecoverable edit the UI must warn
    /// about. Here there is no motivation to lose and no proposal to override: every placement is the teacher's
    /// already. <b>So a day move is genuinely reversible, and E9-04 must not copy E3-07's confirmation step onto it</b>
    /// — a warning about a consequence that cannot happen trains teachers to dismiss the warnings that matter.
    /// </para>
    /// <para>
    /// That the target is a teaching day is the service's check, exactly as at construction. Nothing here requires the
    /// <i>current</i> <see cref="Datum"/> to still be one, which is what makes this the route off a day the school has
    /// since closed.
    /// </para>
    /// </summary>
    public void VerplaatsNaar(DateOnly datum, TimeOnly begin, TimeOnly einde)
    {
        Datum = datum;
        (Begin, Einde) = RequireTijden(begin, einde);
    }

    // The guards below catch programmer error, never teacher input, so their messages are English (Art. II.2).
    // A teacher's own "the end is before the start" is refused earlier, in Dutch, by WeekplanningService.
    private static (TimeOnly Begin, TimeOnly Einde) RequireTijden(TimeOnly begin, TimeOnly einde) =>
        einde > begin
            ? (begin, einde)
            : throw new ArgumentOutOfRangeException(nameof(einde), einde, "Einde must lie after Begin.");

    private static KoppelingStatus RequireStatus(KoppelingStatus status) =>
        Enum.IsDefined(status)
            ? status
            : throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown plaatsingsstatus.");

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty
            ? throw new ArgumentException($"'{paramName}' is required.", paramName)
            : value;
}
