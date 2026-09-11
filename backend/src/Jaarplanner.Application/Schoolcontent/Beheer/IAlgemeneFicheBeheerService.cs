using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Schoolcontent.Beheer;

/// <summary>
/// CRUD for a class's algemene fiches and their goal links (owner, 2026-09-11). Autonomous school content (Art. III).
/// <para>
/// <b>Scoped to one klas, with no school-wide list</b>, for the reason <see cref="IHoekBeheerService"/> gives: what a
/// class does every Monday is a fact about that class.
/// </para>
/// <para>
/// <b>Every change to the goal links can move a dekkingscijfer</b>, because a planned fiche's links count (Art. V.1 as
/// amended 2026-09-11). Nothing here caches that; dekking is computed on read, so the caller only has to refetch it.
/// </para>
/// </summary>
public interface IAlgemeneFicheBeheerService
{
    /// <summary>The fiches of one class, by name, each with its linked goals.</summary>
    Task<IReadOnlyList<AlgemeneFicheWeergave>> HaalFichesOpAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>Adds a fiche to a class.</summary>
    Task<AlgemeneFicheWeergave> MaakFicheAsync(
        Guid klasId,
        AlgemeneFicheInvoer invoer,
        CancellationToken cancellationToken = default);

    /// <summary>Renames or re-describes a fiche.</summary>
    Task<AlgemeneFicheWeergave> WijzigFicheAsync(
        Guid ficheId,
        AlgemeneFicheInvoer invoer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a fiche. <b>Refused while it is still planned</b>, with the count in the message: the planning is the
    /// teacher's work, and removing it would also silently withdraw the fiche's goals from the dekking.
    /// </summary>
    Task VerwijderFicheAsync(Guid ficheId, CancellationToken cancellationToken = default);

    /// <summary>Links the fiche to a leerplandoel as a <c>manueel</c> link. Answers with the whole fiche.</summary>
    Task<AlgemeneFicheWeergave> KoppelAanDoelAsync(
        Guid ficheId,
        string leerplandoelCode,
        CancellationToken cancellationToken = default);

    /// <summary>Removes one goal link. Answers with the whole fiche.</summary>
    Task<AlgemeneFicheWeergave> OntkoppelDoelAsync(
        Guid ficheId,
        Guid koppelingId,
        CancellationToken cancellationToken = default);
}

/// <summary>What a teacher states about a fiche.</summary>
/// <param name="Naam">What it is called. Required, unique within the class.</param>
/// <param name="Omschrijving">What happens in it, optionally.</param>
public sealed record AlgemeneFicheInvoer(string Naam, string? Omschrijving = null);

/// <summary>A fiche as the beheerscherm and the agenda's side panel read it.</summary>
/// <param name="Id">Surrogate identity.</param>
/// <param name="KlasId">The class it belongs to.</param>
/// <param name="Naam">What the teacher calls it.</param>
/// <param name="Omschrijving">What happens in it, or null.</param>
/// <param name="AantalPlaatsingen">
/// How often it is planned in the agenda. It says two things a screen needs before an action rather than after: that
/// a delete will be refused, and whether the goals below already count for dekking (zero means not yet).
/// </param>
/// <param name="Doelen">The linked goals, with enough of the goal to be recognisable, ordered by code.</param>
public sealed record AlgemeneFicheWeergave(
    Guid Id,
    Guid KlasId,
    string Naam,
    string? Omschrijving,
    int AantalPlaatsingen,
    IReadOnlyList<AlgemeneFichedoelWeergave> Doelen);

/// <summary>
/// One goal linked to a fiche. The goal's own text travels with the code because a code alone is not something a
/// teacher recognises, and the fiche form shows the list without a second request per row.
/// </summary>
/// <param name="KoppelingId">The link's identity, which is what unlinking addresses.</param>
/// <param name="LeerplandoelCode">The goal's code.</param>
/// <param name="Doelsoort">The goal type, for its badge (Art. XII).</param>
/// <param name="JaarFase">The goal's jaar/fase.</param>
/// <param name="Tekst">The goal's official text (read-only reference data, Art. III.1).</param>
public sealed record AlgemeneFichedoelWeergave(
    Guid KoppelingId,
    string LeerplandoelCode,
    Doelsoort Doelsoort,
    string JaarFase,
    string Tekst);
