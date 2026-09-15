namespace Jaarplanner.Application.Planning.AlgemeneFiches;

/// <summary>
/// Planning an algemene fiche in the agenda, and reading back what is planned (owner, 2026-09-11).
/// <para>
/// <b>Separate from the weekplanning, like the hoekplaatsingen.</b> A placement is not part of the <c>Jaarplan</c>
/// aggregate, so the agenda asks for it in its own request over its own range, and nothing that (re)generates a plan
/// can see these rows.
/// </para>
/// </summary>
public interface IAlgemeneFicheplaatsingService
{
    /// <summary>Every placement overlapping <paramref name="van"/>-<paramref name="tot"/>, for one class.</summary>
    Task<IReadOnlyList<AlgemeneFicheplaatsingWeergave>> HaalVoorBereikAsync(
        Guid klasId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Plans a fiche: over these days, on these weekdays, from this time to that one. One call writes one row per
    /// matching teaching day, skipping weekends and closures.
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentValidatieFout">
    /// The window is outside the school year, the fiche belongs to another class, no weekday was chosen, a weekend
    /// day was, or no teaching day at all falls on the chosen weekdays in the window.
    /// </exception>
    Task<AlgemeneFicheplaatsingWeergave> PlaatsAsync(
        Guid klasId,
        AlgemeneFicheplaatsingInvoer invoer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a placement with all of its occurrences. If it was the fiche's last placement, the fiche's goals stop
    /// counting for dekking; the screen says so before the teacher confirms.
    /// </summary>
    Task VerwijderAsync(Guid plaatsingId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes ONE occurrence out of the agenda, with its day text (TB-030). The last occurrence takes the placement
    /// along: dekking counts a placement while its row exists, so one with no day left would keep the fiche counting
    /// from a period drawn nowhere.
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// No such placement, or no such occurrence in it.
    /// </exception>
    Task VerwijderMomentAsync(Guid plaatsingId, Guid momentId, CancellationToken cancellationToken = default);

    /// <summary>Moves or resizes ONE occurrence, inside the placement's window.</summary>
    Task<AlgemeneFicheplaatsingWeergave> VerplaatsMomentAsync(
        Guid plaatsingId,
        Guid momentId,
        DateOnly datum,
        TimeOnly begin,
        TimeOnly einde,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets what the class does in ONE occurrence that day, or clears it with an empty text (FB-022).
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentValidatieFout">The text is too long.</exception>
    Task<AlgemeneFicheplaatsingWeergave> ZetMomenttekstAsync(
        Guid plaatsingId,
        Guid momentId,
        string? tekst,
        CancellationToken cancellationToken = default);
}

/// <summary>What the teacher answered in the sheet.</summary>
/// <param name="AlgemeneFicheId">The fiche she planned.</param>
/// <param name="Van">First day, inclusive.</param>
/// <param name="Tot">Last day, inclusive.</param>
/// <param name="Weekdagen">
/// The weekdays it recurs on, ISO numbered: 1 is maandag and 5 is vrijdag. Numbers rather than names so the contract
/// does not depend on the language of an enum.
/// </param>
/// <param name="Begin">
/// When it starts on each of those days. Required: a recurring fiche is something that happens at an hour ("elke
/// maandag turnen op dit uur"), and one without a time would be drawn nowhere in the day view.
/// </param>
/// <param name="Einde">When it ends on each of those days. Must lie after <paramref name="Begin"/>.</param>
public sealed record AlgemeneFicheplaatsingInvoer(
    Guid AlgemeneFicheId,
    DateOnly Van,
    DateOnly Tot,
    IReadOnlyList<int> Weekdagen,
    TimeOnly Begin,
    TimeOnly Einde);

/// <summary>A planned fiche as the agenda reads it.</summary>
/// <param name="Id">Surrogate identity of the placement.</param>
/// <param name="AlgemeneFicheId">The fiche.</param>
/// <param name="FicheNaam">Its name, so the calendar can label it without a second request.</param>
/// <param name="Van">First day, inclusive.</param>
/// <param name="Tot">Last day, inclusive.</param>
/// <param name="Momenten">Every occurrence, by day and then by start time.</param>
public sealed record AlgemeneFicheplaatsingWeergave(
    Guid Id,
    Guid AlgemeneFicheId,
    string FicheNaam,
    DateOnly Van,
    DateOnly Tot,
    IReadOnlyList<AlgemeneFichemomentWeergave> Momenten);

/// <summary>One occurrence: this day, from this time to that one.</summary>
/// <param name="Tekst">What the class does in it that day, or <c>null</c> when nothing is filled in (FB-022).</param>
public sealed record AlgemeneFichemomentWeergave(Guid Id, DateOnly Datum, TimeOnly Begin, TimeOnly Einde, string? Tekst);
