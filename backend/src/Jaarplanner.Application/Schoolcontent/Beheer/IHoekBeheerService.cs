namespace Jaarplanner.Application.Schoolcontent.Beheer;

/// <summary>
/// CRUD for a class's <c>Hoek</c>en: the fixed corners of one classroom (owner, meeting 2026-08-30).
/// Autonomous school content (Art. III), so everything here is fully editable.
/// <para>
/// <b>Everything is scoped to one klas, and there is no school-wide list.</b> A hoek is furniture in a room, so
/// two classes of the same age genuinely may have different corners. The convenience that a shared list would
/// have bought is bought by <see cref="NeemHoekenOverAsync"/> instead, which copies rather than shares.
/// </para>
/// </summary>
public interface IHoekBeheerService
{
    /// <summary>The corners of one class, by name.</summary>
    Task<IReadOnlyList<HoekWeergave>> HaalHoekenOpAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>Adds a corner to a class.</summary>
    Task<HoekWeergave> MaakHoekAsync(Guid klasId, HoekInvoer invoer, CancellationToken cancellationToken = default);

    /// <summary>Renames or re-describes a corner.</summary>
    Task<HoekWeergave> WijzigHoekAsync(Guid hoekId, HoekInvoer invoer, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a corner. <b>Refused while it is still placed on the agenda</b>, with the count in the message: a
    /// placement owns verrijkingen, which are sentences a teacher wrote, and Art. IV.2 does not let an unrelated
    /// action undo those as a side effect.
    /// </summary>
    Task VerwijderHoekAsync(Guid hoekId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Copies another class's corners into this one, skipping the names it already has.
    /// <para>
    /// A copy, never a share: the new rows belong to <paramref name="klasId"/> from the moment they exist, so
    /// renaming or deleting one touches nothing in the class it came from.
    /// </para>
    /// </summary>
    Task<HoekOvername> NeemHoekenOverAsync(
        Guid klasId,
        Guid vanKlasId,
        CancellationToken cancellationToken = default);
}

/// <summary>What a teacher states about a corner: what it is called and, optionally, what is permanently in it.</summary>
/// <param name="Naam">The corner's name. Required.</param>
/// <param name="Omschrijving">
/// What the corner permanently holds. This is the part that does NOT change per thema; what does is a
/// <c>Hoekverrijking</c> on a placement.
/// </param>
public sealed record HoekInvoer(string Naam, string? Omschrijving = null);

/// <summary>A corner as the beheerscherm reads it.</summary>
/// <param name="Id">Surrogate identity.</param>
/// <param name="KlasId">The class whose room this corner is in.</param>
/// <param name="Naam">What the teacher calls it.</param>
/// <param name="Omschrijving">What it permanently holds, or null.</param>
/// <param name="AantalPlaatsingen">
/// How often this corner is currently placed on the agenda. It is what makes the delete refusal predictable: a
/// row showing a count is a row the teacher can see will not simply disappear. It is <b>not</b> used to
/// pre-empt the refusal, because the only count that may block a delete is the one the server sees at the
/// moment of the delete.
/// </param>
public sealed record HoekWeergave(
    Guid Id,
    Guid KlasId,
    string Naam,
    string? Omschrijving,
    int AantalPlaatsingen);

/// <summary>
/// What taking over another class's corners actually did.
/// <para>
/// <b>The skipped names are returned rather than counted</b>, because "3 overgenomen, 2 overgeslagen" leaves a
/// teacher wondering which two, and the answer is one she can act on: those are the corners she already has.
/// </para>
/// </summary>
/// <param name="Overgenomen">The corners created in the receiving class.</param>
/// <param name="Overgeslagen">The names that were already present, in the order they were found.</param>
public sealed record HoekOvername(
    IReadOnlyList<HoekWeergave> Overgenomen,
    IReadOnlyList<string> Overgeslagen);
