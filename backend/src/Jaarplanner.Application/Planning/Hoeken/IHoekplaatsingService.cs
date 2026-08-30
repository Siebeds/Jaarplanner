namespace Jaarplanner.Application.Planning.Hoeken;

/// <summary>
/// Placing a hoek on the agenda, and reading back what is placed (owner, meeting 2026-08-30).
/// <para>
/// <b>Separate from the weekplanning, on purpose.</b> A hoekplaatsing is not part of the <c>Jaarplan</c>
/// aggregate, so it is not part of the read model that projects one either. The agenda asks for it in its own
/// request over its own range. That costs one call and buys the property the model was built for: nothing that
/// (re)generates a plan can see these rows, let alone discard them.
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
    /// One call does all three things the teacher answered in the sheet: the window, the enrichment she typed,
    /// and whether it takes a lesuur. They arrive together because she decided them together, and because a
    /// placement that got its window but lost its verrijking to a second failed request is worse than one that
    /// never happened.
    /// </para>
    /// </summary>
    Task<HoekplaatsingWeergave> PlaatsAsync(
        Guid klasId,
        HoekplaatsingInvoer invoer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a placement, with its enrichments and its timetable rows.
    /// <para>
    /// The way back out of a mistake, and the reason placing is safe to offer at all. It is a hard delete: an
    /// enrichment describes THIS window and means nothing without it, unlike an activiteit placed on a Tuesday,
    /// which stays a fact about a day that was taught.
    /// </para>
    /// </summary>
    Task VerwijderAsync(Guid plaatsingId, CancellationToken cancellationToken = default);
}

/// <summary>What the teacher answered in the sheet after dropping a fiche on a day.</summary>
/// <param name="HoekId">The corner she dragged.</param>
/// <param name="Van">First day of the window, inclusive.</param>
/// <param name="Tot">Last day, inclusive. May equal <paramref name="Van"/>.</param>
/// <param name="Verrijking">
/// What the corner gets over this window, or null when she left it blank. Blank is an ordinary answer: the
/// boekenhoek runs in december with nothing special in it.
/// </param>
/// <param name="Lesuur">
/// The zero-based lesuur the hoek takes on every teaching day of the window, or null for "not in the uurrooster".
/// One nullable field rather than a bool plus a number, so the two cannot disagree.
/// </param>
public sealed record HoekplaatsingInvoer(
    Guid HoekId,
    DateOnly Van,
    DateOnly Tot,
    string? Verrijking = null,
    int? Lesuur = null);

/// <summary>A placed hoek as the agenda reads it.</summary>
/// <param name="Id">Surrogate identity of the placement.</param>
/// <param name="HoekId">The placed corner.</param>
/// <param name="HoekNaam">Its name, so the calendar can label the band without a second request.</param>
/// <param name="Van">First day, inclusive.</param>
/// <param name="Tot">Last day, inclusive.</param>
/// <param name="Verrijkingen">What is in the corner, per sub-window. Empty is normal.</param>
/// <param name="Momenten">Where it appears in the timetable. Empty means it claims no lesuur.</param>
public sealed record HoekplaatsingWeergave(
    Guid Id,
    Guid HoekId,
    string HoekNaam,
    DateOnly Van,
    DateOnly Tot,
    IReadOnlyList<HoekverrijkingWeergave> Verrijkingen,
    IReadOnlyList<HoekmomentWeergave> Momenten);

/// <summary>One enrichment: what is in the corner, over these days.</summary>
public sealed record HoekverrijkingWeergave(Guid Id, DateOnly Van, DateOnly Tot, string Tekst);

/// <summary>One appearance in the timetable: this day, this lesuur.</summary>
public sealed record HoekmomentWeergave(Guid Id, DateOnly Datum, int Volgorde);
