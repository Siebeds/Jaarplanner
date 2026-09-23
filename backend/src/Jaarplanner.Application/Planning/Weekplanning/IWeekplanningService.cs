using Jaarplanner.Application.Toegang;

namespace Jaarplanner.Application.Planning.Weekplanning;

/// <summary>
/// Day-level planning inside a jaarplan (E9-03, FR-6.2/FR-7.2): reading one stretch of days with what is scheduled on
/// them, and scheduling, moving or unscheduling one activiteit.
/// <para>
/// <b>Deliberately not part of <c>JaarplanGeneratieService</c>.</b> That class is already a thousand lines and every
/// one of them serves generation — deriving blocks, building prompts, validating an AI answer, reporting what a run
/// did. Nothing here generates anything: FR-5 places thema's onto periods and says nothing about days, so E9-03 left
/// AI day-planning out of scope on purpose. Hanging four teacher-only use cases off the generation service would put
/// them behind a class whose whole vocabulary is about runs.
/// </para>
/// </summary>
public interface IWeekplanningService
{
    /// <summary>
    /// One stretch of days with the activiteiten on them — what the week view inside a themaperiode renders.
    /// <para>
    /// The range is inclusive on both ends and is <b>clamped to the school year</b> rather than refused: a client
    /// asking for the week containing 1 September legitimately spans days before the year starts, and refusing that
    /// would make the first and last week of every year unrenderable.
    /// </para>
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">No such class.</exception>
    Task<Weekplanningweergave> HaalWeekplanningAsync(
        Guid klasId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Every activiteit this klas has planned, with the days it stands on, over the whole school year (FB-076).
    /// <para>
    /// Its own read rather than a field on the week: the panel needs the days the week view is not showing, which is
    /// the only reason a teacher plans the same activiteit twice without noticing.
    /// </para>
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">No such class.</exception>
    Task<Activiteitplaatsingenweergave> HaalActiviteitplaatsingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Schedules one activiteit onto one day. The placement lands as <c>manueel</c> — a teacher's own decision, which
    /// nothing regenerates away (Art. IV.2).
    /// </summary>
    /// <exception cref="OngeldigeDagplanningFout">
    /// The day is closed or outside the year, the end is not after the start, the activiteit already starts at that
    /// time on that day, or it is for an age the class does not teach.
    /// </exception>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// The class or the activiteit does not exist.
    /// </exception>
    /// <param name="planner">
    /// The rights of whoever plans. Only its owner, or admin, plans an own activiteit (ADR-0049 D6); without a planner
    /// an own activiteit is refused.
    /// </param>
    Task<Weekplanningweergave> PlanActiviteitAsync(
        Guid klasId,
        Guid activiteitId,
        DateOnly datum,
        TimeOnly begin,
        TimeOnly einde,
        Toegang.Rechten? planner = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks off a stretch of days for a subthema, or moves the stretch it already had (owner ruling, 2026-08-25).
    /// <para>
    /// The window is what a calendar draws when the subthema has fewer activiteiten than days, which is the normal
    /// state of a plan being built: activiteiten are added later. Nothing here places or moves an activiteit, and
    /// nothing here moves a dekkingscijfer.
    /// </para>
    /// </summary>
    /// <param name="klasId">The class whose plan is being edited.</param>
    /// <param name="subthemaId">The subthema to mark off days for. Must belong to that class.</param>
    /// <param name="van">First day, inclusive. Clamped into the school year.</param>
    /// <param name="tot">Last day, inclusive. Clamped into the school year.</param>
    /// <param name="cancellationToken">Cancellation.</param>
    Task<Weekplanningweergave> PlaatsSubthemaAsync(
        Guid klasId,
        Guid subthemaId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Moves a scheduled activiteit to another day and/or another time, which is also how a block is made longer or
    /// shorter: dragging its bottom edge sends the same day and start with a new end.
    /// <para>
    /// <b>The placement's current day is never validated, only the target.</b> That is what makes this the route off a
    /// day the school has since closed — the same shape as the thema move path, and for the same reason: the
    /// application must never have to guess a position for something it is repairing.
    /// </para>
    /// </summary>
    Task<Weekplanningweergave> VerplaatsActiviteitAsync(
        Guid klasId,
        Guid plaatsingId,
        DateOnly datum,
        TimeOnly begin,
        TimeOnly einde,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes an activiteit off its day. Whatever its status: an explicit teacher action is the one actor Art. IV.2
    /// allows to discard a human decision.
    /// <para>
    /// It is also the remediation the two Restrict guards name — the class delete guard and the activiteit delete
    /// guard both instruct a teacher to clear the weekplanning first, and a guard whose remedy does not exist is a
    /// trap rather than a safeguard.
    /// </para>
    /// </summary>
    Task<Weekplanningweergave> VerwijderActiviteitplaatsingAsync(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Decides one open proposal of a weekvoorstel (FB-027, ADR-0067 W4): accepted, it is planned like any other block;
    /// rejected, it goes. A block that is no open proposal is refused, and so is accepting a colleague's own activiteit
    /// unless <paramref name="beslisser"/> is admin (W6).
    /// </summary>
    Task<Weekplanningweergave> BeslisVoorstelAsync(
        Guid klasId,
        Guid plaatsingId,
        bool aanvaard,
        Rechten? beslisser = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Accepts every open proposal between <paramref name="van"/> and <paramref name="tot"/> that
    /// <paramref name="beslisser"/> may accept (FB-027 "allemaal"); a colleague's own activiteit stays open.
    /// </summary>
    Task<Weekplanningweergave> AanvaardVoorstellenAsync(
        Guid klasId,
        DateOnly van,
        DateOnly tot,
        Rechten? beslisser = null,
        CancellationToken cancellationToken = default);
}
