namespace Jaarplanner.Application.Planning.Beheer;

/// <summary>
/// The school's hours per weekday (FB-023, ADR-0038): read by everyone who plans, replaced by directie.
/// <para>
/// <b>One set for the school</b> (owner, 2026-09-15): not per klas and not per schooljaar, so there is no id in the
/// route and no scope in the body.
/// </para>
/// </summary>
public interface ISchoolurenService
{
    /// <summary>The weekdays that have hours, Monday first. A weekday without hours is absent, never a null row.</summary>
    Task<SchoolurenWeergave> HaalOpAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces the whole set: a weekday in <paramref name="invoer"/> gets those hours, a weekday not in it has none
    /// afterwards. All or nothing: one refused weekday leaves every row as it was.
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentValidatieFout">
    /// No list, an unknown or repeated weekday, or hours the domain refuses; the Dutch sentence names the weekday.
    /// </exception>
    Task<SchoolurenWeergave> VervangAsync(SchoolurenInvoer invoer, CancellationToken cancellationToken = default);
}

/// <summary>
/// The hours of one weekday as they travel. <see cref="Weekdag"/> is the ISO number, 1 for Monday to 5 for Friday,
/// the same numbering the algemene fiches send their weekdays in.
/// </summary>
public sealed record SchooldagurenInvoer(
    int Weekdag,
    TimeOnly Begin,
    TimeOnly Einde,
    TimeOnly? MiddagpauzeBegin = null,
    TimeOnly? MiddagpauzeEinde = null);

/// <summary>What directie sends: every weekday that should have hours.</summary>
public sealed record SchoolurenInvoer(IReadOnlyList<SchooldagurenInvoer>? Dagen);

/// <summary>The hours of one weekday as the screens read them.</summary>
public sealed record SchooldagurenWeergave(
    int Weekdag,
    TimeOnly Begin,
    TimeOnly Einde,
    TimeOnly? MiddagpauzeBegin,
    TimeOnly? MiddagpauzeEinde);

/// <summary>The school's hours: the weekdays that have them, Monday first.</summary>
public sealed record SchoolurenWeergave(IReadOnlyList<SchooldagurenWeergave> Dagen);
