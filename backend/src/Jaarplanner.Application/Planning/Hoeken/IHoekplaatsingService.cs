namespace Jaarplanner.Application.Planning.Hoeken;

/// <summary>
/// Placing a hoek on the agenda, and reading back what is placed (owner, meeting 2026-08-30).
/// <para>
/// <b>Separate from the weekplanning, on purpose.</b> A hoekplaatsing is not part of the <c>Jaarplan</c>
/// aggregate, so it is not part of the read model that projects one either. The agenda asks for it in its own
/// request over its own range. That costs one call and buys the property the model was built for: nothing that
/// (re)generates a plan can see these rows, let alone discard them.
/// </para>
/// <para>
/// <b>What is in the corner is not here since FB-020.</b> A verrijking belongs to the hoek and a subthemaperiode, and
/// <see cref="IHoekverrijkingService"/> reads and writes it.
/// </para>
/// </summary>
public interface IHoekplaatsingService
{
    /// <summary>Every placement overlapping <paramref name="van"/>-<paramref name="tot"/>, for one class.</summary>
    Task<IReadOnlyList<HoekplaatsingWeergave>> HaalVoorBereikAsync(
        Guid klasId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Places a hoek over a stretch of days.
    /// <para>
    /// One call does both things the teacher answered in the sheet: the window and the time of day it runs. They arrive
    /// together because she decided them together, and because a placement that got its window but lost its hours to a
    /// second failed request is worse than one that never happened.
    /// </para>
    /// <para>
    /// <b>Every placement gets a row per teaching day of the window</b> (owner, 2026-09-11: <i>"elke hoek moet
    /// een tijdstip krijgen"</i>). A window holding no teaching day at all is therefore refused: it would make a
    /// placement with nowhere to appear.
    /// </para>
    /// </summary>
    Task<HoekplaatsingWeergave> PlaatsAsync(
        Guid klasId,
        HoekplaatsingInvoer invoer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a placement, with its timetable rows.
    /// <para>
    /// The way back out of a mistake, and the reason placing is safe to offer at all. It is a hard delete: a timetable
    /// row describes THIS window and means nothing without it. The corner's verrijkingen stay: they belong to the hoek
    /// and the subthema, not to a run in the timetable.
    /// </para>
    /// </summary>
    Task VerwijderAsync(Guid plaatsingId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Moves or resizes one appearance: another day, another time, or both (owner, 2026-08-31; clock times since
    /// ADR-0027).
    /// <para>
    /// <b>One appearance, not the placement.</b> The rows are stored per day rather than derived precisely so
    /// that this is possible: the hoek runs all fortnight and on this one Thursday it happens at a different
    /// hour. Moving the whole run is <c>Herzet</c>, which is a different verb with a different sheet.
    /// </para>
    /// <para>
    /// It answers with the WHOLE placement rather than the moved row. The agenda draws a placement's band and all of
    /// its rows together, so handing back one row would leave the caller to patch a structure it did not receive.
    /// </para>
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// No such placement, no such appearance in it, or the placement's klas or its schooljaar is gone.
    /// </exception>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentValidatieFout">
    /// The day falls outside the placement's window, the day has no school (a weekend day or a closure, TB-011), the
    /// end is not after the start, or that hoek already starts at that time on that day.
    /// </exception>
    Task<HoekplaatsingWeergave> VerplaatsMomentAsync(
        Guid plaatsingId,
        Guid momentId,
        DateOnly datum,
        TimeOnly begin,
        TimeOnly einde,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gives every appearance of the run the same hours, each on the day it is already on (owner, 2026-09-11).
    /// <para>
    /// <b>All of them, the ones moved by hand included</b>, which is the owner's ruling of the same day. One call
    /// rather than one <see cref="VerplaatsMomentAsync"/> per day, so a run never ends up half at the old hours
    /// because the eighth of fifteen requests failed.
    /// </para>
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">No such placement.</exception>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentValidatieFout">
    /// The end is not after the start, or a day holds the hoek twice (one day dragged onto another). The second is
    /// refused with the day named rather than folded into one row, by the owner's ruling of 2026-09-11.
    /// </exception>
    Task<HoekplaatsingWeergave> ZetUrenAsync(
        Guid plaatsingId,
        TimeOnly begin,
        TimeOnly einde,
        CancellationToken cancellationToken = default);
}

/// <summary>What the teacher answered in the sheet after dropping a fiche on a day.</summary>
/// <param name="HoekId">The corner she dragged.</param>
/// <param name="Van">First day of the window, inclusive.</param>
/// <param name="Tot">Last day, inclusive. May equal <paramref name="Van"/>.</param>
/// <param name="Begin">
/// When the corner opens on every teaching day of the window (ADR-0027). Required: "not in the uurrooster" was
/// an answer until 2026-09-11, when the owner ruled that every hoek gets a time.
/// </param>
/// <param name="Einde">When it closes. Must lie after <paramref name="Begin"/>.</param>
public sealed record HoekplaatsingInvoer(
    Guid HoekId,
    DateOnly Van,
    DateOnly Tot,
    TimeOnly Begin,
    TimeOnly Einde);

/// <summary>A placed hoek as the agenda reads it.</summary>
/// <param name="Id">Surrogate identity of the placement.</param>
/// <param name="HoekId">The placed corner.</param>
/// <param name="HoekNaam">Its name, so the calendar can label the band without a second request.</param>
/// <param name="Van">First day, inclusive.</param>
/// <param name="Tot">Last day, inclusive.</param>
/// <param name="Momenten">
/// Where it appears in the time grid, one per teaching day. Empty only for a placement made before every hoek had
/// to have a time (2026-09-11).
/// </param>
public sealed record HoekplaatsingWeergave(
    Guid Id,
    Guid HoekId,
    string HoekNaam,
    DateOnly Van,
    DateOnly Tot,
    IReadOnlyList<HoekmomentWeergave> Momenten);

/// <summary>One appearance in the time grid: this day, from this time to that one.</summary>
public sealed record HoekmomentWeergave(Guid Id, DateOnly Datum, TimeOnly Begin, TimeOnly Einde);
