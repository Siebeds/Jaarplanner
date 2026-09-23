using Jaarplanner.Application.Toegang;

namespace Jaarplanner.Application.Planning.Weekvoorstel;

/// <summary>
/// What a weekvoorstel did (FB-027, ADR-0067), or why the model's answer was refused as a whole (Art. IV.5).
/// </summary>
/// <param name="IsGeldig">False when the answer was not the JSON asked for; nothing changed then.</param>
/// <param name="Fout">An English diagnostic for an invalid answer, else <c>null</c>.</param>
/// <param name="AantalVoorgesteld">How many blocks now stand as open proposals in the week.</param>
/// <param name="PastNiet">The activiteiten the model picked that fit on no day of the week, by name (D1).</param>
/// <param name="AantalOvergeslagen">Picks dropped as unusable (D4).</param>
public sealed record WeekvoorstelResultaat(
    bool IsGeldig,
    string? Fout,
    int AantalVoorgesteld,
    IReadOnlyList<string> PastNiet,
    int AantalOvergeslagen)
{
    public static WeekvoorstelResultaat Geslaagd(int aantal, IReadOnlyList<string> pastNiet, int overgeslagen) =>
        new(true, null, aantal, pastNiet, overgeslagen);

    public static WeekvoorstelResultaat Mislukt(string fout) => new(false, fout, 0, [], 0);
}

/// <summary>
/// The AI proposes a klas's activiteiten for one week (FB-027, ADR-0067): it picks from the activiteiten of the
/// subthema's that run that week, and the tool fits them into the free time as open proposals.
/// </summary>
public interface IWeekvoorstelService
{
    /// <summary>
    /// Asks the model for the week that holds <paramref name="dagInWeek"/>, from today on. Replaces the week's open
    /// proposals when the answer keeps at least one (W5).
    /// </summary>
    /// <param name="klasId">The klas.</param>
    /// <param name="dagInWeek">Any day of the week.</param>
    /// <param name="vrager">Who asks: her own activiteiten are candidates beside the shared ones (W3).</param>
    /// <param name="cancellationToken">Cancels the call.</param>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentValidatieFout">
    /// Nothing to ask: no subthema runs that week, the week has passed, no schooluren are set, or every activiteit is
    /// already planned. The Dutch sentence says which.
    /// </exception>
    Task<WeekvoorstelResultaat> StelVoorAsync(
        Guid klasId,
        DateOnly dagInWeek,
        Rechten vrager,
        CancellationToken cancellationToken = default);
}
