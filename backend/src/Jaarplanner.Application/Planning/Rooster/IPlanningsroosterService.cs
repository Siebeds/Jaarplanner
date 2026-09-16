namespace Jaarplanner.Application.Planning.Rooster;

/// <summary>
/// Reads a school year's span and the vacations inside it — the frame the plan screen's timeline and the agenda are
/// drawn in (FR-6.1).
/// <para>
/// <b>No periods any more</b> (ADR-0053). Until then this read returned the derived themaperiodes too; a thema
/// placement now carries its own dates, and the lesweken of the year ride on the jaarplan read, where they are
/// counted against a class's placements.
/// </para>
/// </summary>
public interface IPlanningsroosterService
{
    /// <summary>
    /// The frame of one school year. Throws the shared not-found fault when the year does not exist, so the existing
    /// exception handler maps it to a 404 with no new plumbing in the (thin) Api.
    /// </summary>
    Task<PlanningsroosterWeergave> HaalRoosterOpAsync(Guid schooljaarId, CancellationToken cancellationToken = default);
}

/// <summary>
/// A school year's frame as the timeline and the agenda consume it.
/// </summary>
/// <param name="SchooljaarId">The year.</param>
/// <param name="SchooljaarNaam">The year label (e.g. "2026-2027").</param>
/// <param name="Start">First day of the year.</param>
/// <param name="Eind">Last day of the year, inclusive.</param>
/// <param name="Onderbrekingen">
/// Only the vacations, chronological: the closures that split a thema (ADR-0053 R3). A
/// <c>Sluitingssoort.VrijeDag</c> is deliberately absent; it is a day without school inside a week, not a gap.
/// </param>
public sealed record PlanningsroosterWeergave(
    Guid SchooljaarId,
    string SchooljaarNaam,
    DateOnly Start,
    DateOnly Eind,
    IReadOnlyList<PlanningsonderbrekingWeergave> Onderbrekingen);

/// <summary>One vacation, rendered as a gap in the timeline.</summary>
/// <param name="Naam">The school's own Dutch name for it ("Herfstvakantie") — shown in the gap.</param>
/// <param name="Start">First day of the closure.</param>
/// <param name="Eind">Last day of the closure, inclusive.</param>
public sealed record PlanningsonderbrekingWeergave(string Naam, DateOnly Start, DateOnly Eind);
